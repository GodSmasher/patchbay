import { parseTestOutput, TEST_COMMAND } from './report'
import type { GeneratedFile, TestReport } from './types'

export interface SandboxRunner {
  /** Returns an image id that has node, typescript and vitest installed under /work. */
  prepare(log: (message: string) => void): Promise<string>
  /** Runs typecheck + tests for the given files on a fresh branch of the prepared image. */
  runTests(baseImage: string, files: GeneratedFile[], log: (message: string) => void): Promise<TestReport>
}

interface Operation {
  uuid: string
  status: 'PENDING' | 'ASSIGNED' | 'EXECUTING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'
  error?: string | null
  result_image_uuid?: string | null
  result?: { image?: string | null; tag?: string | null }
  metadata?: {
    result?: {
      state?: { exit_code?: number; timed_out?: boolean }
      stdout?: { value: string; encoding: 'ascii' | 'base64' }
      stderr?: { value: string; encoding: 'ascii' | 'base64' }
    }
  }
}

const NODE_IMAGE_TAG = 'patchbay-node:22'
const NODE_IMAGE_REGISTRY = 'docker://docker.io/library/node:22-slim'

const PREPARE_COMMAND = [
  'mkdir -p /work/src',
  'cd /work',
  `printf '%s' '{"name":"connector","private":true,"type":"module"}' > package.json`,
  'npm install --no-audit --no-fund --loglevel=error -D vitest@3.2.4 typescript@5.6.3 @types/node@22',
].join(' && ')

const TSCONFIG = JSON.stringify(
  {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      strict: true,
      skipLibCheck: true,
      types: ['node'],
      lib: ['ES2022', 'DOM'],
    },
    include: ['src/**/*.ts'],
  },
  null,
  2,
)

/**
 * Nebius Token Factory Sandboxes (ConTree REST API).
 *
 * The expensive part — pulling node and installing vitest — happens once and produces an
 * image checkpoint. Every test attempt forks from that checkpoint with networking disabled,
 * so generated code can never reach the real APIs and each retry starts from the same state.
 */
export function createNebiusSandbox(opts: {
  apiKey: string
  project: string
  baseUrl: string
  preparedImage?: string
  fetch?: typeof fetch
  pollIntervalMs?: number
}): SandboxRunner {
  const doFetch = opts.fetch ?? fetch
  const pollMs = opts.pollIntervalMs ?? 1500
  let cachedImage = opts.preparedImage

  const headers = (extra: Record<string, string> = {}) => ({
    Authorization: `Bearer ${opts.apiKey}`,
    Project: opts.project,
    ...extra,
  })

  async function request<T>(path: string, init: RequestInit = {}): Promise<{ body: T; location: string | null }> {
    const res = await doFetch(`${opts.baseUrl}${path}`, { ...init, headers: headers(init.headers as Record<string, string>) })
    const text = await res.text()
    if (!res.ok) throw new Error(`Sandbox ${init.method ?? 'GET'} ${path}: HTTP ${res.status} ${text.slice(0, 300)}`)
    return { body: (text ? JSON.parse(text) : {}) as T, location: res.headers.get('location') }
  }

  async function uploadFile(content: string): Promise<string> {
    const { body } = await request<{ uuid: string }>('/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: content,
    })
    return body.uuid
  }

  async function waitFor(operationId: string, timeoutMs: number): Promise<Operation> {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const { body } = await request<Operation>(`/operations/${operationId}`)
      if (body.status === 'SUCCESS' || body.status === 'FAILED' || body.status === 'CANCELLED') return body
      if (Date.now() > deadline) throw new Error(`Sandbox operation ${operationId} did not finish in ${timeoutMs / 1000}s`)
      await sleep(pollMs)
    }
  }

  function operationIdFrom(location: string | null, body: { uuid?: string }): string {
    const fromLocation = location?.split('/').filter(Boolean).pop()
    const id = fromLocation ?? body.uuid
    if (!id) throw new Error('Sandbox did not return an operation id')
    return id
  }

  async function ensureNodeImage(log: (m: string) => void): Promise<string> {
    const { body } = await request<{ images?: { uuid: string; tag?: string | null }[] }>('/images?tagged=1&limit=200')
    const existing = (body.images ?? []).find((image) => image.tag === NODE_IMAGE_TAG)
    if (existing) return existing.uuid
    log('Importing node:22-slim into the sandbox registry (one-time)')
    const started = await request<{ uuid?: string }>('/images/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registry: { url: NODE_IMAGE_REGISTRY }, tag: NODE_IMAGE_TAG, timeout: 600 }),
    })
    const op = await waitFor(operationIdFrom(started.location, started.body), 660_000)
    const image = op.result?.image ?? op.result_image_uuid
    if (op.status !== 'SUCCESS' || !image) throw new Error(`Image import failed: ${op.error ?? op.status}`)
    return image
  }

  return {
    async prepare(log) {
      if (cachedImage) {
        log(`Reusing prepared sandbox image ${cachedImage.slice(0, 8)}`)
        return cachedImage
      }
      const nodeImage = await ensureNodeImage(log)
      log('Installing typescript + vitest in a sandbox checkpoint')
      const started = await request<{ uuid?: string }>('/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: nodeImage, command: PREPARE_COMMAND, shell: true, timeout: 300, networking: { enabled: true } }),
      })
      const op = await waitFor(operationIdFrom(started.location, started.body), 330_000)
      const exit = op.metadata?.result?.state?.exit_code
      if (op.status !== 'SUCCESS' || !op.result_image_uuid || exit !== 0) {
        throw new Error(`Sandbox preparation failed (exit ${exit ?? '?'}): ${decode(op.metadata?.result?.stderr).slice(0, 500)}`)
      }
      cachedImage = op.result_image_uuid
      log(`Checkpoint ready: ${cachedImage.slice(0, 8)}`)
      return cachedImage
    },

    async runTests(baseImage, files, log) {
      const all: GeneratedFile[] = [{ path: 'tsconfig.json', content: TSCONFIG }, ...files.filter((f) => f.path.endsWith('.ts'))]
      const mapped: Record<string, { uuid: string; mode: string }> = {}
      for (const file of all) {
        mapped[`/work/${file.path}`] = { uuid: await uploadFile(file.content), mode: '0644' }
      }
      log(`Forking checkpoint ${baseImage.slice(0, 8)} with ${all.length} files, network off`)
      const started = await request<{ uuid?: string }>('/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: baseImage,
          command: TEST_COMMAND,
          shell: true,
          disposable: true,
          timeout: 120,
          files: mapped,
          networking: { enabled: false },
        }),
      })
      const operationId = operationIdFrom(started.location, started.body)
      const op = await waitFor(operationId, 180_000)
      if (op.status !== 'SUCCESS' && !op.metadata?.result) {
        throw new Error(`Sandbox test run ${op.status}: ${op.error ?? 'no result'}`)
      }
      return parseTestOutput(decode(op.metadata?.result?.stdout), `nebius-sandbox:${operationId}`)
    },
  }
}

function decode(stream?: { value: string; encoding: 'ascii' | 'base64' }): string {
  if (!stream?.value) return ''
  return stream.encoding === 'base64' ? Buffer.from(stream.value, 'base64').toString('utf8') : stream.value
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

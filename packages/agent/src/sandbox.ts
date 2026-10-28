import { LANG } from './lang'
import type { GeneratedFile, Lang, TestReport } from './types'

export interface SandboxRunner {
  /** Returns an image id prepared for the configured language (node+vitest, or python+pytest). */
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

const PY_IMAGE_TAG = 'patchbay-python:3.12'
const PY_IMAGE_REGISTRY = 'docker://docker.io/library/python:3.12-slim'

const PREPARE_COMMAND = [
  'mkdir -p /work/src',
  'cd /work',
  `printf '%s' '{"name":"connector","private":true,"type":"module"}' > package.json`,
  'npm install --no-audit --no-fund --loglevel=error -D vitest@3.2.4 typescript@5.6.3 @types/node@22',
].join(' && ')

/**
 * Prepare Python 3.12 with the exact test deps we rely on. Keep the surface tiny:
 *   - pytest (test runner)
 *   - pytest-asyncio (async def test support, auto mode)
 *   - pytest-json-report (machine-readable output for parsePytestOutput)
 *   - httpx is NOT installed — generated code must use an injected fake transport, same
 *     invariant as TS where fetch is injected and `node-fetch` is never pulled in.
 * conftest.py sets asyncio_mode = auto so bare `async def test_...` work without decorators.
 */
const PREPARE_COMMAND_PY = [
  'mkdir -p /work',
  'cd /work',
  'pip install --quiet --no-cache-dir pytest==8.3.3 pytest-asyncio==0.24.0 pytest-json-report==1.5.0',
  // printf '%b' interprets \n as a real newline; '%s' would write the literal \n characters
  // and pytest.ini would be a one-line garble ("unexpected value continuation").
  `printf '%b' '[pytest]\\nasyncio_mode = auto\\n' > pytest.ini`,
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
 * The expensive part — pulling the base image and installing test deps — happens once and
 * produces an image checkpoint. Every test attempt forks from that checkpoint with networking
 * disabled, so generated code can never reach the real APIs and each retry starts from the
 * same state. One checkpoint per language.
 */
export function createNebiusSandbox(opts: {
  apiKey: string
  project: string
  baseUrl: string
  preparedImage?: string
  /** Target language — `ts` (default) uses node:22-slim + vitest, `py` uses python:3.12-slim + pytest. */
  lang?: Lang
  fetch?: typeof fetch
  pollIntervalMs?: number
}): SandboxRunner {
  const doFetch = opts.fetch ?? fetch
  const pollMs = opts.pollIntervalMs ?? 1500
  const lang: Lang = opts.lang ?? 'ts'
  let cachedImage = opts.preparedImage

  const headers = (extra: Record<string, string> = {}) => ({
    Authorization: `Bearer ${opts.apiKey}`,
    Project: opts.project,
    ...extra,
  })

  async function request<T>(path: string, init: RequestInit = {}): Promise<{ body: T; location: string | null }> {
    const method = (init.method ?? 'GET').toUpperCase()
    const maxTries = 3
    let lastError: unknown
    for (let attempt = 0; attempt < maxTries; attempt++) {
      try {
        const res = await doFetch(`${opts.baseUrl}${path}`, { ...init, headers: headers(init.headers as Record<string, string>) })
        const text = await res.text()
        if (res.status >= 500 && res.status < 600 && attempt < maxTries - 1) {
          lastError = new Error(`HTTP ${res.status} ${text.slice(0, 120)}`)
          await sleep(500 * Math.pow(2, attempt))
          continue
        }
        if (!res.ok) throw new Error(`Sandbox ${method} ${path}: HTTP ${res.status} ${text.slice(0, 300)}`)
        return { body: (text ? JSON.parse(text) : {}) as T, location: res.headers.get('location') }
      } catch (error) {
        lastError = error
        if (attempt >= maxTries - 1) break
        await sleep(500 * Math.pow(2, attempt))
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`Sandbox ${method} ${path}: ${String(lastError)}`)
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

  async function ensureBaseImage(log: (m: string) => void): Promise<string> {
    const { tag, registry } = LANG[lang].sandbox
    const { body } = await request<{ images?: { uuid: string; tag?: string | null }[] }>('/images?tagged=1&limit=200')
    const existing = (body.images ?? []).find((image) => image.tag === tag)
    if (existing) return existing.uuid
    log(`Importing ${registry.replace('docker://', '')} into the sandbox registry (one-time)`)
    const started = await request<{ uuid?: string }>('/images/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registry: { url: registry }, tag, timeout: 600 }),
    })
    const op = await waitFor(operationIdFrom(started.location, started.body), 660_000)
    const image = op.result?.image ?? op.result_image_uuid
    if (op.status !== 'SUCCESS' || !image) throw new Error(`Image import failed: ${op.error ?? op.status}`)
    return image
  }

  function filesForRun(files: GeneratedFile[]): GeneratedFile[] {
    if (lang === 'py') {
      return files.filter((f) => f.path.endsWith('.py'))
    }
    return [{ path: 'tsconfig.json', content: TSCONFIG }, ...files.filter((f) => f.path.endsWith('.ts'))]
  }

  function parse(stdout: string, operationId: string): TestReport {
    return LANG[lang].parseTestOutput(stdout, `nebius-sandbox:${operationId}`)
  }

  return {
    async prepare(log) {
      if (cachedImage) {
        log(`Reusing prepared sandbox image ${cachedImage.slice(0, 8)}`)
        return cachedImage
      }
      const baseImage = await ensureBaseImage(log)
      const { prepareCommand } = LANG[lang].sandbox
      log(`Installing ${lang === 'py' ? 'pytest + pytest-asyncio + pytest-json-report' : 'typescript + vitest'} in a sandbox checkpoint`)
      const started = await request<{ uuid?: string }>('/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: baseImage, command: prepareCommand, shell: true, timeout: 300, networking: { enabled: true } }),
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
      const all = filesForRun(files)
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
          command: LANG[lang].sandbox.testCommand,
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
      return parse(decode(op.metadata?.result?.stdout), operationId)
    },
  }
}

function decode(stream?: { value: string; encoding: 'ascii' | 'base64' }): string {
  if (!stream?.value) return ''
  return stream.encoding === 'base64' ? Buffer.from(stream.value, 'base64').toString('utf8') : stream.value
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

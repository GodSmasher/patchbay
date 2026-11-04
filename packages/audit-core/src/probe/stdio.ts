import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { diffManifest, serverIdFromStdio } from '../lib/manifest'
import { fileManifestStore, makeEntry, type ManifestStore } from '../lib/manifest-store'
import type { StdioProbe, TargetSnapshot, ToolDescriptor } from '../types'

export interface StdioProbeOptions {
  timeoutMs?: number
  /** Override the child-process spawn (for tests). */
  spawnImpl?: typeof spawn
  manifestStore?: ManifestStore
  trustCurrentManifest?: boolean
}

const CLIENT_INFO = { name: 'patchbay-audit', version: '0.3.0' }

const INIT_REQUEST = {
  jsonrpc: '2.0' as const,
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: CLIENT_INFO },
}

const TOOLS_LIST_REQUEST = {
  jsonrpc: '2.0' as const,
  id: 2,
  method: 'tools/list',
  params: {},
}

/**
 * Audit an MCP server reached over stdio. The command string is split with
 * a POSIX-style parser (handles quoted args), then spawned as a child
 * process. We send `initialize` and `tools/list` as newline-delimited
 * JSON-RPC on stdin and collect responses from stdout.
 *
 * On timeout or crash we return a partial probe with rawErrors populated
 * so the caller can still run MANIFEST-001 on whatever tool list we got.
 */
export async function probeStdio(command: string, opts: StdioProbeOptions = {}): Promise<TargetSnapshot> {
  const timeoutMs = opts.timeoutMs ?? 10_000
  const spawnFn = opts.spawnImpl ?? spawn

  const parts = parseCommand(command)
  const errors: string[] = []
  const probe: StdioProbe = {
    command,
    binary: parts[0] ?? '',
    args: parts.slice(1),
    spawned: false,
    initializeOk: false,
    toolsListOk: false,
    tools: [],
    rawErrors: errors,
  }

  if (!parts.length) {
    errors.push('empty command')
    return wrap(command, probe)
  }

  let child: ChildProcessWithoutNullStreams
  try {
    child = spawnFn(parts[0]!, parts.slice(1), { stdio: ['pipe', 'pipe', 'pipe'] }) as ChildProcessWithoutNullStreams
    probe.spawned = true
  } catch (e) {
    errors.push(`spawn failed: ${(e as Error).message}`)
    return wrap(command, probe)
  }

  let stdoutBuf = ''
  let stderrBuf = ''
  const responses: Array<Record<string, unknown>> = []

  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    stdoutBuf += chunk
    let idx: number
    while ((idx = stdoutBuf.indexOf('\n')) !== -1) {
      const line = stdoutBuf.slice(0, idx).trim()
      stdoutBuf = stdoutBuf.slice(idx + 1)
      if (!line) continue
      try {
        responses.push(JSON.parse(line) as Record<string, unknown>)
      } catch {
        // Lines that are not JSON (startup logs, warnings) are ignored
        // rather than counted as errors. Many MCP servers emit a banner.
      }
    }
  })
  child.stderr.on('data', (chunk: string) => {
    stderrBuf += chunk
  })

  let exited = false
  child.once('exit', (code) => {
    exited = true
    if (typeof code === 'number') probe.exitCode = code
  })

  try {
    child.stdin.write(JSON.stringify(INIT_REQUEST) + '\n')
    const initResponse = await waitForResponseWithId(() => responses, 1, timeoutMs, () => exited)
    if (initResponse) probe.initializeOk = true
    else errors.push('initialize timed out or produced no response')

    child.stdin.write(JSON.stringify(TOOLS_LIST_REQUEST) + '\n')
    const toolsResponse = await waitForResponseWithId(() => responses, 2, timeoutMs, () => exited)
    if (toolsResponse) {
      probe.toolsListOk = true
      probe.tools = extractTools(toolsResponse)
    } else {
      errors.push('tools/list timed out or produced no response')
    }
  } finally {
    try { child.stdin.end() } catch { /* already closed */ }
    try { if (!exited) child.kill('SIGTERM') } catch { /* already exited */ }
  }

  if (stderrBuf) probe.stderrSnippet = stderrBuf.slice(0, 500)

  if (probe.toolsListOk && probe.tools.length > 0) {
    try {
      const store = opts.manifestStore ?? fileManifestStore()
      const serverId = serverIdFromStdio(probe.binary, probe.args)
      const pinned = store.load(serverId)
      const now = new Date()
      if (opts.trustCurrentManifest || !pinned) {
        store.save(makeEntry(serverId, probe.tools, now))
      } else {
        const delta = diffManifest(pinned, probe.tools)
        if (delta.changes.length > 0) probe.manifestDelta = delta
        store.save({ ...pinned, lastSeen: now.toISOString() })
      }
    } catch (e) {
      errors.push(`manifest store: ${(e as Error).message}`)
    }
  }

  return wrap(command, probe)
}

function wrap(command: string, probe: StdioProbe): TargetSnapshot {
  return {
    kind: 'stdio-command',
    target: command,
    stdio: probe,
    capturedAt: new Date().toISOString(),
  }
}

async function waitForResponseWithId(
  getResponses: () => Array<Record<string, unknown>>,
  id: number,
  timeoutMs: number,
  isExited: () => boolean,
): Promise<Record<string, unknown> | null> {
  const start = Date.now()
  return new Promise((resolve) => {
    const tick = () => {
      const match = getResponses().find((r) => r.id === id)
      if (match) return resolve(match)
      if (isExited()) return resolve(null)
      if (Date.now() - start > timeoutMs) return resolve(null)
      setTimeout(tick, 20)
    }
    tick()
  })
}

function extractTools(response: Record<string, unknown>): ToolDescriptor[] {
  const result = response.result as { tools?: Array<Record<string, unknown>> } | undefined
  if (!result || !Array.isArray(result.tools)) return []
  return result.tools.map((t) => ({
    name: String(t.name ?? ''),
    description: typeof t.description === 'string' ? t.description : undefined,
    inputSchema: (t.inputSchema as Record<string, unknown>) ?? undefined,
  })).filter((t) => t.name)
}

/**
 * POSIX-ish command parser: handles double-quoted and single-quoted args
 * and backslash escapes outside quotes. Good enough for the shapes users
 * paste in (`npx -y @foo/mcp /tmp`, `node ./server.js`, `"/path with spaces/bin" --flag`).
 */
export function parseCommand(input: string): string[] {
  const out: string[] = []
  let cur = ''
  let i = 0
  let inSingle = false
  let inDouble = false
  while (i < input.length) {
    const ch = input[i]!
    if (inSingle) {
      if (ch === "'") inSingle = false
      else cur += ch
    } else if (inDouble) {
      if (ch === '"') inDouble = false
      else if (ch === '\\' && i + 1 < input.length) { cur += input[i + 1]; i++ }
      else cur += ch
    } else {
      if (ch === "'") inSingle = true
      else if (ch === '"') inDouble = true
      else if (ch === '\\' && i + 1 < input.length) { cur += input[i + 1]; i++ }
      else if (/\s/.test(ch)) {
        if (cur.length) { out.push(cur); cur = '' }
      } else {
        cur += ch
      }
    }
    i++
  }
  if (cur.length) out.push(cur)
  return out
}

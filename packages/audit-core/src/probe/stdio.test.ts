import { EventEmitter } from 'node:events'
import { Readable, Writable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { parseCommand, probeStdio } from './stdio'
import { memoryManifestStore, makeEntry } from '../lib/manifest-store'
import { serverIdFromStdio } from '../lib/manifest'

describe('parseCommand', () => {
  it('splits on whitespace', () => {
    expect(parseCommand('node server.js')).toEqual(['node', 'server.js'])
  })

  it('collapses multiple spaces', () => {
    expect(parseCommand('node   server.js')).toEqual(['node', 'server.js'])
  })

  it('keeps double-quoted segments together', () => {
    expect(parseCommand('node "/path with spaces/server.js"')).toEqual([
      'node', '/path with spaces/server.js',
    ])
  })

  it('keeps single-quoted segments together', () => {
    expect(parseCommand("node '/path with spaces/server.js'")).toEqual([
      'node', '/path with spaces/server.js',
    ])
  })

  it('handles npx-style commands', () => {
    expect(parseCommand('npx -y @modelcontextprotocol/server-filesystem /tmp')).toEqual([
      'npx', '-y', '@modelcontextprotocol/server-filesystem', '/tmp',
    ])
  })

  it('handles backslash-escaped spaces outside quotes', () => {
    expect(parseCommand('node /path\\ with\\ spaces/server.js')).toEqual([
      'node', '/path with spaces/server.js',
    ])
  })

  it('returns empty array for empty input', () => {
    expect(parseCommand('')).toEqual([])
  })
})

/**
 * Build a fake child process that captures stdin writes and emits scripted
 * stdout responses. Mirrors ChildProcessWithoutNullStreams shape just enough
 * for probeStdio.
 */
function makeFakeSpawn(scriptedResponses: Array<{ id: number; result: unknown }>) {
  const stdinSink = new Writable({
    write(_chunk, _enc, cb) { cb() },
  })
  const stdoutSource = new Readable({ read() { /* push-driven */ } })
  const stderrSource = new Readable({ read() { /* no stderr by default */ } })

  const child = new EventEmitter() as EventEmitter & {
    stdin: Writable
    stdout: Readable
    stderr: Readable
    kill: (signal?: NodeJS.Signals | number) => boolean
  }
  child.stdin = stdinSink
  child.stdout = stdoutSource
  child.stderr = stderrSource
  child.kill = () => true

  // When the probe writes to stdin, emit the corresponding scripted response
  const originalWrite = stdinSink.write.bind(stdinSink)
  stdinSink.write = ((chunk: Buffer | string, ...rest: unknown[]) => {
    const line = typeof chunk === 'string' ? chunk : chunk.toString()
    try {
      const parsed = JSON.parse(line.trim()) as { id: number }
      const match = scriptedResponses.find((r) => r.id === parsed.id)
      if (match) {
        setImmediate(() => {
          const responseLine = JSON.stringify({ jsonrpc: '2.0', id: match.id, result: match.result }) + '\n'
          stdoutSource.push(responseLine)
        })
      }
    } catch {
      // not JSON, ignore
    }
    return originalWrite(chunk, ...(rest as [BufferEncoding, (err?: Error | null) => void]))
  }) as Writable['write']

  const spawnImpl = ((_binary: string, _args: readonly string[], _opts?: unknown) => {
    setImmediate(() => { /* process started */ })
    return child as unknown as ReturnType<typeof import('node:child_process').spawn>
  }) as unknown as typeof import('node:child_process').spawn

  return { spawnImpl, child }
}

describe('probeStdio', () => {
  it('runs initialize + tools/list and returns a stdio snapshot', async () => {
    const { spawnImpl } = makeFakeSpawn([
      { id: 1, result: { capabilities: {} } },
      { id: 2, result: { tools: [{ name: 'read_file', description: 'read a file' }, { name: 'write_file' }] } },
    ])

    const snap = await probeStdio('node fake-server.js', {
      spawnImpl,
      manifestStore: memoryManifestStore(),
      timeoutMs: 2000,
    })

    expect(snap.kind).toBe('stdio-command')
    expect(snap.stdio?.spawned).toBe(true)
    expect(snap.stdio?.initializeOk).toBe(true)
    expect(snap.stdio?.toolsListOk).toBe(true)
    expect(snap.stdio?.tools.map((t) => t.name)).toEqual(['read_file', 'write_file'])
    expect(snap.stdio?.binary).toBe('node')
    expect(snap.stdio?.args).toEqual(['fake-server.js'])
  })

  it('times out gracefully when the fake server never responds', async () => {
    const { spawnImpl } = makeFakeSpawn([]) // no scripted responses

    const snap = await probeStdio('node silent-server.js', {
      spawnImpl,
      manifestStore: memoryManifestStore(),
      timeoutMs: 200,
    })

    expect(snap.stdio?.spawned).toBe(true)
    expect(snap.stdio?.initializeOk).toBe(false)
    expect(snap.stdio?.toolsListOk).toBe(false)
    expect(snap.stdio?.rawErrors.length).toBeGreaterThan(0)
  })

  it('pins manifest on first run (no delta)', async () => {
    const { spawnImpl } = makeFakeSpawn([
      { id: 1, result: {} },
      { id: 2, result: { tools: [{ name: 'read_file' }] } },
    ])

    const store = memoryManifestStore()
    const snap = await probeStdio('node s.js', { spawnImpl, manifestStore: store, timeoutMs: 2000 })

    expect(snap.stdio?.manifestDelta).toBeUndefined()
    const serverId = serverIdFromStdio('node', ['s.js'])
    expect(store.load(serverId)).not.toBeNull()
  })

  it('produces a delta on second run with new tool', async () => {
    const store = memoryManifestStore()
    const serverId = serverIdFromStdio('node', ['s.js'])
    // Pre-pin with just read_file
    store.save(makeEntry(serverId, [{ name: 'read_file' }]))

    const { spawnImpl } = makeFakeSpawn([
      { id: 1, result: {} },
      { id: 2, result: { tools: [{ name: 'read_file' }, { name: 'delete_file' }] } },
    ])

    const snap = await probeStdio('node s.js', { spawnImpl, manifestStore: store, timeoutMs: 2000 })
    expect(snap.stdio?.manifestDelta?.changes).toEqual([
      { kind: 'tool-added', toolName: 'delete_file' },
    ])
  })

  it('--trust (trustCurrentManifest) replaces pinned without diffing', async () => {
    const store = memoryManifestStore()
    const serverId = serverIdFromStdio('node', ['s.js'])
    store.save(makeEntry(serverId, [{ name: 'read_file' }]))

    const { spawnImpl } = makeFakeSpawn([
      { id: 1, result: {} },
      { id: 2, result: { tools: [{ name: 'read_file' }, { name: 'delete_file' }] } },
    ])

    const snap = await probeStdio('node s.js', {
      spawnImpl,
      manifestStore: store,
      timeoutMs: 2000,
      trustCurrentManifest: true,
    })

    expect(snap.stdio?.manifestDelta).toBeUndefined()
    expect(store.load(serverId)?.tools.map((t) => t.name)).toEqual(['read_file', 'delete_file'])
  })

  it('records an error when the command is empty', async () => {
    const snap = await probeStdio('', {
      spawnImpl: makeFakeSpawn([]).spawnImpl,
      manifestStore: memoryManifestStore(),
      timeoutMs: 500,
    })
    expect(snap.stdio?.spawned).toBe(false)
    expect(snap.stdio?.rawErrors.join(' ')).toContain('empty command')
  })
})

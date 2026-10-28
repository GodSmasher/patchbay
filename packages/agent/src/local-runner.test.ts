import { describe, it, expect, vi } from 'vitest'
import { probePythonEnv, createLocalRunner } from './local-runner'

/**
 * The local runner's TS and sandbox-fork paths are already covered by the
 * integration pipeline tests; this file exercises the Python branch's
 * capability probe + the dispatch at runTests entry.
 *
 * We don't actually invoke host pytest here — that would make the test
 * dependent on the host's Python env, which defeats the whole point. We stub
 * `child_process.execFile` for the probe calls.
 */

const execFileMock = vi.hoisted(() => vi.fn())
vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}))

type ExecFileCallback = (err: unknown, stdout: string, stderr: string) => void

function mockPythonResponses(responses: Record<string, { code: number; stdout?: string; stderr?: string }>) {
  execFileMock.mockImplementation((bin: string, args: string[], _opts: unknown, cb: ExecFileCallback) => {
    // Build a key out of the args that uniquely picks the probe step.
    const key = args[0] === '--version'
      ? 'version'
      : args[0] === '-c'
        ? `import:${(args[1] ?? '').replace(/^import\s+/, '')}`
        : args.join(' ')
    const r = responses[key]
    if (!r) {
      return cb(new Error(`unexpected ${bin} ${args.join(' ')}`), '', '')
    }
    const err = r.code === 0 ? null : Object.assign(new Error('exit'), { code: r.code })
    cb(err, r.stdout ?? '', r.stderr ?? '')
  })
}

describe('local-runner / probePythonEnv', () => {
  it('passes when python 3.12 + all three deps are importable', async () => {
    mockPythonResponses({
      'version': { code: 0, stdout: 'Python 3.12.5\n' },
      'import:pytest': { code: 0 },
      'import:pytest_asyncio': { code: 0 },
      'import:pytest_jsonreport': { code: 0 },
    })
    await expect(probePythonEnv('python')).resolves.toBeUndefined()
  })

  it('passes on python 3.13 (future-proof: still >=3.12)', async () => {
    mockPythonResponses({
      'version': { code: 0, stdout: 'Python 3.13.0\n' },
      'import:pytest': { code: 0 },
      'import:pytest_asyncio': { code: 0 },
      'import:pytest_jsonreport': { code: 0 },
    })
    await expect(probePythonEnv('python3')).resolves.toBeUndefined()
  })

  it('rejects python 3.11 as too old', async () => {
    mockPythonResponses({ 'version': { code: 0, stdout: 'Python 3.11.9\n' } })
    await expect(probePythonEnv('python')).rejects.toThrow(/need >=3\.12/)
  })

  it('rejects a missing python binary', async () => {
    execFileMock.mockImplementation((_bin: string, _args: string[], _opts: unknown, cb: ExecFileCallback) => {
      cb(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }), '', '')
    })
    await expect(probePythonEnv('python')).rejects.toThrow(/not found on PATH/)
  })

  it('lists exactly the missing pytest extras in the error', async () => {
    mockPythonResponses({
      'version': { code: 0, stdout: 'Python 3.12.1\n' },
      'import:pytest': { code: 0 },
      // pytest-asyncio + pytest-json-report both missing
      'import:pytest_asyncio': { code: 1 },
      'import:pytest_jsonreport': { code: 1 },
    })
    await expect(probePythonEnv('python')).rejects.toThrow(/pytest-asyncio.*pytest-json-report/s)
  })

  it("includes an exact pip install line so the user can copy-paste", async () => {
    mockPythonResponses({
      'version': { code: 0, stdout: 'Python 3.12.1\n' },
      'import:pytest': { code: 1 },
      'import:pytest_asyncio': { code: 1 },
      'import:pytest_jsonreport': { code: 1 },
    })
    await expect(probePythonEnv('python')).rejects.toThrow(/python -m pip install pytest pytest-asyncio pytest-json-report/)
  })
})

describe('local-runner / createLocalRunner', () => {
  it('prepare() returns an opaque image id without probing (lang unknown yet)', async () => {
    execFileMock.mockReset()
    const runner = createLocalRunner({ root: '/tmp' })
    const image = await runner.prepare(() => undefined)
    expect(image).toBe('local')
    expect(execFileMock).not.toHaveBeenCalled()
  })
})

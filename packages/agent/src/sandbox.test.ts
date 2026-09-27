import { describe, expect, it, vi } from 'vitest'
import { TSC_MARKER, VITEST_MARKER } from './report'
import { createNebiusSandbox } from './sandbox'

const BASE = 'https://sandbox.test/v1'
const b64 = (s: string) => Buffer.from(s).toString('base64')

function fakeApi(stdout: string) {
  const calls: { method: string; path: string; headers: Headers; body: unknown }[] = []
  let files = 0
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input).replace(BASE, '')
    const method = init?.method ?? 'GET'
    const headers = new Headers(init?.headers)
    const body = typeof init?.body === 'string' && headers.get('content-type') === 'application/json' ? JSON.parse(init.body) : init?.body
    calls.push({ method, path, headers, body })
    if (method === 'POST' && path === '/files') return json({ uuid: `file-${++files}`, sha256: 'x', size: 1 }, 201)
    if (method === 'POST' && path === '/instances') return json({ uuid: 'op-1' }, 201, { Location: '/v1/operations/op-1' })
    if (method === 'GET' && path === '/operations/op-1') {
      return json({ uuid: 'op-1', status: 'SUCCESS', metadata: { result: { state: { exit_code: 0 }, stdout: { value: b64(stdout), encoding: 'base64' } } } })
    }
    return json({ error: 'not found' }, 404)
  })
  return { fetch, calls }
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

const passing = `${TSC_MARKER}\n0\n${VITEST_MARKER}\n${JSON.stringify({ numTotalTests: 1, numPassedTests: 1, numFailedTests: 0, testResults: [] })}`

describe('createNebiusSandbox.runTests', () => {
  it('uploads the files, forks the checkpoint without network and parses the report', async () => {
    const api = fakeApi(passing)
    const sandbox = createNebiusSandbox({ apiKey: 'k', project: 'p', baseUrl: BASE, fetch: api.fetch, pollIntervalMs: 0 })
    const report = await sandbox.runTests('img-base', [
      { path: 'src/connector.ts', content: 'export {}' },
      { path: 'src/connector.test.ts', content: 'test' },
      { path: 'README.md', content: '# not uploaded' },
    ], () => {})

    expect(report).toMatchObject({ typecheckOk: true, passed: 1, failed: 0, ranOn: 'nebius-sandbox:op-1' })
    for (const call of api.calls) {
      expect(call.headers.get('authorization')).toBe('Bearer k')
      expect(call.headers.get('project')).toBe('p')
    }
    expect(api.calls.filter((c) => c.path === '/files')).toHaveLength(3)
    const spawn = api.calls.find((c) => c.path === '/instances')?.body as Record<string, any>
    expect(spawn).toMatchObject({ image: 'img-base', shell: true, disposable: true, networking: { enabled: false } })
    expect(Object.keys(spawn.files)).toEqual(['/work/tsconfig.json', '/work/src/connector.ts', '/work/src/connector.test.ts'])
  })

  it('reuses a configured checkpoint instead of preparing a new one', async () => {
    const api = fakeApi(passing)
    const sandbox = createNebiusSandbox({ apiKey: 'k', project: 'p', baseUrl: BASE, preparedImage: 'img-ready', fetch: api.fetch })
    await expect(sandbox.prepare(() => {})).resolves.toBe('img-ready')
    expect(api.fetch).not.toHaveBeenCalled()
  })

  it('reports API errors with status and path', async () => {
    const fetch = vi.fn(async () => json({ error: 'forbidden' }, 403))
    const sandbox = createNebiusSandbox({ apiKey: 'k', project: 'p', baseUrl: BASE, fetch })
    await expect(sandbox.runTests('img', [{ path: 'src/a.ts', content: '' }], () => {})).rejects.toThrow('Sandbox POST /files: HTTP 403')
  })
})

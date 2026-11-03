import { describe, expect, it } from 'vitest'
import { probeRemote } from './remote'

/**
 * authToken plumbing: when the user passes --auth <token>, the probe should
 * send Authorization: Bearer <token> on every request so it can walk past
 * an auth gate instead of reporting "auth-walled, not audited".
 */

function makeFetch(record: Array<{ url: string; headers: Record<string, string> }>, responses: Record<string, { status: number; body: unknown; ct?: string }>): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const headers: Record<string, string> = {}
    if (init?.headers) {
      const h = init.headers as Record<string, string>
      for (const k of Object.keys(h)) headers[k.toLowerCase()] = h[k]!
    }
    record.push({ url, headers })

    const key = Object.keys(responses).find((k) => url.includes(k)) ?? ''
    const resp = responses[key] ?? { status: 404, body: {} }
    const bodyStr = typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body)
    return new Response(bodyStr, {
      status: resp.status,
      headers: { 'content-type': resp.ct ?? 'application/json' },
    })
  }) as typeof fetch
}

describe('probeRemote with authToken', () => {
  it('sends Authorization: Bearer <token> on initialize when authToken set', async () => {
    const record: Array<{ url: string; headers: Record<string, string> }> = []
    const fetchImpl = makeFetch(record, {
      '/mcp': {
        status: 200,
        body: { result: { tools: [{ name: 'get_user' }] } },
        ct: 'application/json',
      },
    })

    await probeRemote('https://example.test/mcp', { fetchImpl, authToken: 'my-secret-123' })

    const mcpCalls = record.filter((r) => r.url.includes('/mcp'))
    expect(mcpCalls.length).toBeGreaterThan(0)
    for (const call of mcpCalls) {
      expect(call.headers.authorization).toBe('Bearer my-secret-123')
    }
  })

  it('sends no Authorization header when authToken absent', async () => {
    const record: Array<{ url: string; headers: Record<string, string> }> = []
    const fetchImpl = makeFetch(record, {
      '/mcp': {
        status: 200,
        body: { result: { tools: [] } },
      },
    })

    await probeRemote('https://example.test/mcp', { fetchImpl })

    const mcpCalls = record.filter((r) => r.url.includes('/mcp'))
    for (const call of mcpCalls) {
      expect(call.headers.authorization).toBeUndefined()
    }
  })

  it('passes through authToken to well-known fetches too', async () => {
    const record: Array<{ url: string; headers: Record<string, string> }> = []
    const fetchImpl = makeFetch(record, {
      '/mcp': { status: 200, body: { result: { tools: [] } } },
      '/.well-known/oauth-protected-resource': { status: 200, body: { resource: 'https://example.test' } },
      '/.well-known/oauth-authorization-server': { status: 200, body: {} },
      '/.well-known/ai-catalog.json': { status: 404, body: {} },
    })

    await probeRemote('https://example.test/mcp', { fetchImpl, authToken: 'tok' })

    const wkCalls = record.filter((r) => r.url.includes('/.well-known/'))
    expect(wkCalls.length).toBeGreaterThan(0)
    for (const call of wkCalls) {
      expect(call.headers.authorization).toBe('Bearer tok')
    }
  })

  it('marks acceptedAuthHeader=bearer when authToken + tools/list succeeds', async () => {
    const record: Array<{ url: string; headers: Record<string, string> }> = []
    const fetchImpl = makeFetch(record, {
      '/mcp': {
        status: 200,
        body: { result: { tools: [{ name: 'get_user' }] } },
      },
    })

    const snap = await probeRemote('https://example.test/mcp', { fetchImpl, authToken: 'tok' })
    expect(snap.remote?.toolsListOk).toBe(true)
    expect(snap.remote?.acceptedAuthHeader).toBe('bearer')
  })

  it('does not run the junk-token scheme probe when a real token is supplied', async () => {
    // If the real-token flow fell through to the scheme probe, we'd see a
    // request with Authorization: Bearer patchbay-probe-token on the record.
    const record: Array<{ url: string; headers: Record<string, string> }> = []
    const fetchImpl = makeFetch(record, {
      '/mcp': { status: 200, body: { result: { tools: [] } } },
    })

    await probeRemote('https://example.test/mcp', { fetchImpl, authToken: 'real-token' })

    const junkProbe = record.find((r) => r.headers.authorization === 'Bearer patchbay-probe-token')
    expect(junkProbe).toBeUndefined()
  })
})

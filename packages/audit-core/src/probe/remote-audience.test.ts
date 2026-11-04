import { describe, expect, it } from 'vitest'
import { probeRemote } from './remote'

/**
 * probe integration for AUDIENCE-001: when probeAudienceToken is set,
 * the probe sends tools/list with that token and records the outcome
 * on probe.audienceProbe.
 */

interface RecordedCall {
  url: string
  headers: Record<string, string>
  body?: unknown
}

function makeFetch(record: RecordedCall[], responder: (call: RecordedCall) => { status: number; body?: unknown; ct?: string }): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const headers: Record<string, string> = {}
    if (init?.headers) {
      const h = init.headers as Record<string, string>
      for (const k of Object.keys(h)) headers[k.toLowerCase()] = h[k]!
    }
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    const call = { url, headers, body }
    record.push(call)
    const resp = responder(call)
    return new Response(JSON.stringify(resp.body ?? {}), {
      status: resp.status,
      headers: { 'content-type': resp.ct ?? 'application/json' },
    })
  }) as typeof fetch
}

describe('probeRemote with probeAudienceToken', () => {
  it('does not send any audience probe when probeAudienceToken is absent', async () => {
    const record: RecordedCall[] = []
    const fetchImpl = makeFetch(record, () => ({
      status: 200,
      body: { result: { tools: [{ name: 'get' }] } },
    }))

    await probeRemote('https://example.test/mcp', { fetchImpl })

    const hasProbeToken = record.some((r) => r.headers.authorization === 'Bearer wrong-aud-token')
    expect(hasProbeToken).toBe(false)
  })

  it('sends tools/list with the probe audience token when supplied', async () => {
    const record: RecordedCall[] = []
    const fetchImpl = makeFetch(record, () => ({
      status: 200,
      body: { result: { tools: [{ name: 'get' }] } },
    }))

    await probeRemote('https://example.test/mcp', {
      fetchImpl,
      probeAudienceToken: 'wrong-aud-token',
    })

    const probeCall = record.find((r) => r.headers.authorization === 'Bearer wrong-aud-token')
    expect(probeCall).toBeTruthy()
    expect(probeCall!.body).toMatchObject({ method: 'tools/list' })
  })

  it('records outcome=accepted when the server returns 2xx with streamable body', async () => {
    const record: RecordedCall[] = []
    const fetchImpl = makeFetch(record, (call) => {
      if (call.headers.authorization === 'Bearer wrong-aud-token') {
        return { status: 200, body: { result: { tools: [{ name: 'get' }] } } }
      }
      return { status: 200, body: { result: { tools: [{ name: 'get' }] } } }
    })

    const snap = await probeRemote('https://example.test/mcp', {
      fetchImpl,
      probeAudienceToken: 'wrong-aud-token',
    })

    expect(snap.remote?.audienceProbe?.attempted).toBe(true)
    expect(snap.remote?.audienceProbe?.outcome).toBe('accepted')
    expect(snap.remote?.audienceProbe?.httpStatus).toBe(200)
  })

  it('records outcome=rejected when the server returns 401', async () => {
    const record: RecordedCall[] = []
    const fetchImpl = makeFetch(record, (call) => {
      if (call.headers.authorization === 'Bearer wrong-aud-token') return { status: 401 }
      return { status: 200, body: { result: { tools: [{ name: 'get' }] } } }
    })

    const snap = await probeRemote('https://example.test/mcp', {
      fetchImpl,
      probeAudienceToken: 'wrong-aud-token',
    })

    expect(snap.remote?.audienceProbe?.outcome).toBe('rejected')
    expect(snap.remote?.audienceProbe?.httpStatus).toBe(401)
  })

  it('records outcome=rejected when the server returns 403', async () => {
    const fetchImpl = makeFetch([], (call) => {
      if (call.headers.authorization === 'Bearer wrong-aud-token') return { status: 403 }
      return { status: 200, body: { result: { tools: [{ name: 'get' }] } } }
    })

    const snap = await probeRemote('https://example.test/mcp', {
      fetchImpl,
      probeAudienceToken: 'wrong-aud-token',
    })

    expect(snap.remote?.audienceProbe?.outcome).toBe('rejected')
  })

  it('records outcome=inconclusive on unexpected status', async () => {
    const fetchImpl = makeFetch([], (call) => {
      if (call.headers.authorization === 'Bearer wrong-aud-token') return { status: 500 }
      return { status: 200, body: { result: { tools: [{ name: 'get' }] } } }
    })

    const snap = await probeRemote('https://example.test/mcp', {
      fetchImpl,
      probeAudienceToken: 'wrong-aud-token',
    })

    expect(snap.remote?.audienceProbe?.outcome).toBe('inconclusive')
    expect(snap.remote?.audienceProbe?.reason).toContain('500')
  })
})

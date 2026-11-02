import type { RemoteProbe, TargetSnapshot } from '../types'

export interface RemoteProbeOptions {
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export async function probeRemote(url: string, opts: RemoteProbeOptions = {}): Promise<TargetSnapshot> {
  const timeoutMs = opts.timeoutMs ?? 5000
  const f = opts.fetchImpl ?? fetch
  const errors: string[] = []

  const probe: RemoteProbe = {
    url,
    reachable: false,
    usesTls: url.startsWith('https://'),
    initializeOk: false,
    toolsListOk: false,
    authRequired: false,
    acceptedAuthHeader: 'none',
    tools: [],
    originValidation: 'unknown',
    rawErrors: errors,
  }

  const call = async (body: unknown, headers: Record<string, string> = {}): Promise<Response | null> => {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), timeoutMs)
    try {
      return await f(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: ctl.signal,
      })
    } catch (e) {
      errors.push(`fetch ${url}: ${(e as Error).message}`)
      return null
    } finally {
      clearTimeout(t)
    }
  }

  const initRes = await call({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'patchbay-audit', version: '0.1.0' } } })
  if (initRes) {
    probe.reachable = true
    probe.initializeOk = initRes.ok
    if (initRes.status === 401 || initRes.status === 403) probe.authRequired = true
  }

  const listRes = await call({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
  if (listRes && listRes.ok) {
    probe.toolsListOk = true
    try {
      const j = (await listRes.json()) as { result?: { tools?: Array<{ name: string; description?: string }> } }
      probe.tools = j.result?.tools ?? []
    } catch (e) {
      errors.push(`tools/list parse: ${(e as Error).message}`)
    }
  } else if (listRes && (listRes.status === 401 || listRes.status === 403)) {
    probe.authRequired = true
  }

  if (probe.authRequired) {
    const bearer = await call({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} }, { authorization: 'Bearer patchbay-probe-token' })
    if (bearer && bearer.status !== 401 && bearer.status !== 403) probe.acceptedAuthHeader = 'bearer'
    if (probe.acceptedAuthHeader === 'none') {
      const apiKey = await call({ jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} }, { 'x-api-key': 'patchbay-probe-key' })
      if (apiKey && apiKey.status !== 401 && apiKey.status !== 403) probe.acceptedAuthHeader = 'api-key'
    }
  }

  const base = new URL(url)
  const wellKnown = async (path: string) => {
    try {
      const r = await f(new URL(path, base).toString(), { method: 'GET', signal: AbortSignal.timeout(timeoutMs) })
      if (!r.ok) return undefined
      return (await r.json()) as Record<string, unknown>
    } catch (e) {
      errors.push(`${path}: ${(e as Error).message}`)
      return undefined
    }
  }
  probe.oauthProtectedResource = await wellKnown('/.well-known/oauth-protected-resource')
  probe.oauthAuthServer = await wellKnown('/.well-known/oauth-authorization-server')

  return {
    kind: 'remote-url',
    target: url,
    remote: probe,
    capturedAt: new Date().toISOString(),
  }
}

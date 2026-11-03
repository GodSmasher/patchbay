import { detectPublicByDesign } from './ai-catalog'
import type { RemoteProbe, TargetSnapshot, Transport } from '../types'

export interface RemoteProbeOptions {
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

const MCP_ACCEPT = 'application/json, text/event-stream'
const CLIENT_INFO = { name: 'patchbay-audit', version: '0.1.0' }
const INITIALIZE_BODY = {
  jsonrpc: '2.0' as const,
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: CLIENT_INFO },
}

export async function probeRemote(url: string, opts: RemoteProbeOptions = {}): Promise<TargetSnapshot> {
  const timeoutMs = opts.timeoutMs ?? 5000
  const f = opts.fetchImpl ?? fetch
  const errors: string[] = []

  const probe: RemoteProbe = {
    url,
    reachable: false,
    usesTls: url.startsWith('https://'),
    transport: 'unknown',
    initializeOk: false,
    toolsListOk: false,
    authRequired: false,
    acceptedAuthHeader: 'none',
    tools: [],
    originValidation: 'unknown',
    redirectLocalhostInconsistent: false,
    rawErrors: errors,
  }

  const postRpc = async (endpoint: string, body: unknown, headers: Record<string, string> = {}): Promise<Response | null> => {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), timeoutMs)
    try {
      return await f(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: MCP_ACCEPT, ...headers },
        body: JSON.stringify(body),
        signal: ctl.signal,
      })
    } catch (e) {
      errors.push(`POST ${endpoint}: ${(e as Error).message}`)
      return null
    } finally {
      clearTimeout(t)
    }
  }

  const getEventStream = async (endpoint: string): Promise<Response | null> => {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), timeoutMs)
    try {
      return await f(endpoint, {
        method: 'GET',
        headers: { accept: 'text/event-stream' },
        signal: ctl.signal,
      })
    } catch (e) {
      errors.push(`GET ${endpoint}: ${(e as Error).message}`)
      return null
    } finally {
      clearTimeout(t)
    }
  }

  const streamOk = (res: Response | null): boolean => {
    if (!res || !res.ok) return false
    const ct = res.headers.get('content-type') ?? ''
    return ct.includes('application/json') || ct.includes('text/event-stream')
  }

  const candidates = pathCandidates(url)
  let endpoint: string | undefined
  let initRes: Response | null = null

  for (const candidate of candidates) {
    const res = await postRpc(candidate, INITIALIZE_BODY)
    if (!res) continue
    if (res.status === 401 || res.status === 403) {
      endpoint = candidate
      probe.reachable = true
      probe.authRequired = true
      initRes = res
      break
    }
    if (streamOk(res)) {
      endpoint = candidate
      probe.reachable = true
      probe.transport = 'streamable-http'
      probe.initializeOk = true
      initRes = res
      break
    }
    if (res.status < 500 && res.status !== 404) {
      endpoint = candidate
      probe.reachable = true
      initRes = res
      break
    }
  }

  if (!endpoint) {
    for (const candidate of candidates) {
      const res = await getEventStream(candidate)
      if (!res) continue
      const ct = res.headers.get('content-type') ?? ''
      if (res.ok && ct.includes('text/event-stream')) {
        endpoint = candidate
        probe.reachable = true
        probe.transport = 'legacy-sse'
        break
      }
      if (res.status === 401 || res.status === 403) {
        endpoint = candidate
        probe.reachable = true
        probe.authRequired = true
        break
      }
    }
  }

  probe.effectiveEndpoint = endpoint

  if (endpoint && !probe.authRequired && probe.transport !== 'legacy-sse') {
    const listRes = await postRpc(endpoint, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
    if (listRes && listRes.ok && streamOk(listRes)) {
      probe.toolsListOk = true
      probe.tools = await parseTools(listRes, errors)
    } else if (listRes && (listRes.status === 401 || listRes.status === 403)) {
      probe.authRequired = true
    }
  }

  if (endpoint && probe.authRequired) {
    const bearer = await postRpc(endpoint, { jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} }, { authorization: 'Bearer patchbay-probe-token' })
    if (bearer && bearer.ok && streamOk(bearer)) probe.acceptedAuthHeader = 'bearer'
    if (probe.acceptedAuthHeader === 'none') {
      const apiKey = await postRpc(endpoint, { jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} }, { 'x-api-key': 'patchbay-probe-key' })
      if (apiKey && apiKey.ok && streamOk(apiKey)) probe.acceptedAuthHeader = 'api-key'
    }
  }

  const base = new URL(url)
  const wellKnown = async (path: string): Promise<Record<string, unknown> | undefined> => {
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

  const aiCatalog = await wellKnown('/.well-known/ai-catalog.json')
  if (aiCatalog) {
    probe.aiCatalog = aiCatalog
    const designation = detectPublicByDesign(aiCatalog)
    if (designation) {
      probe.publicByDesign = true
      probe.publicByDesignEvidence = designation.evidence
    }
  }

  if (endpoint) {
    const originSpoof = await postRpc(endpoint, { jsonrpc: '2.0', id: 5, method: 'tools/list', params: {} }, { origin: 'https://attacker.example' })
    if (originSpoof) {
      if (originSpoof.status === 403 || originSpoof.status === 400) probe.originValidation = 'strict'
      else if (streamOk(originSpoof)) probe.originValidation = 'permissive'
    }
  }

  const authServer = probe.oauthAuthServer
  if (authServer && typeof authServer === 'object') {
    const tokenEndpoint = typeof authServer.token_endpoint === 'string' ? authServer.token_endpoint : undefined
    if (tokenEndpoint) {
      const probeRedirect = async (uri: string): Promise<number | null> => {
        try {
          const r = await f(tokenEndpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'authorization_code', code: 'patchbay-probe', redirect_uri: uri, client_id: 'patchbay-probe' }).toString(),
            signal: AbortSignal.timeout(timeoutMs),
          })
          return r.status
        } catch (e) {
          errors.push(`redirect probe ${uri}: ${(e as Error).message}`)
          return null
        }
      }
      const sLocal = await probeRedirect('http://localhost:1234/cb')
      const sLoop = await probeRedirect('http://127.0.0.1:1234/cb')
      if (sLocal !== null && sLoop !== null && sLocal !== sLoop) {
        probe.redirectLocalhostInconsistent = true
      }
    }
  }

  void initRes

  return {
    kind: 'remote-url',
    target: url,
    remote: probe,
    capturedAt: new Date().toISOString(),
  }
}

function pathCandidates(url: string): string[] {
  const u = new URL(url)
  const base = `${u.protocol}//${u.host}`
  const given = u.pathname.replace(/\/+$/, '') || '/'
  const seen = new Set<string>()
  const push = (p: string) => {
    const full = p === '/' ? `${base}/` : `${base}${p}`
    if (!seen.has(full)) seen.add(full)
  }
  push(given)
  if (!given.endsWith('/mcp')) push(`${given === '/' ? '' : given}/mcp`)
  if (!given.endsWith('/sse')) push(`${given === '/' ? '' : given}/sse`)
  if (!given.endsWith('/messages')) push(`${given === '/' ? '' : given}/messages`)
  if (given !== '/') push('/mcp')
  if (given !== '/') push('/sse')
  if (given !== '/') push('/')
  return [...seen]
}

async function parseTools(res: Response, errors: string[]): Promise<RemoteProbe['tools']> {
  const ct = res.headers.get('content-type') ?? ''
  try {
    if (ct.includes('text/event-stream')) {
      const text = await res.text()
      for (const line of text.split('\n')) {
        if (!line.startsWith('data:')) continue
        try {
          const j = JSON.parse(line.slice(5).trim()) as { result?: { tools?: Array<{ name: string }> } }
          if (j.result?.tools) return j.result.tools
        } catch {}
      }
      return []
    }
    const j = (await res.json()) as { result?: { tools?: Array<{ name: string }> } }
    return j.result?.tools ?? []
  } catch (e) {
    errors.push(`tools/list parse: ${(e as Error).message}`)
    return []
  }
}

export { pathCandidates }

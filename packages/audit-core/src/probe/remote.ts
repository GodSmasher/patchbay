import { detectPublicByDesign } from './ai-catalog'
import { diffManifest, serverIdFromUrl } from '../lib/manifest'
import { fileManifestStore, makeEntry, type ManifestStore } from '../lib/manifest-store'
import type { HeadlessOauthResult, HeadlessProbeOutcome, RemoteProbe, TargetSnapshot, Transport } from '../types'

export interface RemoteProbeOptions {
  timeoutMs?: number
  fetchImpl?: typeof fetch
  /**
   * Bearer token to use on all probe requests. When set, the probe audits
   * the server as an authenticated client rather than reporting
   * "auth-walled, not audited". The token is sent as
   * `Authorization: Bearer <token>` on every HTTP call made by the probe.
   */
  authToken?: string
  /**
   * Manifest store for MANIFEST-001 (pin on first scan, diff on subsequent).
   * Defaults to ~/.patchbay/manifests/ on disk. Pass a memoryManifestStore()
   * for tests.
   */
  manifestStore?: ManifestStore
  /**
   * When true, overwrite the pinned manifest with the current tool list
   * instead of diffing. Use after a legitimate server update.
   */
  trustCurrentManifest?: boolean
  /**
   * Bearer token MINTED FOR A DIFFERENT RESOURCE on the same authorisation
   * server as this MCP endpoint. Used by AUDIENCE-001 to verify that the
   * server rejects cross-audience tokens per RFC 8707 Section 2.
   *
   * If the server accepts tools/list with this token, it is not validating
   * the `aud` claim and AUDIENCE-001 fires critical.
   */
  probeAudienceToken?: string
  /**
   * Bearer token whose JWT payload contains NO `aud` claim at all. Used
   * by AUDIENCE-002 to catch the early-exit validation bug
   * `if (aud && aud !== me) reject` which lets missing-aud tokens
   * through. See Issue #5.
   */
  probeMissingAudToken?: string
  /**
   * When true, AUTH-006 actively registers a throw-away client against the
   * authorisation server's registration_endpoint with loopback redirect URIs
   * ("http://127.0.0.1:PORT/callback" and "http://localhost:PORT/callback")
   * to verify RFC 8252 Section 7.3 compliance. Off by default because it
   * writes to the AS. Flip on for full-fidelity audits.
   */
  probeDcrLoopback?: boolean
  /**
   * When true, the audit opts into an active OAuth 2.1 conformance
   * battery against the server's authorization_endpoint. Registers a
   * throw-away client via DCR, then sends four authorize requests
   * crafted to violate OAuth 2.1 requirements (missing PKCE, plain PKCE,
   * implicit grant, unregistered redirect_uri) and records whether the
   * server rejected each one.
   *
   * Powers PKCE-001, PKCE-002, IMPLICIT-001, REDIRECT-002.
   * Off by default because it writes to the AS registration_endpoint.
   */
  probeHeadlessOauth?: boolean
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
  const authedHeaders: Record<string, string> = opts.authToken
    ? { authorization: `Bearer ${opts.authToken}` }
    : {}

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
        headers: { 'content-type': 'application/json', accept: MCP_ACCEPT, ...authedHeaders, ...headers },
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
        headers: { accept: 'text/event-stream', ...authedHeaders },
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

  if (initRes) {
    const headers: Record<string, string> = {}
    initRes.headers.forEach((value, key) => { headers[key.toLowerCase()] = value })
    probe.responseHeaders = headers
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

  if (opts.authToken && probe.toolsListOk) {
    // User supplied a real bearer token and it got us to tools/list. We know
    // the scheme already; no need to run the junk-token scheme probe (which
    // would carry our real token in authedHeaders anyway and give a confusing
    // result).
    probe.acceptedAuthHeader = 'bearer'
  } else if (endpoint && probe.authRequired) {
    const bearer = await postRpc(endpoint, { jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} }, { authorization: 'Bearer patchbay-probe-token' })
    if (bearer && bearer.ok && streamOk(bearer)) probe.acceptedAuthHeader = 'bearer'
    if (bearer && !(bearer.ok && streamOk(bearer))) {
      probe.invalidTokenStatus = bearer.status
      probe.invalidTokenWwwAuthenticate = bearer.headers.get('www-authenticate') ?? undefined
    }
    if (probe.acceptedAuthHeader === 'none') {
      const apiKey = await postRpc(endpoint, { jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} }, { 'x-api-key': 'patchbay-probe-key' })
      if (apiKey && apiKey.ok && streamOk(apiKey)) probe.acceptedAuthHeader = 'api-key'
    }
  }

  const base = new URL(url)
  const wellKnown = async (path: string): Promise<Record<string, unknown> | undefined> => {
    try {
      const r = await f(new URL(path, base).toString(), { method: 'GET', headers: authedHeaders, signal: AbortSignal.timeout(timeoutMs) })
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

  if (opts.probeDcrLoopback && authServer && typeof authServer === 'object') {
    const regEndpoint = typeof authServer.registration_endpoint === 'string' ? authServer.registration_endpoint : undefined
    if (!regEndpoint) {
      probe.dcrLoopback = { attempted: true, outcome: 'no-endpoint' }
    } else {
      const port = 33418
      try {
        const r = await f(regEndpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...authedHeaders },
          body: JSON.stringify({
            client_name: 'patchbay-loopback-probe',
            redirect_uris: [
              `http://127.0.0.1:${port}/callback`,
              `http://localhost:${port}/callback`,
            ],
            token_endpoint_auth_method: 'none',
            grant_types: ['authorization_code'],
            response_types: ['code'],
            application_type: 'native',
          }),
          signal: AbortSignal.timeout(timeoutMs),
        })
        if (r.status >= 200 && r.status < 300) {
          probe.dcrLoopback = { attempted: true, outcome: 'accepted', httpStatus: r.status }
        } else if (r.status === 400) {
          const bodyText = await r.text().catch(() => '')
          probe.dcrLoopback = {
            attempted: true,
            outcome: 'rejected',
            httpStatus: r.status,
            reason: bodyText.slice(0, 500),
          }
        } else {
          probe.dcrLoopback = {
            attempted: true,
            outcome: 'inconclusive',
            httpStatus: r.status,
            reason: `unexpected status ${r.status}`,
          }
        }
      } catch (e) {
        probe.dcrLoopback = {
          attempted: true,
          outcome: 'inconclusive',
          reason: (e as Error).message,
        }
        errors.push(`dcr loopback probe: ${(e as Error).message}`)
      }
    }
  }

  void initRes

  if (endpoint && opts.probeAudienceToken) {
    const probeToken = opts.probeAudienceToken
    const res = await postRpc(
      endpoint,
      { jsonrpc: '2.0', id: 6, method: 'tools/list', params: {} },
      { authorization: `Bearer ${probeToken}` },
    )
    if (!res) {
      probe.audienceProbe = { attempted: true, outcome: 'inconclusive', reason: 'network error' }
    } else if (res.status === 401 || res.status === 403) {
      probe.audienceProbe = { attempted: true, outcome: 'rejected', httpStatus: res.status }
    } else if (streamOk(res)) {
      probe.audienceProbe = { attempted: true, outcome: 'accepted', httpStatus: res.status }
    } else {
      probe.audienceProbe = {
        attempted: true,
        outcome: 'inconclusive',
        httpStatus: res.status,
        reason: `unexpected status ${res.status}`,
      }
    }
  }

  if (endpoint && opts.probeMissingAudToken) {
    const probeToken = opts.probeMissingAudToken
    const res = await postRpc(
      endpoint,
      { jsonrpc: '2.0', id: 7, method: 'tools/list', params: {} },
      { authorization: `Bearer ${probeToken}` },
    )
    if (!res) {
      probe.missingAudProbe = { attempted: true, outcome: 'inconclusive', reason: 'network error' }
    } else if (res.status === 401 || res.status === 403) {
      probe.missingAudProbe = { attempted: true, outcome: 'rejected', httpStatus: res.status }
    } else if (streamOk(res)) {
      probe.missingAudProbe = { attempted: true, outcome: 'accepted', httpStatus: res.status }
    } else {
      probe.missingAudProbe = {
        attempted: true,
        outcome: 'inconclusive',
        httpStatus: res.status,
        reason: `unexpected status ${res.status}`,
      }
    }
  }

  if (opts.probeHeadlessOauth && authServer && typeof authServer === 'object') {
    probe.headlessOauth = await runHeadlessOauthProbe(
      authServer as Record<string, unknown>,
      f,
      timeoutMs,
      authedHeaders,
      errors,
    )
  }

  if (probe.toolsListOk && probe.tools.length > 0) {
    try {
      const store = opts.manifestStore ?? fileManifestStore()
      const serverId = serverIdFromUrl(url)
      const pinned = store.load(serverId)
      const now = new Date()

      if (opts.trustCurrentManifest || !pinned) {
        store.save(makeEntry(serverId, probe.tools, now))
      } else {
        const delta = diffManifest(pinned, probe.tools)
        if (delta.changes.length > 0) {
          probe.manifestDelta = delta
        }
        store.save({ ...pinned, lastSeen: now.toISOString() })
      }
    } catch (e) {
      errors.push(`manifest store: ${(e as Error).message}`)
    }
  }

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

async function runHeadlessOauthProbe(
  authServer: Record<string, unknown>,
  f: typeof fetch,
  timeoutMs: number,
  authedHeaders: Record<string, string>,
  errors: string[],
): Promise<HeadlessOauthResult> {
  const authzEndpoint = typeof authServer.authorization_endpoint === 'string' ? authServer.authorization_endpoint : undefined
  const regEndpoint = typeof authServer.registration_endpoint === 'string' ? authServer.registration_endpoint : undefined

  const result: HeadlessOauthResult = {
    attempted: true,
    authorizationEndpoint: authzEndpoint,
    dcrOutcome: 'skipped',
  }

  if (!authzEndpoint) {
    result.dcrOutcome = 'skipped'
    result.dcrReason = 'authorization_endpoint missing from AS metadata'
    return result
  }

  if (!regEndpoint) {
    result.dcrOutcome = 'no-endpoint'
    return result
  }

  const registeredRedirect = 'http://127.0.0.1:33419/callback'
  let clientId: string | undefined
  try {
    const r = await f(regEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authedHeaders },
      body: JSON.stringify({
        client_name: 'patchbay-headless-oauth-probe',
        redirect_uris: [registeredRedirect],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code'],
        response_types: ['code'],
        application_type: 'native',
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (r.status >= 200 && r.status < 300) {
      const j = await r.json().catch(() => null) as { client_id?: string } | null
      if (j && typeof j.client_id === 'string') {
        clientId = j.client_id
        result.dcrOutcome = 'ok'
        result.dcrClientId = clientId
      } else {
        result.dcrOutcome = 'rejected'
        result.dcrReason = 'DCR 2xx without client_id in body'
        return result
      }
    } else {
      result.dcrOutcome = 'rejected'
      result.dcrReason = `DCR returned HTTP ${r.status}`
      return result
    }
  } catch (e) {
    result.dcrOutcome = 'network-error'
    result.dcrReason = (e as Error).message
    errors.push(`headless-oauth DCR: ${(e as Error).message}`)
    return result
  }

  const run = (params: Record<string, string>) => authorizeProbe(authzEndpoint, params, f, timeoutMs, errors)

  const baseChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
  const baseParams: Record<string, string> = {
    client_id: clientId,
    redirect_uri: registeredRedirect,
    response_type: 'code',
    state: 'patchbay-probe',
    scope: 'openid',
  }

  result.pkceMissing = await run({ ...baseParams })
  result.pkcePlain = await run({ ...baseParams, code_challenge: 'plaintext-challenge-value-123456', code_challenge_method: 'plain' })
  result.implicit = await run({ ...baseParams, response_type: 'token', code_challenge: baseChallenge, code_challenge_method: 'S256' })
  result.redirectMismatch = await run({
    ...baseParams,
    redirect_uri: 'https://attacker.example.com/callback',
    code_challenge: baseChallenge,
    code_challenge_method: 'S256',
  })

  return result
}

async function authorizeProbe(
  endpoint: string,
  params: Record<string, string>,
  f: typeof fetch,
  timeoutMs: number,
  errors: string[],
): Promise<HeadlessProbeOutcome> {
  const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}${new URLSearchParams(params).toString()}`
  try {
    const r = await f(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (r.status === 301 || r.status === 302 || r.status === 303 || r.status === 307 || r.status === 308) {
      const loc = r.headers.get('location') ?? ''
      const errorCode = extractErrorCode(loc)
      if (errorCode) {
        return { outcome: 'rejected', httpStatus: r.status, errorCode }
      }
      if (/[?#&]code=/.test(loc)) {
        return { outcome: 'accepted', httpStatus: r.status, reason: 'authorization code issued without user interaction' }
      }
      if (/[?#&]access_token=/.test(loc)) {
        return { outcome: 'accepted', httpStatus: r.status, reason: 'access token issued in fragment (implicit grant)' }
      }
      return { outcome: 'inconclusive', httpStatus: r.status, reason: `redirected to ${loc.slice(0, 200)}` }
    }

    if (r.status === 400 || r.status === 401 || r.status === 403) {
      const bodyText = await r.text().catch(() => '')
      const errorCode = extractErrorCodeFromBody(bodyText)
      return { outcome: 'rejected', httpStatus: r.status, errorCode, reason: bodyText.slice(0, 200) || undefined }
    }

    if (r.status === 200) {
      return { outcome: 'inconclusive', httpStatus: r.status, reason: 'consent-screen HTML; cannot tell without user action' }
    }

    return { outcome: 'inconclusive', httpStatus: r.status, reason: `unexpected status ${r.status}` }
  } catch (e) {
    errors.push(`headless-oauth probe: ${(e as Error).message}`)
    return { outcome: 'inconclusive', reason: (e as Error).message }
  }
}

function extractErrorCode(location: string): string | undefined {
  const m = location.match(/[?#&]error=([^&]+)/)
  if (!m || !m[1]) return undefined
  try { return decodeURIComponent(m[1]) } catch { return m[1] }
}

function extractErrorCodeFromBody(body: string): string | undefined {
  try {
    const j = JSON.parse(body) as { error?: unknown }
    if (typeof j.error === 'string') return j.error
  } catch {}
  return undefined
}

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
  /**
   * When true, the probe calls tools/call on the first few tools whose
   * annotations claim read-only + non-destructive AND whose input
   * schema requires no arguments. Powers POISONING-003: a server can
   * ship a tool whose RESULT contains prompt-injection payloads that
   * never show up in the tool catalog. Off by default — tool invocation
   * has side effects even on "safe" tools (rate limits, audit logs,
   * cost) and should only be run against servers you own or against
   * the patchbay demo.
   */
  probeToolCalls?: boolean
  /**
   * Public-metadata-only mode. The probe fetches the well-known OAuth
   * metadata documents, HEAD + initial GET on the MCP endpoint, and
   * records response headers — but does NOT send `tools/list` or any
   * other post-initialize request. Intended for third-party crawls
   * where we want to respect auth walls completely while still grading
   * the public metadata posture. Overrides probeDcrLoopback and
   * probeHeadlessOauth, both of which are forced off in this mode.
   */
  metadataOnly?: boolean
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
      // Capture advertised server capabilities + protocolVersion for
      // SAMPLING-001 / DEPRECATED-001. Clone the response so the later
      // tools/list code path can still consume the body.
      try {
        const cloned = res.clone()
        const initResult = await parseJsonRpcResult<{ capabilities?: Record<string, unknown>; protocolVersion?: string; serverInfo?: { name?: string; version?: string } }>(cloned, errors, 'initialize')
        if (initResult?.capabilities && typeof initResult.capabilities === 'object') {
          probe.advertisedCapabilities = initResult.capabilities
        }
        if (typeof initResult?.protocolVersion === 'string') {
          probe.protocolVersion = initResult.protocolVersion
        }
        // Server-identification fingerprint — powers SDK-CVE-001 /
        // SESSION-BINDING-001. Pulled from response headers plus the
        // initialize result's serverInfo. Everything is best-effort,
        // optional, and never required for the probe to succeed.
        probe.serverIdentification = {
          serverHeader: res.headers.get('server') ?? undefined,
          xPoweredBy: res.headers.get('x-powered-by') ?? undefined,
          mcpServerVersion: res.headers.get('mcp-server-version') ?? undefined,
          xMcpSdk: res.headers.get('x-mcp-sdk') ?? undefined,
          serverInfoName: typeof initResult?.serverInfo?.name === 'string' ? initResult.serverInfo.name : undefined,
          serverInfoVersion: typeof initResult?.serverInfo?.version === 'string' ? initResult.serverInfo.version : undefined,
        }
      } catch { /* best-effort */ }
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

  if (endpoint && !probe.authRequired && probe.transport !== 'legacy-sse' && !opts.metadataOnly) {
    const listRes = await postRpc(endpoint, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
    if (listRes && listRes.ok && streamOk(listRes)) {
      probe.toolsListOk = true
      probe.tools = await parseTools(listRes, errors)
    } else if (listRes && (listRes.status === 401 || listRes.status === 403)) {
      probe.authRequired = true
    }

    // resources/list + prompts/list are part of the standard MCP read-only
    // surface a client reaches on first contact. We also fetch resources/read
    // and prompts/get for the first few entries so POISONING-002 can scan
    // actual content, not just metadata. Both are gated on the same
    // "not auth-required, not legacy-sse, not metadata-only" conditions
    // as the tools/list call above.
    const resList = await postRpc(endpoint, { jsonrpc: '2.0', id: 20, method: 'resources/list', params: {} })
    if (resList && resList.ok && streamOk(resList)) {
      probe.resources = await parseResources(resList, errors)
      // Resource templates live under a separate endpoint; pull them so
      // URITEMPLATE-001 can scan them for path-traversal-shaped expansions.
      const tmplList = await postRpc(endpoint, { jsonrpc: '2.0', id: 25, method: 'resources/templates/list', params: {} })
      if (tmplList && tmplList.ok && streamOk(tmplList)) {
        const tpls = await parseResourceTemplates(tmplList, errors)
        probe.resources.push(...tpls)
      }
      // Fetch content for up to 5 resources. Larger fan-out would be rude
      // against third-party hosts; five is enough to cover a server's
      // "greeting", "system prompt" or "readme" resources where poisoning
      // tends to live.
      const toFetch = (probe.resources ?? []).slice(0, 5)
      for (let i = 0; i < toFetch.length; i++) {
        const r = toFetch[i]!
        if (!r.uri) continue
        const rd = await postRpc(endpoint, { jsonrpc: '2.0', id: 21 + i, method: 'resources/read', params: { uri: r.uri } })
        if (rd && rd.ok && streamOk(rd)) {
          r.contents = await parseResourceContents(rd, errors)
        }
      }
    }

    // POISONING-003: opt-in tool-call probe. Only invokes tools whose
    // annotations and input schema both signal "safe to call without
    // arguments" — read-only hint on, destructive hint off, required
    // input list empty. Caps at 3 calls per audit so a misclassified
    // safe tool can't blow a hole in the target's quota.
    if (opts.probeToolCalls && probe.tools.length > 0) {
      const callable = probe.tools.filter(isSafeToProbe).slice(0, 3)
      for (let i = 0; i < callable.length; i++) {
        const t = callable[i]!
        const callRes = await postRpc(endpoint, { jsonrpc: '2.0', id: 40 + i, method: 'tools/call', params: { name: t.name, arguments: {} } })
        if (callRes && callRes.ok && streamOk(callRes)) {
          const result = await parseJsonRpcResult<{ content?: Array<{ type?: string; text?: string }>; isError?: boolean }>(callRes, errors, 'tools/call ' + t.name)
          t.callProbe = {
            attempted: true,
            outcome: 'ok',
            content: result?.content ?? [],
            isError: result?.isError,
          }
        } else {
          t.callProbe = {
            attempted: true,
            outcome: 'error',
            reason: callRes ? 'HTTP ' + callRes.status : 'no response',
          }
        }
      }
    }

    const promptList = await postRpc(endpoint, { jsonrpc: '2.0', id: 30, method: 'prompts/list', params: {} })
    if (promptList && promptList.ok && streamOk(promptList)) {
      probe.prompts = await parsePrompts(promptList, errors)
      const toGet = (probe.prompts ?? []).slice(0, 5)
      for (let i = 0; i < toGet.length; i++) {
        const p = toGet[i]!
        if (!p.name) continue
        const pg = await postRpc(endpoint, { jsonrpc: '2.0', id: 31 + i, method: 'prompts/get', params: { name: p.name } })
        if (pg && pg.ok && streamOk(pg)) {
          p.messages = await parsePromptMessages(pg, errors)
        }
      }
    }
  }

  if (opts.authToken && probe.toolsListOk) {
    // User supplied a real bearer token and it got us to tools/list. We know
    // the scheme already; no need to run the junk-token scheme probe (which
    // would carry our real token in authedHeaders anyway and give a confusing
    // result).
    probe.acceptedAuthHeader = 'bearer'
  } else if (endpoint && probe.authRequired && !opts.metadataOnly) {
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

  if (opts.probeDcrLoopback && !opts.metadataOnly && authServer && typeof authServer === 'object') {
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

  if (endpoint && opts.probeAudienceToken && !opts.metadataOnly) {
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

  if (endpoint && opts.probeMissingAudToken && !opts.metadataOnly) {
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

  if (opts.probeHeadlessOauth && !opts.metadataOnly && authServer && typeof authServer === 'object') {
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
    // The JSON-RPC response's `result.tools` is an array of whatever the
    // server published — we want name, description, inputSchema AND
    // annotations (for ANNOTATIONS-001). Cast to the known shape so we
    // don't drop fields on the way through.
    type RawTool = { name: string; description?: string; inputSchema?: Record<string, unknown>; annotations?: Record<string, unknown> }
    const absorb = (list: RawTool[] | undefined): RemoteProbe['tools'] => list ?? []
    if (ct.includes('text/event-stream')) {
      const text = await res.text()
      for (const line of text.split('\n')) {
        if (!line.startsWith('data:')) continue
        try {
          const j = JSON.parse(line.slice(5).trim()) as { result?: { tools?: RawTool[] } }
          if (j.result?.tools) return absorb(j.result.tools)
        } catch {}
      }
      return []
    }
    const j = (await res.json()) as { result?: { tools?: RawTool[] } }
    return absorb(j.result?.tools)
  } catch (e) {
    errors.push(`tools/list parse: ${(e as Error).message}`)
    return []
  }
}

async function parseJsonRpcResult<T>(res: Response, errors: string[], label: string): Promise<T | undefined> {
  const ct = res.headers.get('content-type') ?? ''
  try {
    if (ct.includes('text/event-stream')) {
      const text = await res.text()
      for (const line of text.split('\n')) {
        if (!line.startsWith('data:')) continue
        try {
          const j = JSON.parse(line.slice(5).trim()) as { result?: T }
          if (j.result !== undefined) return j.result
        } catch {}
      }
      return undefined
    }
    const j = (await res.json()) as { result?: T }
    return j.result
  } catch (e) {
    errors.push(label + ' parse: ' + (e as Error).message)
    return undefined
  }
}

async function parseResources(res: Response, errors: string[]): Promise<NonNullable<RemoteProbe['resources']>> {
  const result = await parseJsonRpcResult<{ resources?: Array<Record<string, unknown>> }>(res, errors, 'resources/list')
  const list = result?.resources ?? []
  return list.map((r) => ({
    uri: typeof r.uri === 'string' ? r.uri : '',
    name: typeof r.name === 'string' ? r.name : undefined,
    description: typeof r.description === 'string' ? r.description : undefined,
    mimeType: typeof r.mimeType === 'string' ? r.mimeType : undefined,
  })).filter((r) => r.uri)
}

async function parseResourceTemplates(res: Response, errors: string[]): Promise<NonNullable<RemoteProbe['resources']>> {
  const result = await parseJsonRpcResult<{ resourceTemplates?: Array<Record<string, unknown>> }>(res, errors, 'resources/templates/list')
  const list = result?.resourceTemplates ?? []
  return list.map((r) => ({
    uri: typeof r.uriTemplate === 'string' ? r.uriTemplate : '',
    uriTemplate: typeof r.uriTemplate === 'string' ? r.uriTemplate : undefined,
    name: typeof r.name === 'string' ? r.name : undefined,
    description: typeof r.description === 'string' ? r.description : undefined,
    mimeType: typeof r.mimeType === 'string' ? r.mimeType : undefined,
  })).filter((r) => r.uriTemplate)
}

async function parseResourceContents(res: Response, errors: string[]): Promise<NonNullable<NonNullable<RemoteProbe['resources']>[number]['contents']>> {
  const result = await parseJsonRpcResult<{ contents?: Array<Record<string, unknown>> }>(res, errors, 'resources/read')
  const list = result?.contents ?? []
  return list.map((c) => ({
    uri: typeof c.uri === 'string' ? c.uri : undefined,
    mimeType: typeof c.mimeType === 'string' ? c.mimeType : undefined,
    text: typeof c.text === 'string' ? c.text : undefined,
  }))
}

async function parsePrompts(res: Response, errors: string[]): Promise<NonNullable<RemoteProbe['prompts']>> {
  const result = await parseJsonRpcResult<{ prompts?: Array<Record<string, unknown>> }>(res, errors, 'prompts/list')
  const list = result?.prompts ?? []
  return list.map((p) => ({
    name: typeof p.name === 'string' ? p.name : '',
    description: typeof p.description === 'string' ? p.description : undefined,
    arguments: Array.isArray(p.arguments) ? (p.arguments as Array<Record<string, unknown>>).map((a) => ({
      name: typeof a.name === 'string' ? a.name : undefined,
      description: typeof a.description === 'string' ? a.description : undefined,
      required: typeof a.required === 'boolean' ? a.required : undefined,
    })) : undefined,
  })).filter((p) => p.name)
}

async function parsePromptMessages(res: Response, errors: string[]): Promise<NonNullable<NonNullable<RemoteProbe['prompts']>[number]['messages']>> {
  const result = await parseJsonRpcResult<{ messages?: Array<Record<string, unknown>> }>(res, errors, 'prompts/get')
  const list = result?.messages ?? []
  return list.map((m) => {
    const content = m.content as Record<string, unknown> | undefined
    return {
      role: typeof m.role === 'string' ? m.role : undefined,
      content: content ? {
        type: typeof content.type === 'string' ? content.type : undefined,
        text: typeof content.text === 'string' ? content.text : undefined,
      } : undefined,
    }
  })
}

function isSafeToProbe(t: { name: string; annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean }; inputSchema?: Record<string, unknown> }): boolean {
  if (!t.annotations?.readOnlyHint) return false
  if (t.annotations.destructiveHint === true) return false
  // Reject names that look destructive even if hints say otherwise
  if (/(delete|drop|remove|purge|erase|wipe|destroy|send|transfer|pay|charge|refund|revoke|cancel|kill)/i.test(t.name)) return false
  // Require no required input arguments
  const required = (t.inputSchema as { required?: unknown } | undefined)?.required
  if (Array.isArray(required) && required.length > 0) return false
  return true
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
  }
  // Scope handling: hardcoding `openid` can backfire on servers that do not
  // advertise it — the AS then returns error=invalid_scope BEFORE evaluating
  // PKCE / response_type / redirect_uri, and all four probes read as
  // "rejected" even though the OAuth 2.1 violation was never tested. Prefer
  // the first scope the AS actually advertises in `scopes_supported`; fall
  // back to omitting `scope` entirely (the AS then applies its default).
  const scopesSupported = authServer.scopes_supported
  if (Array.isArray(scopesSupported) && typeof scopesSupported[0] === 'string') {
    baseParams.scope = scopesSupported[0]
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

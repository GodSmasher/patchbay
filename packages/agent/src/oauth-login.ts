/**
 * Browser-based OAuth 2.1 native app flow (RFC 8252) for `patchbay audit-oauth`.
 *
 * Given an MCP server URL that requires authentication, we:
 *   1. Discover PRM (RFC 9728) and AS metadata (RFC 8414).
 *   2. Register a transient public client via DCR (RFC 7591) if the AS supports it.
 *      Falls back to a user-supplied client_id when it does not.
 *   3. Open the user's browser at /authorize with PKCE S256, a fresh state,
 *      and the MCP URL as the RFC 8707 `resource` parameter.
 *   4. Serve a one-shot loopback HTTP listener on 127.0.0.1:<random> that
 *      catches the redirect and exits as soon as it has the code.
 *   5. Exchange the code at /token and return the bearer.
 *
 * Nothing persists. The DCR client, code_verifier and loopback port are
 * all throwaway, so a subsequent audit-oauth against the same server
 * registers a fresh client.
 */
import { createHash, randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { spawn } from 'node:child_process'
import { URL, URLSearchParams } from 'node:url'

export interface LoginResult {
  accessToken: string
  tokenType: string
  expiresIn?: number
  scope?: string
  clientId: string
  authServerIssuer: string
}

export interface LoginOptions {
  /** Explicit scope string. Default: first value in AS `scopes_supported`, else omitted. */
  scope?: string
  /** Pre-registered client id, bypasses DCR. */
  clientId?: string
  /** Max seconds to wait for the user to complete the browser flow. Default 300. */
  timeoutSeconds?: number
  /** Print discovery URLs and request shapes for debugging. */
  verbose?: boolean
  /** Override callback host. Default 127.0.0.1. Only loopback is allowed. */
  callbackHost?: '127.0.0.1' | '[::1]' | 'localhost'
  /** Skip opening the browser (print the URL and wait). Default false. */
  noOpen?: boolean
}

export async function loginAndGetToken(mcpUrl: string, opts: LoginOptions = {}): Promise<LoginResult> {
  const verbose = Boolean(opts.verbose)
  const log = (msg: string): void => { if (verbose) process.stderr.write('[audit-oauth] ' + msg + '\n') }

  const mcp = new URL(mcpUrl)

  // Step 1: PRM
  const prmUrl = new URL('/.well-known/oauth-protected-resource', mcp.origin).toString()
  log('PRM: ' + prmUrl)
  const prm = await fetchJson(prmUrl)
  const authServerIssuer = pickAuthServer(prm, mcp)
  log('authorization_servers[0]: ' + authServerIssuer)

  // Step 2: AS metadata
  const asMetadataUrl = asMetadataUrlFor(authServerIssuer)
  log('AS metadata: ' + asMetadataUrl)
  const as = await fetchJson(asMetadataUrl)
  const authzEndpoint = requireString(as, 'authorization_endpoint')
  const tokenEndpoint = requireString(as, 'token_endpoint')
  const registrationEndpoint = typeof as.registration_endpoint === 'string' ? as.registration_endpoint : undefined

  // Step 3: client registration
  let clientId = opts.clientId
  if (!clientId) {
    if (!registrationEndpoint) {
      throw new Error(
        'This AS does not advertise a registration_endpoint. Pass --client-id=<existing-id> ' +
        'or register a client manually before using audit-oauth.',
      )
    }
    log('DCR: ' + registrationEndpoint)
  }

  // Step 4: start loopback listener. We need the port before we can register
  // the redirect_uri or build the authorize URL, so bind first, read .address(),
  // then register with that URL.
  const host = opts.callbackHost ?? '127.0.0.1'
  const { server, url: redirectUri, waitForCode } = await startLoopbackListener(host)
  log('loopback: ' + redirectUri)

  try {
    if (!clientId) {
      const dcr = await fetchJson(registrationEndpoint!, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          client_name: 'patchbay audit-oauth',
          redirect_uris: [redirectUri],
          token_endpoint_auth_method: 'none',
          grant_types: ['authorization_code'],
          response_types: ['code'],
          application_type: 'native',
        }),
      })
      if (typeof dcr.client_id !== 'string') {
        throw new Error('DCR response missing client_id: ' + JSON.stringify(dcr).slice(0, 400))
      }
      clientId = dcr.client_id
      log('client_id: ' + clientId)
    }

    // Step 5: PKCE
    const codeVerifier = base64url(randomBytes(32))
    const codeChallenge = base64url(createHash('sha256').update(codeVerifier).digest())
    const state = base64url(randomBytes(16))

    // Step 6: authorize URL
    const authorizeUrl = new URL(authzEndpoint)
    authorizeUrl.searchParams.set('response_type', 'code')
    authorizeUrl.searchParams.set('client_id', clientId!)
    authorizeUrl.searchParams.set('redirect_uri', redirectUri)
    authorizeUrl.searchParams.set('state', state)
    authorizeUrl.searchParams.set('code_challenge', codeChallenge)
    authorizeUrl.searchParams.set('code_challenge_method', 'S256')
    authorizeUrl.searchParams.set('resource', mcp.toString())
    const scope = opts.scope ?? pickFirstScope(as)
    if (scope) authorizeUrl.searchParams.set('scope', scope)

    // Step 7: open browser (unless --no-open)
    if (!opts.noOpen) openUrl(authorizeUrl.toString())
    process.stderr.write(
      '\n  Waiting for browser login at ' + mcp.origin + ' ...\n' +
      '  If nothing opened, visit this URL:\n  ' + authorizeUrl.toString() + '\n\n',
    )

    // Step 8: wait for callback
    const timeoutMs = (opts.timeoutSeconds ?? 300) * 1000
    const callback = await waitForCode(timeoutMs, state)

    // Step 9: exchange code for token
    log('token exchange: ' + tokenEndpoint)
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: callback.code,
      redirect_uri: redirectUri,
      client_id: clientId!,
      code_verifier: codeVerifier,
      resource: mcp.toString(),
    })
    const tokenRes = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: body.toString(),
    })
    const tokenJson = await tokenRes.json().catch(() => ({})) as {
      access_token?: string; token_type?: string; expires_in?: number; scope?: string; error?: string; error_description?: string
    }
    if (!tokenRes.ok || typeof tokenJson.access_token !== 'string') {
      throw new Error('Token exchange failed (HTTP ' + tokenRes.status + '): ' + (tokenJson.error_description ?? tokenJson.error ?? JSON.stringify(tokenJson).slice(0, 300)))
    }
    log('token received (' + (tokenJson.token_type ?? 'bearer') + ', expires_in=' + (tokenJson.expires_in ?? '?') + ')')

    return {
      accessToken: tokenJson.access_token,
      tokenType: tokenJson.token_type ?? 'Bearer',
      expiresIn: tokenJson.expires_in,
      scope: tokenJson.scope,
      clientId: clientId!,
      authServerIssuer,
    }
  } finally {
    server.close()
  }
}

// --- helpers --------------------------------------------------------------

function pickAuthServer(prm: Record<string, unknown>, mcp: URL): string {
  const list = prm.authorization_servers
  if (Array.isArray(list) && typeof list[0] === 'string' && list[0].length) return list[0]
  // Fallback: assume AS lives at the MCP origin. Spec-noncompliant but common.
  return mcp.origin
}

function asMetadataUrlFor(issuer: string): string {
  // RFC 8414 non-standard-path handling: metadata lives at
  // <issuer>/.well-known/oauth-authorization-server, with the issuer's path
  // (if any) inserted after .well-known. For an issuer "https://as.example/tenant"
  // the metadata is at "https://as.example/.well-known/oauth-authorization-server/tenant".
  // When the issuer is bare origin, drop the trailing-slash case.
  const u = new URL(issuer)
  const prefix = u.origin + '/.well-known/oauth-authorization-server'
  const rest = u.pathname === '/' || u.pathname === '' ? '' : u.pathname
  return prefix + rest
}

function pickFirstScope(as: Record<string, unknown>): string | undefined {
  const s = as.scopes_supported
  if (Array.isArray(s) && typeof s[0] === 'string' && s[0].length) return s[0]
  return undefined
}

function requireString(obj: Record<string, unknown>, field: string): string {
  const v = obj[field]
  if (typeof v !== 'string' || !v) throw new Error('AS metadata missing required field "' + field + '"')
  return v
}

async function fetchJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const r = await fetch(url, init)
  if (!r.ok) throw new Error('Fetch ' + url + ' failed: HTTP ' + r.status)
  return (await r.json()) as Record<string, unknown>
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

interface LoopbackListener {
  server: Server
  url: string
  waitForCode(timeoutMs: number, expectedState: string): Promise<{ code: string }>
}

async function startLoopbackListener(host: string): Promise<LoopbackListener> {
  let resolveCallback: (v: { code: string }) => void = () => {}
  let rejectCallback: (e: Error) => void = () => {}
  const callback = new Promise<{ code: string }>((res, rej) => { resolveCallback = res; rejectCallback = rej })

  const server = createServer((req, res) => {
    if (!req.url || !req.url.startsWith('/callback')) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found')
      return
    }
    try {
      const u = new URL(req.url, 'http://localhost')
      const err = u.searchParams.get('error')
      if (err) {
        const desc = u.searchParams.get('error_description') ?? ''
        res.writeHead(400, { 'content-type': 'text/html' }).end(renderHtml(false, err + (desc ? ': ' + desc : '')))
        rejectCallback(new Error('Authorization error: ' + err + (desc ? ' - ' + desc : '')))
        return
      }
      const code = u.searchParams.get('code')
      const state = u.searchParams.get('state')
      if (!code) {
        res.writeHead(400, { 'content-type': 'text/html' }).end(renderHtml(false, 'Missing code parameter.'))
        rejectCallback(new Error('Missing code parameter in callback'))
        return
      }
      res.writeHead(200, { 'content-type': 'text/html' }).end(renderHtml(true, 'You can close this tab and return to the terminal.'))
      resolveCallback({ code })
      void state
    } catch (e) {
      res.writeHead(500, { 'content-type': 'text/plain' }).end((e as Error).message)
      rejectCallback(e as Error)
    }
  })

  await new Promise<void>((res) => server.listen(0, host, res))
  const addr = server.address()
  if (!addr || typeof addr !== 'object') throw new Error('Could not bind loopback listener')
  const port = addr.port
  // IPv6 literals need brackets in URLs. Node reports 127.0.0.1 as "127.0.0.1" and [::1] as "::1".
  const hostForUrl = host === '[::1]' || host === '::1' ? '[::1]' : host
  const url = 'http://' + hostForUrl + ':' + port + '/callback'

  return {
    server,
    url,
    waitForCode: async (timeoutMs: number, expectedState: string): Promise<{ code: string }> => {
      const timeout = new Promise<{ code: string }>((_, rej) =>
        setTimeout(() => rej(new Error('Timed out after ' + Math.round(timeoutMs / 1000) + 's waiting for browser callback')), timeoutMs),
      )
      const got = await Promise.race([callback, timeout])
      void expectedState
      return got
    },
  }
}

function renderHtml(ok: boolean, message: string): string {
  const color = ok ? '#15803d' : '#b91c1c'
  return '<!doctype html><meta charset="utf-8"><title>patchbay audit-oauth</title>' +
    '<body style="font:16px system-ui;max-width:520px;margin:4rem auto;padding:1rem;color:#111">' +
    '<h1 style="color:' + color + '">' + (ok ? 'Login complete' : 'Login failed') + '</h1>' +
    '<p>' + escapeHtml(message) + '</p>' +
    '<p style="color:#6b7280;font-size:14px">patchbay audit-oauth · you can close this tab</p>' +
    '</body>'
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function openUrl(url: string): void {
  const platform = process.platform
  try {
    if (platform === 'darwin') {
      spawn('open', [url], { stdio: 'ignore', detached: true }).unref()
    } else if (platform === 'win32') {
      // cmd /c start treats the first quoted arg as window title; pass "" as title.
      spawn('cmd', ['/c', 'start', '""', url], { stdio: 'ignore', detached: true }).unref()
    } else {
      spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref()
    }
  } catch { /* fall through; the stderr message tells the user to paste the URL manually */ }
}

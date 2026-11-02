import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { AddressInfo } from 'node:net'

export type FixtureMode = 'wide-open' | 'static-key' | 'oauth-good' | 'oauth-no-pkce' | 'oauth-permissive-origin' | 'oauth-redirect-inconsistent'

export interface FixtureServer {
  url: string
  close: () => Promise<void>
}

export async function startFixtureServer(mode: FixtureMode): Promise<FixtureServer> {
  const server = createServer((req, res) => handle(req, res, mode))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const addr = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${addr.port}/mcp`,
    close: () => stop(server),
  }
}

function stop(s: Server): Promise<void> {
  return new Promise((resolve) => s.close(() => resolve()))
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  })
}

async function handle(req: IncomingMessage, res: ServerResponse, mode: FixtureMode): Promise<void> {
  const url = req.url ?? '/'
  res.setHeader('content-type', 'application/json')

  if (url.startsWith('/.well-known/oauth-authorization-server')) {
    const meta = oauthMetadata(mode)
    if (!meta) { res.statusCode = 404; res.end(); return }
    res.end(JSON.stringify(meta))
    return
  }
  if (url.startsWith('/.well-known/oauth-protected-resource')) {
    if (mode === 'wide-open' || mode === 'static-key') { res.statusCode = 404; res.end(); return }
    res.end(JSON.stringify({ resource: `http://127.0.0.1/mcp`, authorization_servers: ['http://127.0.0.1/'] }))
    return
  }
  if (url.startsWith('/oauth/token')) {
    const body = await readBody(req)
    const params = new URLSearchParams(body)
    const redirect = params.get('redirect_uri') ?? ''
    if (mode === 'oauth-redirect-inconsistent' && redirect.includes('127.0.0.1')) {
      res.statusCode = 400; res.end(JSON.stringify({ error: 'invalid_redirect_uri' })); return
    }
    res.statusCode = 401
    res.end(JSON.stringify({ error: 'invalid_grant' }))
    return
  }

  if (url !== '/mcp') { res.statusCode = 404; res.end(); return }

  const origin = (req.headers.origin as string | undefined) ?? ''
  if ((mode === 'oauth-good' || mode === 'oauth-no-pkce') && origin && !origin.startsWith('http://127.0.0.1') && !origin.startsWith('http://localhost')) {
    res.statusCode = 403; res.end(JSON.stringify({ error: 'bad origin' })); return
  }

  const auth = (req.headers.authorization as string | undefined) ?? ''
  const apiKey = (req.headers['x-api-key'] as string | undefined) ?? ''

  const requireAuth = mode !== 'wide-open'
  if (requireAuth && !auth && !apiKey) { res.statusCode = 401; res.end(JSON.stringify({ error: 'auth required' })); return }
  if (mode === 'static-key' && !apiKey && !auth.toLowerCase().startsWith('bearer ')) {
    res.statusCode = 401; res.end(JSON.stringify({ error: 'auth required' })); return
  }

  const body = await readBody(req)
  let rpc: { id?: unknown; method?: string } = {}
  try { rpc = JSON.parse(body) as typeof rpc } catch { /* ignore */ }

  if (rpc.method === 'initialize') {
    res.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'fixture', version: '0.0.1' } } }))
    return
  }
  if (rpc.method === 'tools/list') {
    res.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: { tools: [{ name: 'get_user' }, { name: 'delete_user' }] } }))
    return
  }
  res.statusCode = 400
  res.end(JSON.stringify({ error: 'unknown method' }))
}

function oauthMetadata(mode: FixtureMode): Record<string, unknown> | undefined {
  if (mode === 'wide-open' || mode === 'static-key') return undefined
  const base = {
    issuer: 'http://127.0.0.1/',
    authorization_endpoint: 'http://127.0.0.1/oauth/authorize',
    token_endpoint: 'http://127.0.0.1/oauth/token',
    registration_endpoint: 'http://127.0.0.1/oauth/register',
    resource_indicators_supported: true,
    code_challenge_methods_supported: ['S256'],
  }
  if (mode === 'oauth-no-pkce') return { ...base, code_challenge_methods_supported: ['plain'] }
  return base
}

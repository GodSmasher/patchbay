import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { auditSnapshot } from '../index'
import { startFixtureServer, type FixtureServer } from './fixture-server'
import { probeRemote } from './remote'

describe('probeRemote integration', () => {
  let server: FixtureServer

  afterEach(async () => { if (server) await server.close() })

  it('flags wide-open MCP (AUTH-001)', async () => {
    server = await startFixtureServer('wide-open')
    const snap = await probeRemote(server.url, { timeoutMs: 2000 })
    expect(snap.remote!.toolsListOk).toBe(true)
    expect(snap.remote!.authRequired).toBe(false)
    const ids = auditSnapshot(snap).findings.map((f) => f.id)
    expect(ids).toContain('AUTH-001')
  })

  it('flags static-key server without OAuth discovery (AUTH-002)', async () => {
    server = await startFixtureServer('static-key')
    const snap = await probeRemote(server.url, { timeoutMs: 2000 })
    expect(snap.remote!.authRequired).toBe(true)
    expect(['bearer', 'api-key']).toContain(snap.remote!.acceptedAuthHeader)
    expect(snap.remote!.oauthAuthServer).toBeUndefined()
    const ids = auditSnapshot(snap).findings.map((f) => f.id)
    expect(ids).toContain('AUTH-002')
  })

  it('passes AUTH-003/004/005 when discovery is fully populated', async () => {
    server = await startFixtureServer('oauth-good')
    const snap = await probeRemote(server.url, { timeoutMs: 2000 })
    const ids = auditSnapshot(snap).findings.map((f) => f.id)
    expect(ids).not.toContain('AUTH-003')
    expect(ids).not.toContain('AUTH-004')
    expect(ids).not.toContain('AUTH-005')
  })

  it('flags AUTH-003 on plain-PKCE server', async () => {
    server = await startFixtureServer('oauth-no-pkce')
    const snap = await probeRemote(server.url, { timeoutMs: 2000 })
    const ids = auditSnapshot(snap).findings.map((f) => f.id)
    expect(ids).toContain('AUTH-003')
  })

  it('does NOT mark CDN/WAF HTML 403 as reachable MCP', async () => {
    // Serve plain HTML with a 403 — must not count as an MCP authwall.
    const http = await import('node:http')
    const instance = http.createServer((req, res) => {
      res.writeHead(403, { 'content-type': 'text/html' })
      res.end('<html><body><h1>Access Denied</h1></body></html>')
    })
    await new Promise<void>((r) => instance.listen(0, '127.0.0.1', r))
    const addr = instance.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0
    try {
      const snap = await probeRemote(`http://127.0.0.1:${port}/mcp`, { timeoutMs: 2000 })
      expect(snap.remote!.reachable).toBe(false)
    } finally {
      await new Promise<void>((r) => instance.close(() => r()))
    }
  })

  it('marks a JSON 401 body as reachable MCP authwall', async () => {
    // A 401 with a `{"error":"..."}` JSON body is a real MCP server guarding
    // tools/list behind creds. Must count as reachable + authRequired.
    const http = await import('node:http')
    const instance = http.createServer((req, res) => {
      res.writeHead(401, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'unauthorized' }))
    })
    await new Promise<void>((r) => instance.listen(0, '127.0.0.1', r))
    const addr = instance.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0
    try {
      const snap = await probeRemote(`http://127.0.0.1:${port}/mcp`, { timeoutMs: 2000 })
      expect(snap.remote!.reachable).toBe(true)
      expect(snap.remote!.authRequired).toBe(true)
    } finally {
      await new Promise<void>((r) => instance.close(() => r()))
    }
  })
})

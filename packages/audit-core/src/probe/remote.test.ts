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
})

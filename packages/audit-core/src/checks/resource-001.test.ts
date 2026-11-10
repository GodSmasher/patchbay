import { describe, expect, it } from 'vitest'
import { resource001 } from './resource-001'
import { remoteSnap } from './test-helpers'

describe('RESOURCE-001', () => {
  it('fires high when server uses OAuth but has no PRM document', () => {
    const findings = resource001.run(remoteSnap({
      authRequired: true,
      oauthAuthServer: { issuer: 'https://x' },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('high')
    expect(findings[0]?.title).toMatch(/No \/\.well-known\/oauth-protected-resource/)
  })

  it('fires high when PRM document is served but authorization_servers is missing', () => {
    const findings = resource001.run(remoteSnap({
      authRequired: true,
      oauthAuthServer: { issuer: 'https://x' },
      oauthProtectedResource: { resource: 'https://x/mcp' },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('high')
    expect(findings[0]?.title).toMatch(/missing authorization_servers/)
  })

  it('fires high when authorization_servers is an empty array', () => {
    const findings = resource001.run(remoteSnap({
      authRequired: true,
      oauthProtectedResource: { authorization_servers: [] },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.title).toMatch(/missing authorization_servers/)
  })

  it('fires high when authorization_servers contains non-string entries', () => {
    const findings = resource001.run(remoteSnap({
      authRequired: true,
      oauthProtectedResource: { authorization_servers: [123, null] },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.title).toMatch(/missing authorization_servers/)
  })

  it('passes when PRM has a valid authorization_servers array', () => {
    const findings = resource001.run(remoteSnap({
      authRequired: true,
      oauthAuthServer: { issuer: 'https://x' },
      oauthProtectedResource: {
        resource: 'https://x/mcp',
        authorization_servers: ['https://auth.example.com'],
      },
    }))
    expect(findings).toEqual([])
  })

  it('does not fire on servers that do not use OAuth (no AS metadata and no auth required)', () => {
    const findings = resource001.run(remoteSnap({
      authRequired: false,
    }))
    expect(findings).toEqual([])
  })

  it('does not fire without any remote probe', () => {
    expect(resource001.run({ kind: 'remote-url', target: 'https://x', capturedAt: '' })).toEqual([])
  })
})

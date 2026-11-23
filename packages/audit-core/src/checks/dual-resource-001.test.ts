import { describe, expect, it } from 'vitest'
import { dualResource001 } from './dual-resource-001'
import { remoteSnap } from './test-helpers'

describe('DUAL-RESOURCE-001', () => {
  it('fires when WWW-Authenticate resource_metadata points to a different host than the resource', () => {
    const findings = dualResource001.run(remoteSnap({
      url: 'https://mcp.example.com/api',
      invalidTokenWwwAuthenticate: 'Bearer realm="mcp", resource_metadata="https://legacy-auth.example.net/.well-known/oauth-protected-resource"',
      oauthProtectedResource: {
        resource: 'https://mcp.example.com/api',
        authorization_servers: ['https://auth.example.com'],
      },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('high')
    expect(findings[0]?.evidence).toContain('legacy-auth.example.net')
  })

  it('fires when WWW-Authenticate advertises an authorization_uri not in the well-known PRM', () => {
    const findings = dualResource001.run(remoteSnap({
      url: 'https://mcp.example.com/api',
      invalidTokenWwwAuthenticate: 'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource", authorization_uri="https://weak-auth.example.com"',
      oauthProtectedResource: {
        resource: 'https://mcp.example.com/api',
        authorization_servers: ['https://strong-auth.example.com'],
      },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.evidence).toContain('weak-auth.example.com')
    expect(findings[0]?.evidence).toContain('strong-auth.example.com')
  })

  it('fires when well-known PRM declares a different resource URL than WWW-Authenticate points at', () => {
    const findings = dualResource001.run(remoteSnap({
      url: 'https://new-mcp.example.com/api',
      invalidTokenWwwAuthenticate: 'Bearer resource_metadata="https://old-mcp.example.com/.well-known/oauth-protected-resource"',
      oauthProtectedResource: {
        resource: 'https://different-resource.example.com/api',
        authorization_servers: ['https://auth.example.com'],
      },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.evidence).toContain('different-resource.example.com')
  })

  it('does not fire when both PRM sources agree on host and authorization server', () => {
    const findings = dualResource001.run(remoteSnap({
      url: 'https://mcp.example.com/api',
      invalidTokenWwwAuthenticate: 'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource", authorization_uri="https://auth.example.com"',
      oauthProtectedResource: {
        resource: 'https://mcp.example.com/api',
        authorization_servers: ['https://auth.example.com'],
      },
    }))
    expect(findings).toEqual([])
  })

  it('does not fire without a WWW-Authenticate challenge', () => {
    const findings = dualResource001.run(remoteSnap({
      invalidTokenWwwAuthenticate: undefined,
      oauthProtectedResource: {
        authorization_servers: ['https://auth.example.com'],
      },
    }))
    expect(findings).toEqual([])
  })

  it('does not fire when the challenge has no resource_metadata parameter', () => {
    const findings = dualResource001.run(remoteSnap({
      invalidTokenWwwAuthenticate: 'Bearer realm="mcp"',
      oauthProtectedResource: {
        authorization_servers: ['https://auth.example.com'],
      },
    }))
    expect(findings).toEqual([])
  })

  it('does not fire when no well-known PRM is served', () => {
    const findings = dualResource001.run(remoteSnap({
      invalidTokenWwwAuthenticate: 'Bearer resource_metadata="https://x.example.com/.well-known/oauth-protected-resource"',
      oauthProtectedResource: undefined,
    }))
    expect(findings).toEqual([])
  })

  it('parses an unquoted resource_metadata value', () => {
    const findings = dualResource001.run(remoteSnap({
      url: 'https://mcp.example.com/api',
      invalidTokenWwwAuthenticate: 'Bearer resource_metadata=https://legacy.example.net/.well-known/oauth-protected-resource',
      oauthProtectedResource: {
        resource: 'https://mcp.example.com/api',
        authorization_servers: ['https://auth.example.com'],
      },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.evidence).toContain('legacy.example.net')
  })
})

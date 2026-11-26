import { describe, expect, it } from 'vitest'
import { oauthRevocation001 } from './oauth-revocation-001'
import { dirSnap, remoteSnap } from './test-helpers'

const ISSUER = 'https://auth.x.example'

describe('OAUTH-REVOCATION-001', () => {
  it('fires medium/high when refresh_token is a supported grant and revocation_endpoint is missing', () => {
    const findings = oauthRevocation001.run(remoteSnap({
      oauthAuthServer: {
        issuer: ISSUER,
        token_endpoint: ISSUER + '/token',
        grant_types_supported: ['authorization_code', 'refresh_token'],
      },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.id).toBe('OAUTH-REVOCATION-001')
    expect(findings[0]?.severity).toBe('medium')
    expect(findings[0]?.confidence).toBe('high')
    expect(findings[0]?.evidence).toContain('lists `refresh_token` in grant_types_supported')
    expect(findings[0]?.docsUrl).toBe('https://patchbay-mcp.dev/docs/oauth-revocation-001')
  })

  it('fires when only refresh_token_expires_in is advertised', () => {
    const findings = oauthRevocation001.run(remoteSnap({
      oauthAuthServer: { issuer: ISSUER, grant_types_supported: ['authorization_code'], refresh_token_expires_in: 2592000 },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.evidence).toContain('advertises refresh-token lifetime fields')
  })

  it('fires when only refresh_token_lifetime is advertised (no grant_types_supported)', () => {
    const findings = oauthRevocation001.run(remoteSnap({
      oauthAuthServer: { issuer: ISSUER, refresh_token_lifetime: 86400 },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.evidence).toContain('refresh-token lifetime fields')
  })

  it('fires when revocation_endpoint is an empty string', () => {
    expect(oauthRevocation001.run(remoteSnap({
      oauthAuthServer: { grant_types_supported: ['refresh_token'], revocation_endpoint: '' },
    }))).toHaveLength(1)
  })

  it('fires when revocation_endpoint is not a string', () => {
    expect(oauthRevocation001.run(remoteSnap({
      oauthAuthServer: { grant_types_supported: ['refresh_token'], revocation_endpoint: true },
    }))).toHaveLength(1)
  })

  it('passes when refresh tokens are minted and revocation_endpoint is advertised', () => {
    expect(oauthRevocation001.run(remoteSnap({
      oauthAuthServer: {
        issuer: ISSUER,
        grant_types_supported: ['authorization_code', 'refresh_token'],
        revocation_endpoint: ISSUER + '/revoke',
      },
    }))).toEqual([])
  })

  it('passes when the server does not mint refresh tokens', () => {
    expect(oauthRevocation001.run(remoteSnap({
      oauthAuthServer: { issuer: ISSUER, grant_types_supported: ['authorization_code', 'client_credentials'] },
    }))).toEqual([])
  })

  it('does not treat a non-array grant_types_supported as refresh support', () => {
    expect(oauthRevocation001.run(remoteSnap({
      oauthAuthServer: { grant_types_supported: 'refresh_token' },
    }))).toEqual([])
  })

  it('does not fire without any OAuth AS metadata', () => {
    expect(oauthRevocation001.run(remoteSnap({}))).toEqual([])
  })

  it('does not fire on non-remote snapshots', () => {
    expect(oauthRevocation001.run(dirSnap())).toEqual([])
  })
})

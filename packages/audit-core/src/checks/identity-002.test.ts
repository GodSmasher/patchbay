import { describe, expect, it } from 'vitest'
import { identity002 } from './identity-002'
import { remoteSnap } from './test-helpers'

const TOKEN_EXCHANGE = 'urn:ietf:params:oauth:grant-type:token-exchange'

describe('IDENTITY-002', () => {
  it('fires high when token-exchange is advertised and only "none" auth is accepted', () => {
    const findings = identity002.run(remoteSnap({
      oauthAuthServer: {
        issuer: 'https://as.example',
        grant_types_supported: ['authorization_code', TOKEN_EXCHANGE],
        token_endpoint_auth_methods_supported: ['none'],
      },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('high')
    expect(findings[0]?.evidence).toContain('https://as.example')
  })

  it('passes when the AS does not advertise token-exchange at all (IDENTITY-001 territory)', () => {
    expect(identity002.run(remoteSnap({
      oauthAuthServer: {
        issuer: 'https://as.example',
        grant_types_supported: ['authorization_code', 'refresh_token'],
        token_endpoint_auth_methods_supported: ['none'],
      },
    }))).toEqual([])
  })

  it('passes when token-exchange is advertised alongside an authenticated method', () => {
    expect(identity002.run(remoteSnap({
      oauthAuthServer: {
        grant_types_supported: [TOKEN_EXCHANGE],
        token_endpoint_auth_methods_supported: ['none', 'client_secret_basic'],
      },
    }))).toEqual([])
  })

  it('passes when token_endpoint_auth_methods_supported is omitted (RFC 8414 default is client_secret_basic)', () => {
    expect(identity002.run(remoteSnap({
      oauthAuthServer: {
        grant_types_supported: [TOKEN_EXCHANGE],
      },
    }))).toEqual([])
  })

  it('passes when token-exchange is advertised and the only method is private_key_jwt', () => {
    expect(identity002.run(remoteSnap({
      oauthAuthServer: {
        grant_types_supported: [TOKEN_EXCHANGE],
        token_endpoint_auth_methods_supported: ['private_key_jwt'],
      },
    }))).toEqual([])
  })

  it('does not fire without any OAuth metadata', () => {
    expect(identity002.run(remoteSnap({}))).toEqual([])
  })
})

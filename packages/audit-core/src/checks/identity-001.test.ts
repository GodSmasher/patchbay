import { describe, expect, it } from 'vitest'
import { identity001 } from './identity-001'
import { remoteSnap } from './test-helpers'

const TOKEN_EXCHANGE = 'urn:ietf:params:oauth:grant-type:token-exchange'

describe('IDENTITY-001', () => {
  it('fires medium when grant_types_supported is absent entirely', () => {
    const findings = identity001.run(remoteSnap({ oauthAuthServer: { issuer: 'https://x' } }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('medium')
  })

  it('fires medium when grant_types_supported omits token-exchange', () => {
    const findings = identity001.run(remoteSnap({
      oauthAuthServer: {
        issuer: 'https://x',
        grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
      },
    }))
    expect(findings).toHaveLength(1)
    const ev = findings[0]?.evidence ?? ''
    expect(ev).toContain('authorization_code, refresh_token, client_credentials')
  })

  it('passes when grant_types_supported includes token-exchange', () => {
    expect(identity001.run(remoteSnap({
      oauthAuthServer: {
        issuer: 'https://x',
        grant_types_supported: ['authorization_code', TOKEN_EXCHANGE],
      },
    }))).toEqual([])
  })

  it('does not fire without any OAuth metadata (server is not OAuth-protected at all)', () => {
    expect(identity001.run(remoteSnap({}))).toEqual([])
  })

  it('does not fire when the remote probe did not reach the server', () => {
    const snap = remoteSnap({ reachable: false, oauthAuthServer: undefined })
    expect(identity001.run(snap)).toEqual([])
  })
})

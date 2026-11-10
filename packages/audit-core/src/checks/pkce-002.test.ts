import { describe, expect, it } from 'vitest'
import { pkce002 } from './pkce-002'
import { remoteSnap } from './test-helpers'

describe('PKCE-002', () => {
  it('fires high when the server accepts plain PKCE', () => {
    const findings = pkce002.run(remoteSnap({
      headlessOauth: {
        attempted: true,
        authorizationEndpoint: 'https://as.example/authorize',
        dcrOutcome: 'ok',
        pkcePlain: { outcome: 'accepted', httpStatus: 302 },
      },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('high')
    expect(findings[0]?.evidence).toMatch(/plain/)
  })

  it('passes when plain PKCE was rejected', () => {
    expect(pkce002.run(remoteSnap({
      headlessOauth: {
        attempted: true,
        authorizationEndpoint: 'https://as.example/authorize',
        dcrOutcome: 'ok',
        pkcePlain: { outcome: 'rejected', httpStatus: 400 },
      },
    }))).toEqual([])
  })

  it('does not fire when probe not run', () => {
    expect(pkce002.run(remoteSnap({}))).toEqual([])
  })
})

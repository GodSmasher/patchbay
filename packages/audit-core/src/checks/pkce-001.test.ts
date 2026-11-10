import { describe, expect, it } from 'vitest'
import { pkce001 } from './pkce-001'
import { remoteSnap } from './test-helpers'

describe('PKCE-001', () => {
  it('fires critical when the server issues a code without PKCE', () => {
    const findings = pkce001.run(remoteSnap({
      headlessOauth: {
        attempted: true,
        authorizationEndpoint: 'https://as.example/authorize',
        dcrOutcome: 'ok',
        pkceMissing: { outcome: 'accepted', httpStatus: 302, reason: 'authorization code issued without user interaction' },
      },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('critical')
    expect(findings[0]?.evidence).toMatch(/NO code_challenge/)
  })

  it('passes when the server rejected the no-PKCE request', () => {
    expect(pkce001.run(remoteSnap({
      headlessOauth: {
        attempted: true,
        authorizationEndpoint: 'https://as.example/authorize',
        dcrOutcome: 'ok',
        pkceMissing: { outcome: 'rejected', httpStatus: 302, errorCode: 'invalid_request' },
      },
    }))).toEqual([])
  })

  it('reports info on inconclusive probe', () => {
    const findings = pkce001.run(remoteSnap({
      headlessOauth: {
        attempted: true,
        authorizationEndpoint: 'https://as.example/authorize',
        dcrOutcome: 'ok',
        pkceMissing: { outcome: 'inconclusive', httpStatus: 200, reason: 'consent-screen HTML; cannot tell without user action' },
      },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('info')
  })

  it('does not fire when the probe was not run', () => {
    expect(pkce001.run(remoteSnap({}))).toEqual([])
  })
})

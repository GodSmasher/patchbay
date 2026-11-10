import { describe, expect, it } from 'vitest'
import { implicit001 } from './implicit-001'
import { remoteSnap } from './test-helpers'

describe('IMPLICIT-001', () => {
  it('fires critical when response_type=token is accepted', () => {
    const findings = implicit001.run(remoteSnap({
      headlessOauth: {
        attempted: true,
        authorizationEndpoint: 'https://as.example/authorize',
        dcrOutcome: 'ok',
        implicit: { outcome: 'accepted', httpStatus: 302, reason: 'access token issued in fragment (implicit grant)' },
      },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('critical')
    expect(findings[0]?.evidence).toMatch(/implicit/)
  })

  it('passes when implicit grant was rejected', () => {
    expect(implicit001.run(remoteSnap({
      headlessOauth: {
        attempted: true,
        authorizationEndpoint: 'https://as.example/authorize',
        dcrOutcome: 'ok',
        implicit: { outcome: 'rejected', httpStatus: 302, errorCode: 'unsupported_response_type' },
      },
    }))).toEqual([])
  })

  it('does not fire when probe not run', () => {
    expect(implicit001.run(remoteSnap({}))).toEqual([])
  })
})

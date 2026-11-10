import { describe, expect, it } from 'vitest'
import { redirect002 } from './redirect-002'
import { remoteSnap } from './test-helpers'

describe('REDIRECT-002', () => {
  it('fires critical when unregistered redirect_uri is accepted', () => {
    const findings = redirect002.run(remoteSnap({
      headlessOauth: {
        attempted: true,
        authorizationEndpoint: 'https://as.example/authorize',
        dcrOutcome: 'ok',
        redirectMismatch: { outcome: 'accepted', httpStatus: 302 },
      },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('critical')
    expect(findings[0]?.evidence).toMatch(/attacker\.example\.com/)
  })

  it('passes when unregistered redirect_uri was rejected', () => {
    expect(redirect002.run(remoteSnap({
      headlessOauth: {
        attempted: true,
        authorizationEndpoint: 'https://as.example/authorize',
        dcrOutcome: 'ok',
        redirectMismatch: { outcome: 'rejected', httpStatus: 400, errorCode: 'invalid_request' },
      },
    }))).toEqual([])
  })

  it('does not fire when probe not run', () => {
    expect(redirect002.run(remoteSnap({}))).toEqual([])
  })
})

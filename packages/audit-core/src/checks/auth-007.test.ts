import { describe, expect, it } from 'vitest'
import { auth007 } from './auth-007'
import { remoteSnap } from './test-helpers'

describe('AUTH-007', () => {
  it('fires medium when invalid bearer got 403', () => {
    const findings = auth007.run(remoteSnap({
      authRequired: true,
      acceptedAuthHeader: 'none',
      invalidTokenStatus: 403,
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('medium')
    expect(findings[0]?.title).toMatch(/HTTP 403/)
  })

  it('fires medium when invalid bearer got 500', () => {
    const findings = auth007.run(remoteSnap({
      authRequired: true,
      acceptedAuthHeader: 'none',
      invalidTokenStatus: 500,
    }))
    expect(findings).toHaveLength(1)
  })

  it('includes WWW-Authenticate value in evidence when present', () => {
    const findings = auth007.run(remoteSnap({
      authRequired: true,
      acceptedAuthHeader: 'none',
      invalidTokenStatus: 403,
      invalidTokenWwwAuthenticate: 'Bearer realm="x"',
    }))
    expect(findings[0]?.evidence).toMatch(/Bearer realm/)
  })

  it('passes when invalid bearer got 401', () => {
    expect(auth007.run(remoteSnap({
      authRequired: true,
      acceptedAuthHeader: 'none',
      invalidTokenStatus: 401,
    }))).toEqual([])
  })

  it('does not fire when AUTH-002 would (bearer accepted)', () => {
    expect(auth007.run(remoteSnap({
      authRequired: true,
      acceptedAuthHeader: 'bearer',
      invalidTokenStatus: 200,
    }))).toEqual([])
  })

  it('does not fire when auth is not required', () => {
    expect(auth007.run(remoteSnap({
      authRequired: false,
      invalidTokenStatus: 200,
    }))).toEqual([])
  })

  it('does not fire when no status was captured', () => {
    expect(auth007.run(remoteSnap({
      authRequired: true,
      acceptedAuthHeader: 'none',
    }))).toEqual([])
  })
})

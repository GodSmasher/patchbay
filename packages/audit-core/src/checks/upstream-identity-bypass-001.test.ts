import { describe, expect, it } from 'vitest'
import { upstreamIdentityBypass001 } from './upstream-identity-bypass-001'
import { remoteSnap } from './test-helpers'

describe('UPSTREAM-IDENTITY-BYPASS-001', () => {
  it('fires critical when forged X-Upstream-User is accepted (IBM ContextForge pattern)', () => {
    const findings = upstreamIdentityBypass001.run(remoteSnap({
      authRequired: true,
      invalidTokenStatus: 401,
      upstreamIdentityBypass: {
        attempted: true,
        outcome: 'accepted',
        httpStatus: 200,
        forgedHeader: 'X-Upstream-User',
      },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('critical')
    expect(findings[0]?.evidence).toContain('CVE-2026-110278')
    expect(findings[0]?.evidence).toContain('X-Upstream-User')
  })

  it('names the specific forged header in the evidence', () => {
    const findings = upstreamIdentityBypass001.run(remoteSnap({
      authRequired: true,
      upstreamIdentityBypass: {
        attempted: true,
        outcome: 'accepted',
        httpStatus: 200,
        forgedHeader: 'X-Forwarded-User',
      },
    }))
    expect(findings[0]?.evidence).toContain('X-Forwarded-User')
  })

  it('does not fire on rejected (401/403)', () => {
    const findings = upstreamIdentityBypass001.run(remoteSnap({
      authRequired: true,
      upstreamIdentityBypass: {
        attempted: true,
        outcome: 'rejected',
        httpStatus: 401,
        forgedHeader: 'X-Upstream-User',
      },
    }))
    expect(findings).toEqual([])
  })

  it('does not fire on notApplicable (public-by-design)', () => {
    const findings = upstreamIdentityBypass001.run(remoteSnap({
      authRequired: false,
      upstreamIdentityBypass: {
        attempted: true,
        outcome: 'notApplicable',
      },
    }))
    expect(findings).toEqual([])
  })

  it('does not fire on inconclusive', () => {
    const findings = upstreamIdentityBypass001.run(remoteSnap({
      authRequired: true,
      upstreamIdentityBypass: {
        attempted: true,
        outcome: 'inconclusive',
        reason: 'network error',
      },
    }))
    expect(findings).toEqual([])
  })

  it('does not fire when probe not attempted', () => {
    const findings = upstreamIdentityBypass001.run(remoteSnap({
      authRequired: true,
      upstreamIdentityBypass: undefined,
    }))
    expect(findings).toEqual([])
  })
})

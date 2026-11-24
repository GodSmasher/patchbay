import { describe, expect, it } from 'vitest'
import { sessionBinding001 } from './session-binding-001'
import { remoteSnap } from './test-helpers'

describe('SESSION-BINDING-001', () => {
  it('fires high on sameSession across two initialize calls', () => {
    const findings = sessionBinding001.run(remoteSnap({
      sessionBinding: {
        attempted: true,
        outcome: 'sameSession',
        firstSessionId: 'session-abc-xyz',
        secondSessionId: 'session-abc-xyz',
      },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('high')
    expect(findings[0]?.evidence).toContain('CVE-2026-52869')
  })

  it('fires medium on lowEntropy', () => {
    const findings = sessionBinding001.run(remoteSnap({
      sessionBinding: {
        attempted: true,
        outcome: 'lowEntropy',
        firstSessionId: 'abc123',
        secondSessionId: 'abc124',
      },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('medium')
    expect(findings[0]?.evidence).toContain('128 bits')
  })

  it('does not fire on distinctSessions with adequate entropy', () => {
    const findings = sessionBinding001.run(remoteSnap({
      sessionBinding: {
        attempted: true,
        outcome: 'distinctSessions',
        firstSessionId: '0dd0d1b7-6e8e-4f6c-9b1e-1f7a3c2d3e4f',
        secondSessionId: '7ad8e6ff-a1b2-4c3d-8e9f-0a1b2c3d4e5f',
      },
    }))
    expect(findings).toEqual([])
  })

  it('does not fire on noSession (server does not use session IDs)', () => {
    const findings = sessionBinding001.run(remoteSnap({
      sessionBinding: { attempted: true, outcome: 'noSession' },
    }))
    expect(findings).toEqual([])
  })

  it('does not fire on inconclusive probe', () => {
    const findings = sessionBinding001.run(remoteSnap({
      sessionBinding: { attempted: true, outcome: 'inconclusive', reason: 'second init failed' },
    }))
    expect(findings).toEqual([])
  })

  it('does not fire when probe was not attempted', () => {
    const findings = sessionBinding001.run(remoteSnap({
      sessionBinding: undefined,
    }))
    expect(findings).toEqual([])
  })
})

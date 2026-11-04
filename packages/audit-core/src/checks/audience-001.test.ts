import { describe, expect, it } from 'vitest'
import type { AudienceProbeResult, TargetSnapshot } from '../types'
import { audience001 } from './audience-001'

function snap(probe: AudienceProbeResult | undefined): TargetSnapshot {
  return {
    kind: 'remote-url',
    target: 'https://x',
    capturedAt: new Date().toISOString(),
    remote: {
      url: 'https://x',
      reachable: true,
      usesTls: true,
      initializeOk: true,
      toolsListOk: true,
      authRequired: false,
      acceptedAuthHeader: 'bearer',
      transport: 'streamable-http',
      tools: [],
      audienceProbe: probe,
      rawErrors: [],
    },
  }
}

describe('AUDIENCE-001', () => {
  it('does not fire when no probe was attempted', () => {
    expect(audience001.run(snap(undefined))).toEqual([])
  })

  it('does not fire when probe was attempted but server rejected (correct behaviour)', () => {
    const p: AudienceProbeResult = { attempted: true, outcome: 'rejected', httpStatus: 401 }
    expect(audience001.run(snap(p))).toEqual([])
  })

  it('does not fire for 403 either', () => {
    const p: AudienceProbeResult = { attempted: true, outcome: 'rejected', httpStatus: 403 }
    expect(audience001.run(snap(p))).toEqual([])
  })

  it('fires critical when server accepts a cross-audience token', () => {
    const p: AudienceProbeResult = { attempted: true, outcome: 'accepted', httpStatus: 200 }
    const r = audience001.run(snap(p))
    expect(r).toHaveLength(1)
    expect(r[0]!.severity).toBe('critical')
    expect(r[0]!.evidence).toContain('different resource')
    expect(r[0]!.evidence).toContain('RFC 8707')
    expect(r[0]!.fix).toContain('aud')
  })

  it('fires info on inconclusive outcome', () => {
    const p: AudienceProbeResult = { attempted: true, outcome: 'inconclusive', reason: 'network error' }
    const r = audience001.run(snap(p))
    expect(r).toHaveLength(1)
    expect(r[0]!.severity).toBe('info')
    expect(r[0]!.evidence).toContain('network error')
  })

  it('does not fire on directory snapshots', () => {
    expect(audience001.run({ kind: 'directory', target: '/tmp', capturedAt: '' })).toEqual([])
  })

  it('docs URL points to the right slug', () => {
    const p: AudienceProbeResult = { attempted: true, outcome: 'accepted', httpStatus: 200 }
    expect(audience001.run(snap(p))[0]!.docsUrl).toContain('audience-001')
  })
})

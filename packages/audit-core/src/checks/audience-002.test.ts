import { describe, expect, it } from 'vitest'
import { audience002 } from './audience-002'
import { remoteSnap } from './test-helpers'

describe('AUDIENCE-002', () => {
  it('fires critical when missing-aud probe was accepted', () => {
    const findings = audience002.run(remoteSnap({
      missingAudProbe: { attempted: true, outcome: 'accepted', httpStatus: 200 },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('critical')
    expect(findings[0]?.evidence).toMatch(/RFC 9068 Section 4/)
  })

  it('passes when missing-aud probe was rejected', () => {
    expect(audience002.run(remoteSnap({
      missingAudProbe: { attempted: true, outcome: 'rejected', httpStatus: 401 },
    }))).toEqual([])
  })

  it('reports info when inconclusive', () => {
    const findings = audience002.run(remoteSnap({
      missingAudProbe: { attempted: true, outcome: 'inconclusive', httpStatus: 500, reason: 'unexpected' },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('info')
  })

  it('does not fire when probe was not attempted', () => {
    expect(audience002.run(remoteSnap({}))).toEqual([])
  })

  it('does not fire without any remote probe', () => {
    expect(audience002.run({ kind: 'remote-url', target: 'https://x', capturedAt: '' })).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { auth006 } from './auth-006'
import { remoteSnap } from './test-helpers'

describe('AUTH-006', () => {
  it('fires when DCR rejected loopback redirect URIs', () => {
    const findings = auth006.run(
      remoteSnap({
        dcrLoopback: { attempted: true, outcome: 'rejected', httpStatus: 400, reason: 'invalid_redirect_uri' },
      }),
    )
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('high')
    expect(findings[0]?.id).toBe('AUTH-006')
  })

  it('passes when DCR accepted loopback redirect URIs', () => {
    expect(
      auth006.run(remoteSnap({ dcrLoopback: { attempted: true, outcome: 'accepted', httpStatus: 201 } })),
    ).toEqual([])
  })

  it('does not fire when the probe was not run', () => {
    expect(auth006.run(remoteSnap({}))).toEqual([])
  })

  it('reports info on inconclusive probe (consistency with other opt-in probes)', () => {
    const findings = auth006.run(remoteSnap({
      dcrLoopback: { attempted: true, outcome: 'inconclusive', httpStatus: 500, reason: 'unexpected status 500' },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('info')
    expect(findings[0]?.title).toMatch(/inconclusive/)
  })

  it('does not fire when no registration_endpoint exists', () => {
    expect(auth006.run(remoteSnap({ dcrLoopback: { attempted: true, outcome: 'no-endpoint' } }))).toEqual([])
  })
})

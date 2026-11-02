import { describe, expect, it } from 'vitest'
import { probe001 } from './probe-001'
import { remoteSnap } from './test-helpers'

describe('PROBE-001', () => {
  it('fires when server reachable but no MCP + no discovery', () => {
    const r = probe001.run(remoteSnap({ reachable: true, initializeOk: false, toolsListOk: false }))
    expect(r).toHaveLength(1)
    expect(r[0]!.severity).toBe('info')
  })

  it('fires when server not reachable', () => {
    const r = probe001.run(remoteSnap({ reachable: false, rawErrors: ['ECONNREFUSED'] }))
    expect(r).toHaveLength(1)
    expect(r[0]!.evidence).toContain('ECONNREFUSED')
  })

  it('does not fire when initialize succeeded', () => {
    expect(probe001.run(remoteSnap({ reachable: true, initializeOk: true }))).toEqual([])
  })

  it('does not fire when OAuth metadata was served', () => {
    expect(probe001.run(remoteSnap({ reachable: true, oauthAuthServer: { issuer: 'x' } }))).toEqual([])
  })

  it('does not fire on directory snapshots', () => {
    expect(probe001.run({ kind: 'directory', target: '/tmp', capturedAt: '' })).toEqual([])
  })
})

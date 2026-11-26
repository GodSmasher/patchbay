import { describe, expect, it } from 'vitest'
import { sampling001 } from './sampling-001'
import { dirSnap, remoteSnap } from './test-helpers'

describe('SAMPLING-001', () => {
  it('fires medium/high when the server advertises `sampling`', () => {
    const findings = sampling001.run(remoteSnap({ advertisedCapabilities: { tools: {}, sampling: {} } }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.id).toBe('SAMPLING-001')
    expect(findings[0]?.severity).toBe('medium')
    expect(findings[0]?.confidence).toBe('high')
    expect(findings[0]?.evidence).toContain('`sampling`')
  })

  it('fires on key presence even when the value is falsy', () => {
    expect(sampling001.run(remoteSnap({ advertisedCapabilities: { sampling: null } }))).toHaveLength(1)
  })

  it('passes when sampling is not advertised', () => {
    expect(sampling001.run(remoteSnap({ advertisedCapabilities: { tools: {}, logging: {} } }))).toEqual([])
  })

  it('does not fire without advertisedCapabilities or on non-remote snapshots', () => {
    expect(sampling001.run(remoteSnap({}))).toEqual([])
    expect(sampling001.run(dirSnap())).toEqual([])
  })
})

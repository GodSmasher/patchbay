import { describe, expect, it } from 'vitest'
import { deprecated001 } from './deprecated-001'
import { dirSnap, remoteSnap } from './test-helpers'

describe('DEPRECATED-001', () => {
  it('fires low with singular wording when only `logging` is advertised', () => {
    const findings = deprecated001.run(remoteSnap({ advertisedCapabilities: { tools: {}, logging: {} } }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('low')
    expect(findings[0]?.confidence).toBe('high')
    expect(findings[0]?.title).toBe('Server advertises 1 deprecated capability')
    expect(findings[0]?.evidence).toContain('deprecated capabilities: `logging`. ')
  })

  it('fires when only `roots` is advertised', () => {
    const findings = deprecated001.run(remoteSnap({ advertisedCapabilities: { roots: { listChanged: true } } }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.evidence).toContain('deprecated capabilities: `roots`. ')
  })

  it('uses plural wording and lists both when logging and roots are advertised', () => {
    const findings = deprecated001.run(remoteSnap({ advertisedCapabilities: { logging: {}, roots: {} } }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.title).toBe('Server advertises 2 deprecated capabilities')
    expect(findings[0]?.evidence).toContain('deprecated capabilities: `logging`, `roots`. ')
  })

  it('passes when only current capabilities are advertised', () => {
    expect(deprecated001.run(remoteSnap({
      advertisedCapabilities: { tools: { listChanged: true }, resources: {}, prompts: {} },
    }))).toEqual([])
  })

  it('does not report `sampling` (that is SAMPLING-001)', () => {
    expect(deprecated001.run(remoteSnap({ advertisedCapabilities: { sampling: {} } }))).toEqual([])
  })

  it('does not fire without advertisedCapabilities or on non-remote snapshots', () => {
    expect(deprecated001.run(remoteSnap({}))).toEqual([])
    expect(deprecated001.run(dirSnap())).toEqual([])
  })
})

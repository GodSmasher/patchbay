import { describe, expect, it } from 'vitest'
import type { ManifestDelta, TargetSnapshot, ToolDescriptor } from '../types'
import { manifest001 } from './manifest-001'

function snap(delta: ManifestDelta | undefined, tools: ToolDescriptor[] = []): TargetSnapshot {
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
      acceptedAuthHeader: 'none',
      transport: 'streamable-http',
      tools,
      manifestDelta: delta,
      rawErrors: [],
    },
  }
}

function delta(overrides: Partial<ManifestDelta>): ManifestDelta {
  return {
    serverId: 'http:abc',
    pinnedHash: 'sha256:aaa',
    currentHash: 'sha256:bbb',
    changes: [],
    firstSeen: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('MANIFEST-001', () => {
  it('does not fire when no manifest delta on the snapshot', () => {
    expect(manifest001.run(snap(undefined))).toEqual([])
  })

  it('does not fire when delta has zero changes', () => {
    expect(manifest001.run(snap(delta({})))).toEqual([])
  })

  it('does not fire on directory-only snapshot', () => {
    expect(manifest001.run({ kind: 'directory', target: '/tmp', capturedAt: '' })).toEqual([])
  })

  it('critical when a new write-shaped tool appears', () => {
    const d = delta({ changes: [{ kind: 'tool-added', toolName: 'delete_user' }] })
    const tools: ToolDescriptor[] = [{ name: 'delete_user' }]
    const r = manifest001.run(snap(d, tools))
    expect(r).toHaveLength(1)
    expect(r[0]!.severity).toBe('critical')
    expect(r[0]!.evidence).toContain('tool-added')
    expect(r[0]!.evidence).toContain('delete_user')
  })

  it('low when a new read-shaped tool appears', () => {
    const d = delta({ changes: [{ kind: 'tool-added', toolName: 'get_user' }] })
    const r = manifest001.run(snap(d, [{ name: 'get_user' }]))
    expect(r[0]!.severity).toBe('low')
  })

  it('medium when an existing tool description changes', () => {
    const d = delta({ changes: [{ kind: 'description-changed', toolName: 'get_user', detail: '10 chars -> 200 chars' }] })
    const r = manifest001.run(snap(d, [{ name: 'get_user' }]))
    expect(r[0]!.severity).toBe('medium')
  })

  it('low when input schema structure changes without write-shaped params', () => {
    const d = delta({ changes: [{ kind: 'input-schema-changed', toolName: 'get_user', detail: 'schema structure changed' }] })
    const r = manifest001.run(snap(d, [{ name: 'get_user' }]))
    expect(r[0]!.severity).toBe('low')
  })

  it('critical when input schema gains a write-shaped param', () => {
    const d = delta({ changes: [{ kind: 'input-schema-changed', toolName: 'read_doc', detail: 'new params: command' }] })
    const r = manifest001.run(snap(d, [{ name: 'read_doc' }]))
    expect(r[0]!.severity).toBe('critical')
  })

  it('critical when input schema gains an exec param', () => {
    const d = delta({ changes: [{ kind: 'input-schema-changed', toolName: 'read_doc', detail: 'new params: exec' }] })
    expect(manifest001.run(snap(d, [{ name: 'read_doc' }]))[0]!.severity).toBe('critical')
  })

  it('info when a tool is removed', () => {
    const d = delta({ changes: [{ kind: 'tool-removed', toolName: 'old_tool' }] })
    const r = manifest001.run(snap(d, []))
    expect(r[0]!.severity).toBe('info')
  })

  it('highest severity wins across multiple changes in one run', () => {
    const d = delta({
      changes: [
        { kind: 'tool-added', toolName: 'delete_user' },     // critical
        { kind: 'description-changed', toolName: 'get_user' }, // medium
        { kind: 'tool-removed', toolName: 'old_tool' },       // info
      ],
    })
    const tools: ToolDescriptor[] = [{ name: 'delete_user' }, { name: 'get_user' }]
    const r = manifest001.run(snap(d, tools))
    expect(r[0]!.severity).toBe('critical')
    expect(r[0]!.title).toContain('3 delta(s)')
  })

  it('evidence includes both hashes and the firstSeen date', () => {
    const d = delta({
      pinnedHash: 'sha256:pin',
      currentHash: 'sha256:cur',
      firstSeen: '2026-11-01T00:00:00.000Z',
      changes: [{ kind: 'tool-added', toolName: 'foo' }],
    })
    const r = manifest001.run(snap(d, [{ name: 'foo' }]))
    expect(r[0]!.evidence).toContain('sha256:pin')
    expect(r[0]!.evidence).toContain('sha256:cur')
    expect(r[0]!.evidence).toContain('2026-11-01')
  })

  it('fix mentions --trust for legitimate updates', () => {
    const d = delta({ changes: [{ kind: 'tool-added', toolName: 'foo' }] })
    const r = manifest001.run(snap(d, [{ name: 'foo' }]))
    expect(r[0]!.fix).toContain('--trust')
  })
})

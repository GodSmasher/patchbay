import { describe, expect, it } from 'vitest'
import { manifest002 } from './manifest-002'
import { remoteSnap } from './test-helpers'
import type { ManifestDelta, ManifestDeltaItem } from '../types'

function delta(changes: ManifestDeltaItem[]): ManifestDelta {
  return {
    serverId: 'http:abc',
    pinnedHash: 'sha256:pinned',
    currentHash: 'sha256:current',
    changes,
    firstSeen: '2026-11-01T00:00:00Z',
  }
}

describe('MANIFEST-002', () => {
  it('fires critical for tool-removed (breaking)', () => {
    const findings = manifest002.run(remoteSnap({
      manifestDelta: delta([{ kind: 'tool-removed', toolName: 'search' }]),
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('critical')
    expect(findings[0]?.title).toMatch(/Breaking/)
  })

  it('fires critical for param-made-required (breaking)', () => {
    const findings = manifest002.run(remoteSnap({
      manifestDelta: delta([
        { kind: 'input-schema-changed', toolName: 'search', detail: 'schema structure changed' },
        { kind: 'param-made-required', toolName: 'search', detail: 'param: filter' },
      ]),
    }))
    expect(findings[0]?.severity).toBe('critical')
    expect(findings[0]?.evidence).toMatch(/param-made-required/)
  })

  it('fires critical for param-type-changed', () => {
    const findings = manifest002.run(remoteSnap({
      manifestDelta: delta([
        { kind: 'input-schema-changed', toolName: 'search', detail: 'schema structure changed' },
        { kind: 'param-type-changed', toolName: 'search', detail: 'limit: string -> integer' },
      ]),
    }))
    expect(findings[0]?.severity).toBe('critical')
  })

  it('fires critical for param-enum-shrunk', () => {
    const findings = manifest002.run(remoteSnap({
      manifestDelta: delta([
        { kind: 'input-schema-changed', toolName: 'search', detail: 'schema structure changed' },
        { kind: 'param-enum-shrunk', toolName: 'search', detail: 'mode: removed [legacy]' },
      ]),
    }))
    expect(findings[0]?.severity).toBe('critical')
  })

  it('fires low for tool-added (additive)', () => {
    const findings = manifest002.run(remoteSnap({
      manifestDelta: delta([{ kind: 'tool-added', toolName: 'new_tool' }]),
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('low')
    expect(findings[0]?.title).toMatch(/Additive/)
  })

  it('fires low for param-added (additive)', () => {
    const findings = manifest002.run(remoteSnap({
      manifestDelta: delta([
        { kind: 'input-schema-changed', toolName: 'search', detail: 'schema structure changed' },
        { kind: 'param-added', toolName: 'search', detail: 'param: hint (optional)' },
      ]),
    }))
    expect(findings[0]?.severity).toBe('low')
  })

  it('fires medium for description-changed (semantic drift)', () => {
    const findings = manifest002.run(remoteSnap({
      manifestDelta: delta([
        { kind: 'description-changed', toolName: 'search', detail: '20 chars -> 180 chars' },
      ]),
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('medium')
    expect(findings[0]?.title).toMatch(/Semantic drift/)
  })

  it('fires multiple findings when buckets overlap', () => {
    const findings = manifest002.run(remoteSnap({
      manifestDelta: delta([
        { kind: 'tool-removed', toolName: 'old_tool' },
        { kind: 'description-changed', toolName: 'search', detail: '10 chars -> 200 chars' },
        { kind: 'tool-added', toolName: 'new_tool' },
      ]),
    }))
    expect(findings).toHaveLength(3)
    const sevs = findings.map((f) => f.severity).sort()
    expect(sevs).toEqual(['critical', 'low', 'medium'])
  })

  it('falls back to additive when input-schema-changed has no fine-grained children', () => {
    const findings = manifest002.run(remoteSnap({
      manifestDelta: delta([
        { kind: 'input-schema-changed', toolName: 'search', detail: 'schema structure changed' },
      ]),
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('low')
    expect(findings[0]?.evidence).toMatch(/no fine-grained diff available/)
  })

  it('does not fire when delta is empty', () => {
    expect(manifest002.run(remoteSnap({
      manifestDelta: delta([]),
    }))).toEqual([])
  })

  it('does not fire without a manifestDelta', () => {
    expect(manifest002.run(remoteSnap({}))).toEqual([])
  })
})

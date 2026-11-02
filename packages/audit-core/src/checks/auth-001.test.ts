import { describe, expect, it } from 'vitest'
import type { TargetSnapshot } from '../types'
import { auth001 } from './auth-001'

function snap(overrides: Partial<NonNullable<TargetSnapshot['remote']>> & { url: string }): TargetSnapshot {
  const { url, ...rest } = overrides
  return {
    kind: 'remote-url',
    target: url,
    capturedAt: new Date().toISOString(),
    remote: {
      url,
      reachable: true,
      usesTls: true,
      initializeOk: true,
      toolsListOk: true,
      authRequired: false,
      acceptedAuthHeader: 'none',
      transport: 'streamable-http',
      tools: [],
      rawErrors: [],
      ...rest,
    },
  }
}

describe('AUTH-001', () => {
  it('fires when tools/list succeeds without auth', () => {
    const r = auth001.run(snap({ url: 'https://x', tools: [{ name: 'a' }, { name: 'b' }] }))
    expect(r).toHaveLength(1)
    expect(r[0]!.severity).toBe('critical')
    expect(r[0]!.evidence).toContain('2 tool')
  })

  it('does not fire when auth is required', () => {
    expect(auth001.run(snap({ url: 'https://x', authRequired: true, toolsListOk: false }))).toEqual([])
  })

  it('does not fire when server is unreachable', () => {
    const s = snap({ url: 'https://x' })
    s.remote!.reachable = false
    expect(auth001.run(s)).toEqual([])
  })

  it('does not fire on directory-only snapshots', () => {
    expect(auth001.run({ kind: 'directory', target: '/tmp', capturedAt: '' })).toEqual([])
  })
})

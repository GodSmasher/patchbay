import { describe, expect, it } from 'vitest'
import type { TargetSnapshot } from '../types'
import { secret001 } from './secret-001'

function dirSnap(hits: Array<{ path: string; line: number; pattern: string; match: string }>): TargetSnapshot {
  return {
    kind: 'directory',
    target: '/tmp/x',
    capturedAt: '',
    directory: {
      root: '/tmp/x',
      files: [],
      secretHits: hits,
      envVarsUsed: [],
      secretEnvVarsUsed: [],
      hasRefreshTokenPath: false,
    },
  }
}

describe('SECRET-001', () => {
  it('fires once per hit', () => {
    const r = secret001.run(dirSnap([
      { path: 'src/a.ts', line: 10, pattern: 'openai-key', match: 'sk-abcdef1234567890abcdef' },
      { path: 'src/b.ts', line: 2, pattern: 'github-token', match: 'ghp_abcdefghijklmnopqrstuvwxyz1234567890' },
    ]))
    expect(r).toHaveLength(2)
    expect(r[0]!.evidence).toContain('…')
    expect(r[0]!.evidence).not.toContain('abcdef1234567890')
  })

  it('does not fire with no hits', () => {
    expect(secret001.run(dirSnap([]))).toEqual([])
  })

  it('does not fire on remote-only snapshots', () => {
    expect(secret001.run({ kind: 'remote-url', target: 'https://x', capturedAt: '' })).toEqual([])
  })
})

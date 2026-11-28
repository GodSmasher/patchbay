import { describe, expect, it } from 'vitest'
import { leaderboardGrade, leaderboardScore, normalizeEntry, normalizeEntries } from './leaderboard-grade'
import type { LeaderboardEntry, LeaderboardFindingCounts } from './leaderboard-store'

const EMPTY: LeaderboardFindingCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }

function entry(partial: Partial<LeaderboardEntry> & { findings?: Partial<LeaderboardFindingCounts> }): LeaderboardEntry {
  return {
    slug: 'example-com',
    host: 'example.com',
    url: 'https://example.com/mcp',
    score: 0,
    grade: 'F',
    findings: { ...EMPTY, ...(partial.findings ?? {}) },
    topFindingIds: [],
    reachable: true,
    category: 'public-by-design',
    lastScanned: '2026-11-28T00:00:00Z',
    ...partial,
  } as LeaderboardEntry
}

describe('leaderboardScore', () => {
  it('returns 100 for zero findings', () => {
    expect(leaderboardScore(EMPTY)).toBe(100)
  })

  it('applies canonical weights (crit=30, hi=15, med=5, low=1)', () => {
    expect(leaderboardScore({ critical: 1, high: 0, medium: 0, low: 0, info: 0 })).toBe(70)
    expect(leaderboardScore({ critical: 0, high: 1, medium: 0, low: 0, info: 0 })).toBe(85)
    expect(leaderboardScore({ critical: 0, high: 0, medium: 1, low: 0, info: 0 })).toBe(95)
    expect(leaderboardScore({ critical: 0, high: 0, medium: 0, low: 1, info: 0 })).toBe(99)
  })

  it('ignores info findings in the score', () => {
    expect(leaderboardScore({ critical: 0, high: 0, medium: 0, low: 0, info: 10 })).toBe(100)
  })

  it('floors at 0 instead of going negative', () => {
    expect(leaderboardScore({ critical: 10, high: 0, medium: 0, low: 0, info: 0 })).toBe(0)
  })

  it.each([
    [{ critical: 0, high: 2, medium: 3, low: 0, info: 0 }, 55], // context7 example from Adam's email
    [{ critical: 0, high: 0, medium: 2, low: 0, info: 0 }, 90],
  ])('matches Adam-feedback example for %o', (findings, expected) => {
    expect(leaderboardScore({ ...EMPTY, ...findings })).toBe(expected)
  })
})

describe('leaderboardGrade', () => {
  it.each([
    [100, 'A'], [95, 'A'], [94, 'A'], [85, 'A'], // A+ collapses into A for display
    [84, 'B'], [75, 'B'],
    [74, 'C'], [69, 'C'], [60, 'C'],              // 69 → C (Adam caught D@69 regression)
    [59, 'D'], [40, 'D'],
    [39, 'F'], [0, 'F'],
  ])('maps score %i to grade %s', (score, grade) => {
    expect(leaderboardGrade(score)).toBe(grade)
  })
})

describe('normalizeEntry', () => {
  it('overrides stored score + grade with canonical values (mizan.ac regression)', () => {
    // mizan.ac on the leaderboard showed grade D at score 69. Scanner
    // would say C at 69. Normalization fixes it.
    const e = entry({
      host: 'mizan.ac',
      score: 69,
      grade: 'D',
      findings: { critical: 0, high: 0, medium: 6, low: 1, info: 0 },
    })
    const n = normalizeEntry(e)
    // score recomputed from findings (100 - 6*5 - 1 = 69), grade→C
    expect(n.score).toBe(69)
    expect(n.grade).toBe('C')
  })

  it('leaves unreachable entries untouched (would otherwise regrade A)', () => {
    // An unreachable host has a zero-finding summary that would score
    // 100 → A. normalizeEntry must NOT re-grade unreachable entries or
    // we would display every dead host as A.
    const e = entry({ host: 'dead.example.com', reachable: false, score: 0, grade: 'F', findings: EMPTY })
    const n = normalizeEntry(e)
    expect(n.score).toBe(0)
    expect(n.grade).toBe('F')
    expect(n.reachable).toBe(false)
  })

  it('collapses A+ (score ≥95) into A for leaderboard display', () => {
    const e = entry({ findings: EMPTY, score: 42, grade: 'F' }) // stored wrong
    const n = normalizeEntry(e)
    // score=100 → canonical A+ → leaderboard A
    expect(n.score).toBe(100)
    expect(n.grade).toBe('A')
  })

  it('returns same object (no copy) when stored values already match canonical', () => {
    const e = entry({ findings: { critical: 0, high: 2, medium: 3, low: 0, info: 0 }, score: 55, grade: 'D' })
    const n = normalizeEntry(e)
    // 55 → D per canonical, matches stored → same object
    expect(n).toBe(e)
  })
})

describe('normalizeEntries', () => {
  it('normalizes every entry in the list', () => {
    const list = [
      entry({ host: 'a.example.com', findings: { critical: 1, high: 0, medium: 0, low: 0, info: 0 }, score: 42, grade: 'D' }),
      entry({ host: 'b.example.com', findings: EMPTY, score: 42, grade: 'F', reachable: false }),
    ]
    const out = normalizeEntries(list)
    expect(out).toHaveLength(2)
    expect(out[0]!.score).toBe(70) // crit=1 → 100-30
    expect(out[0]!.grade).toBe('C')
    expect(out[1]!.score).toBe(42) // untouched, unreachable
    expect(out[1]!.grade).toBe('F')
  })
})

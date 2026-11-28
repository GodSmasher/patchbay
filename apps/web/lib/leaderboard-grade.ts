/**
 * Single source of truth for leaderboard score and grade.
 *
 * Before this module existed, the crawler in scripts/crawl-registry-full.ts
 * had its own scoreFromFindings + gradeFromScore with weights and cutoffs
 * that diverged from packages/audit-core/src/lib/score.ts. That let the
 * same host show one grade on the live /audit scanner and a different
 * grade on the /leaderboard row (adam@trigger.tools caught this on
 * 2026-11-28: context7, mizan.ac, mcp.pantheon.ad all mismatched).
 *
 * All leaderboard surfaces now derive grade and score from the entry's
 * finding counts using the canonical audit-core helpers, overriding
 * whatever the crawler stored. The crawler itself is being switched to
 * the same helpers so future snapshots store the correct values at
 * ingest time too.
 */
import {
  letterGrade as canonicalLetterGrade,
  score as canonicalScore,
} from '@patchbay-nebius/audit-core'
import type { LeaderboardEntry, LeaderboardFindingCounts, LeaderboardGrade } from './leaderboard-store'

export function leaderboardScore(findings: LeaderboardFindingCounts): number {
  return canonicalScore({
    critical: findings.critical,
    high: findings.high,
    medium: findings.medium,
    low: findings.low,
    info: findings.info,
  })
}

export function leaderboardGrade(score: number): LeaderboardGrade {
  // Scanner uses six buckets (A+ at ≥95); leaderboard uses five, so
  // collapse A+ into A for display consistency.
  const g = canonicalLetterGrade(score)
  return g === 'A+' ? 'A' : g
}

/**
 * Return `entry` with `score` and `grade` recomputed from its own
 * `findings` using the canonical audit-core helpers. Reachability is
 * preserved — unreachable entries are returned unchanged so the UI can
 * still render them in the "unreachable, not scored" bucket rather than
 * accidentally regrading them to A based on an empty finding set.
 */
export function normalizeEntry<T extends LeaderboardEntry>(entry: T): T {
  if (!entry.reachable) return entry
  const score = leaderboardScore(entry.findings)
  const grade = leaderboardGrade(score)
  if (entry.score === score && entry.grade === grade) return entry
  return { ...entry, score, grade }
}

export function normalizeEntries<T extends LeaderboardEntry>(entries: T[]): T[] {
  return entries.map((e) => normalizeEntry(e))
}

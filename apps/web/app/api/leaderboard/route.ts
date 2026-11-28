import { NextResponse } from 'next/server'
import { loadLeaderboardSnapshot } from '@/lib/leaderboard-store'
import { normalizeEntries } from '@/lib/leaderboard-grade'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/leaderboard
 *
 * Returns the latest leaderboard snapshot as JSON. Cached via Next's
 * `leaderboard` tag; the /api/leaderboard/upload endpoint busts it on
 * every new sweep upload.
 *
 * Entries are normalized on the way out so the public API matches what
 * the HTML pages display. Without this, third-party consumers of the
 * API would see raw crawler-stored score/grade pairs that diverged from
 * the canonical audit-core cutoffs (see PR #71 for the display-side fix
 * and apps/web/lib/leaderboard-grade.ts for the normalization logic).
 */
export async function GET(): Promise<Response> {
  const snapshot = await loadLeaderboardSnapshot()
  if (!snapshot) {
    return NextResponse.json({ error: 'no-snapshot-yet' }, { status: 404 })
  }
  const normalized = { ...snapshot, entries: normalizeEntries(snapshot.entries) }
  return NextResponse.json(normalized, {
    headers: { 'cache-control': 'no-store' },
  })
}

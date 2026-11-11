import { NextResponse } from 'next/server'
import { loadLeaderboardSnapshot } from '@/lib/leaderboard-store'

export const runtime = 'nodejs'
export const revalidate = 300

/**
 * GET /api/leaderboard
 *
 * Returns the latest leaderboard snapshot as JSON. Cached via Next's
 * `leaderboard` tag; the /api/leaderboard/upload endpoint busts it on
 * every new sweep upload.
 */
export async function GET(): Promise<Response> {
  const snapshot = await loadLeaderboardSnapshot()
  if (!snapshot) {
    return NextResponse.json({ error: 'no-snapshot-yet' }, { status: 404 })
  }
  return NextResponse.json(snapshot, {
    headers: { 'cache-control': 'public, max-age=60, s-maxage=300' },
  })
}

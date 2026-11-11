import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { saveLeaderboardSnapshot, type LeaderboardSnapshot } from '@/lib/leaderboard-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/leaderboard/upload
 *
 * Writes a leaderboard snapshot to KV and busts the `leaderboard` cache
 * tag so the SSG pages pick it up on next request. Called by
 * scripts/leaderboard-upload.ts after a passive sweep.
 *
 * Auth: x-upload-token header must match PATCHBAY_LEADERBOARD_UPLOAD_TOKEN.
 */
export async function POST(req: Request): Promise<Response> {
  const expected = process.env.PATCHBAY_LEADERBOARD_UPLOAD_TOKEN
  if (!expected) {
    return NextResponse.json({ error: 'upload-token-not-configured' }, { status: 503 })
  }
  const token = req.headers.get('x-upload-token')
  if (token !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let snapshot: LeaderboardSnapshot
  try {
    snapshot = await req.json() as LeaderboardSnapshot
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 })
  }

  if (!Array.isArray(snapshot.entries) || !snapshot.capturedAt) {
    return NextResponse.json({ error: 'missing-fields' }, { status: 400 })
  }

  await saveLeaderboardSnapshot(snapshot)
  revalidateTag('leaderboard')

  return NextResponse.json({ ok: true, cohortSize: snapshot.entries.length, capturedAt: snapshot.capturedAt })
}

import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  loadLeaderboardSnapshot,
  saveLeaderboardSnapshot,
  type LeaderboardEntry,
  type LeaderboardSnapshot,
} from '@/lib/leaderboard-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Vercel cron delivers GET Authorization: Bearer <CRON_SECRET>. Same
// mechanism as /api/cron/weekly-digest.
function isAuthorised(req: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const auth = req.headers.get('authorization') || ''
  return auth === `Bearer ${expected}`
}

/**
 * GET /api/cron/ingest-discovery
 *
 * Reads apps/web/data/discovery-queue.json (committed queue of MCP
 * endpoints the patchbay-ops discovery pipeline staged), merges them
 * into the live leaderboard snapshot (dedup by host), writes back.
 * Idempotent — a second run against the same queue produces no change.
 *
 * Scheduled hourly so a merged queue goes live within 60 min of deploy.
 */
export async function GET(req: Request): Promise<NextResponse> {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  }

  let queue: { entries?: LeaderboardEntry[] } = {}
  try {
    const queuePath = join(process.cwd(), 'data', 'discovery-queue.json')
    queue = JSON.parse(readFileSync(queuePath, 'utf8'))
  } catch (err) {
    return NextResponse.json({ error: 'queue-missing', detail: (err as Error).message }, { status: 200 })
  }

  const queueEntries: LeaderboardEntry[] = queue.entries ?? []
  if (queueEntries.length === 0) {
    return NextResponse.json({ ok: true, merged: 0, reason: 'empty-queue' })
  }

  const current: LeaderboardSnapshot | null = await loadLeaderboardSnapshot()
  const existingHosts = new Set(
    (current?.entries ?? []).map((e) => e.host.toLowerCase()),
  )
  const freshEntries = queueEntries.filter((e) => !existingHosts.has(e.host.toLowerCase()))

  if (freshEntries.length === 0) {
    return NextResponse.json({
      ok: true,
      merged: 0,
      queueSize: queueEntries.length,
      reason: 'all-already-in-cohort',
    })
  }

  const merged: LeaderboardSnapshot = {
    capturedAt: new Date().toISOString(),
    cohortSize: (current?.entries ?? []).length + freshEntries.length,
    source: (current?.source ?? 'modelcontextprotocol.io') + '+discovery-2026-11-26',
    entries: [...(current?.entries ?? []), ...freshEntries],
  }

  await saveLeaderboardSnapshot(merged)
  revalidateTag('leaderboard')

  return NextResponse.json({
    ok: true,
    merged: freshEntries.length,
    queueSize: queueEntries.length,
    newCohortSize: merged.cohortSize,
  })
}

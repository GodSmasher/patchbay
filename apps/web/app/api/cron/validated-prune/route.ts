import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  loadLeaderboardSnapshot,
  saveLeaderboardSnapshot,
  type LeaderboardSnapshot,
} from '@/lib/leaderboard-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isAuthorised(req: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  return (req.headers.get('authorization') || '') === `Bearer ${expected}`
}

/**
 * GET /api/cron/validated-prune
 *
 * Removes entries from the live leaderboard snapshot whose host is listed in
 * apps/web/data/prune-list.json. The prune list is produced by running an
 * out-of-band validation re-probe that drops hosts failing strict MCP-protocol
 * checks (no protocolVersion in response) or that have gone offline since the
 * original scan. Idempotent — a second run removes 0 extra hosts.
 *
 * Paired with /api/cron/ingest-discovery (one-way add): this is the one-way
 * remove. The /loader/data/discovery-queue.json file is the source of truth
 * for what SHOULD be in the snapshot; the ingest adds; this removes.
 */
export async function GET(req: Request): Promise<NextResponse> {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  }

  let prune: { hosts?: string[]; count?: number } = {}
  try {
    const path = join(process.cwd(), 'data', 'prune-list.json')
    prune = JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    return NextResponse.json({ error: 'prune-list-missing', detail: (err as Error).message }, { status: 200 })
  }

  const hosts = new Set((prune.hosts ?? []).map((h) => h.toLowerCase()))
  if (hosts.size === 0) {
    return NextResponse.json({ ok: true, removed: 0, reason: 'empty-prune-list' })
  }

  const current: LeaderboardSnapshot | null = await loadLeaderboardSnapshot()
  const existing = current?.entries ?? []
  if (existing.length === 0) {
    return NextResponse.json({ ok: true, removed: 0, reason: 'empty-snapshot' })
  }

  const kept = existing.filter((e) => !hosts.has(e.host.toLowerCase()))
  const removed = existing.length - kept.length

  if (removed === 0) {
    return NextResponse.json({ ok: true, removed: 0, reason: 'none-matched', pruneListSize: hosts.size })
  }

  const pruned: LeaderboardSnapshot = {
    capturedAt: new Date().toISOString(),
    cohortSize: kept.length,
    source: (current?.source ?? 'validated') + '+pruned-2026-11-26',
    entries: kept,
  }

  await saveLeaderboardSnapshot(pruned)
  revalidateTag('leaderboard')

  return NextResponse.json({
    ok: true,
    removed,
    pruneListSize: hosts.size,
    newCohortSize: pruned.cohortSize,
  })
}

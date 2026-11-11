#!/usr/bin/env node
/**
 * Transform a mcp-sweep JSON (written by scripts/audit-sweep.ts) into a
 * leaderboard snapshot and POST it to the live /api/leaderboard/upload
 * endpoint. The endpoint writes to Vercel KV and triggers a cache bust
 * on the `leaderboard` revalidation tag so the SSG pages refresh.
 *
 * Usage:
 *   npx tsx scripts/leaderboard-upload.ts <sweep.json> [--url=<base>] [--dry-run]
 *
 * --url     Base URL of the web app (default: $PATCHBAY_PUBLISH_URL or
 *           https://patchbay-mcp.dev).
 * --dry-run Print the transformed payload instead of posting.
 *
 * Expects PATCHBAY_LEADERBOARD_UPLOAD_TOKEN in env; sent as x-upload-token
 * so the endpoint can refuse random POSTs.
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { letterGrade, score as scoreFn } from '@patchbay-nebius/audit-core'
import type { Severity } from '@patchbay-nebius/audit-core'
import {
  slugForHost,
  type LeaderboardCategory,
  type LeaderboardEntry,
  type LeaderboardFindingCounts,
  type LeaderboardSnapshot,
} from '../apps/web/lib/leaderboard-store'

interface SweepFinding { id: string; severity: Severity; title?: string }
interface SweepRemote { reachable?: boolean; authRequired?: boolean; tools?: unknown[]; oauthAuthServer?: unknown; oauthProtectedResource?: unknown }
interface SweepResult { url: string; error?: string; findings?: SweepFinding[]; remote?: SweepRemote; reportId?: string }
interface SweepFile { capturedAt?: string; targets?: string[]; results?: SweepResult[] }

const argv = process.argv.slice(2)
const path = argv.find((a) => !a.startsWith('--'))
const urlFlag = argv.find((a) => a.startsWith('--url='))?.slice('--url='.length)
const dryRun = argv.includes('--dry-run')
if (!path) {
  console.error('usage: leaderboard-upload.ts <sweep.json> [--url=<base>] [--dry-run]')
  process.exit(2)
}

const sweep = JSON.parse(readFileSync(path, 'utf8')) as SweepFile

function emptyCounts(): LeaderboardFindingCounts {
  return { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
}

function categoriseResult(r: SweepResult): LeaderboardCategory {
  if (!r.remote?.reachable) return 'unreachable'
  if (r.remote.oauthAuthServer) return 'oauth-protected'
  if (r.remote.oauthProtectedResource) return 'oauth-protected'
  if (r.remote.authRequired) return 'oauth-protected'
  return 'public-by-design'
}

function normaliseGrade(raw: string): 'A' | 'B' | 'C' | 'D' | 'F' {
  const first = raw[0]?.toUpperCase() ?? 'F'
  if (first === 'A' || first === 'B' || first === 'C' || first === 'D') return first
  return 'F'
}

const entries: LeaderboardEntry[] = (sweep.results ?? []).map((r) => {
  const reachable = Boolean(r.remote?.reachable)
  const counts = emptyCounts()
  for (const f of r.findings ?? []) {
    if (counts[f.severity] !== undefined) counts[f.severity] += 1
  }
  // Unreachable hosts have zero findings only because nothing could be
  // evaluated. Flagging them as grade A / score 100 would be misleading,
  // so we explicitly mark them as unscored (grade F, score 0) and the
  // UI pulls them into a separate "not scored" section.
  const num = reachable ? scoreFn(counts) : 0
  const grade = reachable ? normaliseGrade(letterGrade(num)) : 'F'
  let host = r.url
  try { host = new URL(r.url).host } catch { /* keep raw */ }
  const topFindingIds = (r.findings ?? [])
    .filter((f) => f.severity === 'critical' || f.severity === 'high' || f.severity === 'medium')
    .slice(0, 5)
    .map((f) => f.id)
  return {
    slug: slugForHost(host),
    host,
    url: r.url,
    score: num,
    grade,
    findings: counts,
    topFindingIds,
    reachable,
    category: categoriseResult(r),
    lastScanned: sweep.capturedAt ?? new Date().toISOString(),
    reportId: r.reportId,
  }
})

entries.sort((a, b) => b.score - a.score || a.host.localeCompare(b.host))

const snapshot: LeaderboardSnapshot = {
  capturedAt: sweep.capturedAt ?? new Date().toISOString(),
  cohortSize: entries.length,
  source: basename(path),
  entries,
}

async function main() {
  if (dryRun) {
    console.log(JSON.stringify({
      capturedAt: snapshot.capturedAt,
      cohortSize: snapshot.cohortSize,
      source: snapshot.source,
      sample: snapshot.entries.slice(0, 5),
      gradeBreakdown: snapshot.entries.reduce<Record<string, number>>((acc, e) => {
        acc[e.grade] = (acc[e.grade] ?? 0) + 1
        return acc
      }, {}),
    }, null, 2))
    return
  }

  const base = urlFlag ?? process.env.PATCHBAY_PUBLISH_URL ?? 'https://patchbay-mcp.dev'
  const token = process.env.PATCHBAY_LEADERBOARD_UPLOAD_TOKEN
  if (!token) {
    console.error('PATCHBAY_LEADERBOARD_UPLOAD_TOKEN env var is required (sent as x-upload-token).')
    process.exit(2)
  }

  const res = await fetch(`${base}/api/leaderboard/upload`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-upload-token': token },
    body: JSON.stringify(snapshot),
  })

  if (!res.ok) {
    console.error(`upload failed: HTTP ${res.status} ${await res.text().catch(() => '')}`)
    process.exit(1)
  }

  const body = await res.json().catch(() => ({})) as { ok?: boolean; cohortSize?: number }
  console.log(`uploaded ${entries.length} entries to ${base}/leaderboard (${body.cohortSize ?? '?'} returned)`)
}

main().catch((e) => { console.error(e); process.exit(1) })

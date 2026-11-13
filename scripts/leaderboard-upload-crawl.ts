#!/usr/bin/env node
/**
 * Take a directory of per-host JSONs produced by crawl-dual.ts and POST
 * the resulting snapshot to the leaderboard upload endpoint. Companion
 * to the single-sweep leaderboard-upload.ts.
 *
 * Usage:
 *   npx tsx scripts/leaderboard-upload-crawl.ts bench/crawl-dual/ [--url=<base>] [--dry-run]
 */
import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { letterGrade, score as scoreFn } from '@patchbay-nebius/audit-core'
import type { Severity } from '@patchbay-nebius/audit-core'
import {
  slugForHost,
  type LeaderboardCategory,
  type LeaderboardEntry,
  type LeaderboardFindingCounts,
  type LeaderboardScanSource,
  type LeaderboardSnapshot,
} from '../apps/web/lib/leaderboard-store'

interface CrawlFinding { id: string; severity: Severity; title?: string; source: 'live' | 'source' }
interface CrawlTier { ok: boolean; findings: CrawlFinding[]; error?: string }
interface CrawlResult {
  name: string
  remoteUrl: string
  repositoryUrl?: string
  capturedAt: string
  liveTier?: CrawlTier
  sourceTier?: CrawlTier
  mergedFindings: CrawlFinding[]
  scanSource: LeaderboardScanSource
}

const argv = process.argv.slice(2)
const path = argv.find((a) => !a.startsWith('--'))
const urlFlag = argv.find((a) => a.startsWith('--url='))?.slice('--url='.length)
const dryRun = argv.includes('--dry-run')
if (!path) {
  console.error('usage: leaderboard-upload-crawl.ts <crawl-dir> [--url=<base>] [--dry-run]')
  process.exit(2)
}

function emptyCounts(): LeaderboardFindingCounts {
  return { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
}

function normaliseGrade(raw: string): 'A' | 'B' | 'C' | 'D' | 'F' {
  const first = raw[0]?.toUpperCase() ?? 'F'
  if (first === 'A' || first === 'B' || first === 'C' || first === 'D') return first
  return 'F'
}

function hostFromUrl(u: string): string { try { return new URL(u).host } catch { return u } }

function categoryFor(r: CrawlResult): LeaderboardCategory {
  if (r.scanSource === 'unreachable') return 'unreachable'
  const authFinding = r.mergedFindings.some((f) => f.id === 'AUTH-003' || f.id === 'AUTH-005' || f.id === 'RESOURCE-001')
  if (authFinding) return 'oauth-protected'
  return 'public-by-design'
}

function mapEntry(r: CrawlResult): LeaderboardEntry {
  const counts = emptyCounts()
  for (const f of r.mergedFindings) {
    if (counts[f.severity] !== undefined) counts[f.severity] += 1
  }
  const reachable = r.scanSource !== 'unreachable'
  const num = reachable ? scoreFn(counts) : 0
  const grade = reachable ? normaliseGrade(letterGrade(num)) : 'F'
  const host = hostFromUrl(r.remoteUrl)
  const topFindingIds = r.mergedFindings
    .filter((f) => f.severity === 'critical' || f.severity === 'high' || f.severity === 'medium')
    .slice(0, 5)
    .map((f) => f.id)
  return {
    slug: slugForHost(host),
    host,
    url: r.remoteUrl,
    score: num,
    grade,
    findings: counts,
    topFindingIds,
    reachable,
    category: categoryFor(r),
    lastScanned: r.capturedAt,
    scanSource: r.scanSource,
    repositoryUrl: r.repositoryUrl,
    registrySource: 'modelcontextprotocol.io',
    registryName: r.name,
    authRequired: r.liveTier?.ok === true
      ? r.mergedFindings.some((f) => f.id === 'AUTH-001' && f.source === 'live')
      : undefined,
  }
}

async function main(): Promise<void> {
  const files = readdirSync(path!).filter((f) => f.endsWith('.json'))
  if (!files.length) {
    console.error('no .json files found in ' + path)
    process.exit(2)
  }

  const entries: LeaderboardEntry[] = []
  for (const f of files) {
    try {
      const r = JSON.parse(readFileSync(join(path!, f), 'utf8')) as CrawlResult
      entries.push(mapEntry(r))
    } catch (e) {
      console.error('skip ' + f + ': ' + (e as Error).message)
    }
  }
  entries.sort((a, b) => b.score - a.score || a.host.localeCompare(b.host))

  const snapshot: LeaderboardSnapshot = {
    capturedAt: new Date().toISOString(),
    cohortSize: entries.length,
    source: basename(path!),
    entries,
  }

  if (dryRun) {
    console.log(JSON.stringify({
      cohortSize: snapshot.cohortSize,
      sample: snapshot.entries.slice(0, 5),
      gradeBreakdown: snapshot.entries.reduce<Record<string, number>>((acc, e) => {
        acc[e.grade] = (acc[e.grade] ?? 0) + 1
        return acc
      }, {}),
      scanSourceBreakdown: snapshot.entries.reduce<Record<string, number>>((acc, e) => {
        const k = e.scanSource ?? 'unknown'
        acc[k] = (acc[k] ?? 0) + 1
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
    console.error('upload failed: HTTP ' + res.status + ' ' + (await res.text().catch(() => '')))
    process.exit(1)
  }
  const body = await res.json().catch(() => ({})) as { ok?: boolean; cohortSize?: number }
  console.log('uploaded ' + entries.length + ' entries to ' + base + '/leaderboard (' + (body.cohortSize ?? '?') + ' returned)')
}

main().catch((e) => { console.error(e); process.exit(1) })

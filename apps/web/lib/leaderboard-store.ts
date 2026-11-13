import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { kv } from '@vercel/kv'

/**
 * Leaderboard store.
 *
 * One snapshot per sweep: an ordered array of entries plus meta (when the
 * sweep ran, cohort size, which source file it came from). The whole
 * snapshot lives under `patchbay:leaderboard:latest`; per-host details
 * also live under `patchbay:leaderboard:host:<slug>` so the dynamic
 * detail route can fetch a single entry without pulling the full list.
 *
 * Storage is the same three-tier fallback as report-store:
 *   1. Vercel KV when KV_REST_API_URL + KV_REST_API_TOKEN are set.
 *   2. Filesystem under <tmpdir>/patchbay-leaderboard/ in dev.
 *   3. In-memory Map as last resort.
 *
 * Writes are driven by `scripts/leaderboard-upload.ts`, which transforms a
 * raw sweep JSON into entries and POSTs them to /api/leaderboard/upload.
 * Reads happen in the SSG /leaderboard page and the /api/leaderboard JSON
 * route; both tag their revalidation on `leaderboard` so an upload can
 * trigger a cache bust via `revalidateTag('leaderboard')`.
 */

export type LeaderboardGrade = 'A' | 'B' | 'C' | 'D' | 'F'
export type LeaderboardCategory = 'oauth-protected' | 'public-by-design' | 'internal' | 'unreachable'
export type LeaderboardScanSource =
  | 'live-metadata+source'
  | 'live-metadata'
  | 'source'
  | 'authenticated'
  | 'operator-verified'
  | 'unreachable'

export interface LeaderboardFindingCounts {
  critical: number
  high: number
  medium: number
  low: number
  info: number
}

export interface LeaderboardEntry {
  slug: string
  host: string
  url: string
  score: number
  grade: LeaderboardGrade
  findings: LeaderboardFindingCounts
  topFindingIds: string[]
  reachable: boolean
  category: LeaderboardCategory
  lastScanned: string
  reportId?: string
  /**
   * Which tier(s) of the dual-tier crawler produced this entry's findings.
   * 'live-metadata+source' means both tiers ran; 'live-metadata' means
   * source clone was skipped or failed; 'source' means the live URL was
   * unreachable but the repo audited fine; 'authenticated' / 'operator-
   * verified' are Tier C flavours. UI shows a badge per tier.
   */
  scanSource?: LeaderboardScanSource
  /** True when the live probe hit 401/403 on tools/list. */
  authRequired?: boolean
  /** The repository.url the registry listed for this server, if any. */
  repositoryUrl?: string
  /** Which registry fed us this entry. */
  registrySource?: 'modelcontextprotocol.io' | 'manual' | 'community-submit'
  /**
   * Original MCP server name as registered (registry entries carry a
   * canonical dotted name like "ac.inference.sh/mcp" that is nicer to
   * show than the raw host).
   */
  registryName?: string
  /**
   * Coordinated-disclosure state. 'embargoed' hides the entry from the
   * public leaderboard list and the per-host page until the embargo
   * lifts (`embargoUntil` reached, or the operator asks us to publish
   * sooner). Entries with secret-level findings default to embargoed
   * on first ingest and move to 'public' after the window expires or
   * the operator claims the listing with a "resolved" state.
   */
  disclosureState?: 'public' | 'embargoed'
  /** ISO date when the embargo lifts automatically. */
  embargoUntil?: string
  /** Free-form note for the leaderboard "under disclosure" badge. */
  disclosureNote?: string
}

export interface LeaderboardSnapshot {
  capturedAt: string
  cohortSize: number
  source: string
  entries: LeaderboardEntry[]
}

const SNAPSHOT_KEY = 'patchbay:leaderboard:latest'
const HOST_PREFIX = 'patchbay:leaderboard:host:'
const TTL_SECONDS = 60 * 60 * 24 * 90

const DEV_DIR = join(tmpdir(), 'patchbay-leaderboard')
const memory: { snapshot: LeaderboardSnapshot | null; byHost: Map<string, LeaderboardEntry> } = {
  snapshot: null,
  byHost: new Map(),
}

function kvAvailable(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

function devFileAvailable(): boolean {
  return process.env.NODE_ENV !== 'production'
}

function ensureDir(): void {
  try { mkdirSync(DEV_DIR, { recursive: true }) } catch { /* best-effort */ }
}

function devSnapshotPath(): string {
  return join(DEV_DIR, 'snapshot.json')
}

function devHostPath(slug: string): string {
  return join(DEV_DIR, 'host-' + slug + '.json')
}

function readDevJson<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return null
  }
}

function writeDevJson(path: string, value: unknown): void {
  try {
    ensureDir()
    writeFileSync(path, JSON.stringify(value), 'utf8')
  } catch { /* best-effort */ }
}

export async function saveLeaderboardSnapshot(snapshot: LeaderboardSnapshot): Promise<void> {
  if (kvAvailable()) {
    await kv.set(SNAPSHOT_KEY, snapshot, { ex: TTL_SECONDS })
    for (const entry of snapshot.entries) {
      await kv.set(HOST_PREFIX + entry.slug, entry, { ex: TTL_SECONDS })
    }
    return
  }
  if (devFileAvailable()) {
    writeDevJson(devSnapshotPath(), snapshot)
    for (const entry of snapshot.entries) {
      writeDevJson(devHostPath(entry.slug), entry)
    }
    return
  }
  memory.snapshot = snapshot
  memory.byHost = new Map(snapshot.entries.map((e) => [e.slug, e]))
}

function filterPublic(snapshot: LeaderboardSnapshot | null): LeaderboardSnapshot | null {
  if (!snapshot) return null
  const now = new Date().toISOString()
  const visible = snapshot.entries.filter((e) => {
    if (e.disclosureState !== 'embargoed') return true
    return e.embargoUntil ? e.embargoUntil <= now : false
  })
  return { ...snapshot, entries: visible, cohortSize: visible.length }
}

/**
 * Returns the public view of the snapshot — embargoed entries are
 * hidden until their embargo date passes. Pass includeEmbargoed=true
 * from the admin/report pipelines only.
 */
export async function loadLeaderboardSnapshot(includeEmbargoed = false): Promise<LeaderboardSnapshot | null> {
  if (kvAvailable()) {
    const snap = await kv.get<LeaderboardSnapshot>(SNAPSHOT_KEY)
    return includeEmbargoed ? (snap ?? null) : filterPublic(snap ?? null)
  }
  if (devFileAvailable()) {
    const snap = readDevJson<LeaderboardSnapshot>(devSnapshotPath())
    return includeEmbargoed ? snap : filterPublic(snap)
  }
  return includeEmbargoed ? memory.snapshot : filterPublic(memory.snapshot)
}

function isPublic(entry: LeaderboardEntry | null): LeaderboardEntry | null {
  if (!entry) return null
  if (entry.disclosureState !== 'embargoed') return entry
  if (entry.embargoUntil && entry.embargoUntil <= new Date().toISOString()) return entry
  return null
}

export async function loadLeaderboardEntry(slug: string, includeEmbargoed = false): Promise<LeaderboardEntry | null> {
  if (kvAvailable()) {
    const entry = await kv.get<LeaderboardEntry>(HOST_PREFIX + slug)
    return includeEmbargoed ? (entry ?? null) : isPublic(entry ?? null)
  }
  if (devFileAvailable()) {
    const entry = readDevJson<LeaderboardEntry>(devHostPath(slug))
    return includeEmbargoed ? entry : isPublic(entry)
  }
  const entry = memory.byHost.get(slug) ?? null
  return includeEmbargoed ? entry : isPublic(entry)
}

export function slugForHost(host: string): string {
  return host
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

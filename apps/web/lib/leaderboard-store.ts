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
    const pipe = kv.multi()
    for (const entry of snapshot.entries) {
      pipe.set(HOST_PREFIX + entry.slug, entry, { ex: TTL_SECONDS })
    }
    await pipe.exec()
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

export async function loadLeaderboardSnapshot(): Promise<LeaderboardSnapshot | null> {
  if (kvAvailable()) {
    const snap = await kv.get<LeaderboardSnapshot>(SNAPSHOT_KEY)
    return snap ?? null
  }
  if (devFileAvailable()) {
    return readDevJson<LeaderboardSnapshot>(devSnapshotPath())
  }
  return memory.snapshot
}

export async function loadLeaderboardEntry(slug: string): Promise<LeaderboardEntry | null> {
  if (kvAvailable()) {
    const entry = await kv.get<LeaderboardEntry>(HOST_PREFIX + slug)
    return entry ?? null
  }
  if (devFileAvailable()) {
    return readDevJson<LeaderboardEntry>(devHostPath(slug))
  }
  return memory.byHost.get(slug) ?? null
}

export function slugForHost(host: string): string {
  return host
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { kv } from '@vercel/kv'

/**
 * Report store for shareable scan URLs.
 *
 * Writes: `POST /api/report` stores an AuditReport JSON blob and returns
 * a short id. The id is derived from a hash of the report body so two
 * identical reports deduplicate (useful when a CI run re-publishes the
 * same scan, we don't want a thousand duplicate ids).
 *
 * Reads: `/report/[id]` fetches the JSON and renders it.
 *
 * Badge lookup: when a report is stored, we ALSO write a "latest-by-target"
 * pointer so `/api/badge/<target>` can resolve the current score for that
 * URL without the caller knowing the report id.
 *
 * Storage:
 *  1. Vercel KV (Upstash Redis) when KV_REST_API_URL and KV_REST_API_TOKEN
 *     are set in env. This is production.
 *  2. Filesystem under `<tmpdir>/patchbay-reports/` when NODE_ENV is
 *     development and KV is not configured. Lets `/report/[id]` see the
 *     JSON that `/api/scan` wrote across Next.js dev worker processes
 *     (in-memory Maps are per-worker).
 *  3. In-memory Map as a last-resort fallback for any other environment
 *     (survives a single request only).
 */

export interface StoredReport {
  id: string
  target: string
  summary: Record<string, number>
  storedAt: string
  body: unknown
}

const REPORT_PREFIX = 'patchbay:report:'
const LATEST_PREFIX = 'patchbay:latest:'
const TTL_SECONDS = 60 * 60 * 24 * 90 // 90 days

const memory = new Map<string, StoredReport>()
const memoryLatest = new Map<string, string>()

function kvAvailable(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

const DEV_DIR = join(tmpdir(), 'patchbay-reports')

function devFileAvailable(): boolean {
  return process.env.NODE_ENV === 'development'
}

function ensureDevDir(): void {
  try { mkdirSync(DEV_DIR, { recursive: true }) } catch { /* best-effort */ }
}

function devReportPath(id: string): string {
  return join(DEV_DIR, 'r-' + id + '.json')
}

function devLatestPath(key: string): string {
  return join(DEV_DIR, 'l-' + key + '.json')
}

function devReadJson<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return null
  }
}

function devWriteJson(path: string, value: unknown): void {
  try {
    ensureDevDir()
    writeFileSync(path, JSON.stringify(value), 'utf8')
  } catch { /* best-effort */ }
}

export function shortId(body: unknown): string {
  const json = typeof body === 'string' ? body : JSON.stringify(body)
  return createHash('sha256').update(json).digest('base64url').slice(0, 10)
}

export function targetKey(target: string): string {
  // Normalise so https://x.test/mcp and X.TEST/MCP collide. Drop trailing /.
  const lower = target.toLowerCase().replace(/\/+$/, '')
  return createHash('sha256').update(lower).digest('base64url').slice(0, 16)
}

export async function saveReport(entry: StoredReport): Promise<void> {
  if (kvAvailable()) {
    await kv.set(REPORT_PREFIX + entry.id, entry, { ex: TTL_SECONDS })
    await kv.set(LATEST_PREFIX + targetKey(entry.target), entry.id, { ex: TTL_SECONDS })
    return
  }
  if (devFileAvailable()) {
    devWriteJson(devReportPath(entry.id), entry)
    devWriteJson(devLatestPath(targetKey(entry.target)), { id: entry.id })
    return
  }
  memory.set(entry.id, entry)
  memoryLatest.set(targetKey(entry.target), entry.id)
}

export async function loadReport(id: string): Promise<StoredReport | null> {
  if (kvAvailable()) {
    const out = await kv.get<StoredReport>(REPORT_PREFIX + id)
    return out ?? null
  }
  if (devFileAvailable()) {
    return devReadJson<StoredReport>(devReportPath(id))
  }
  return memory.get(id) ?? null
}

export async function loadLatestForTarget(target: string): Promise<StoredReport | null> {
  const key = targetKey(target)
  if (kvAvailable()) {
    const id = await kv.get<string>(LATEST_PREFIX + key)
    if (!id) return null
    return loadReport(id)
  }
  if (devFileAvailable()) {
    const pointer = devReadJson<{ id: string }>(devLatestPath(key))
    if (!pointer) return null
    return loadReport(pointer.id)
  }
  const id = memoryLatest.get(key)
  if (!id) return null
  return memory.get(id) ?? null
}

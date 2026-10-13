import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { RunEvent } from '@patchbay/agent'

export interface SharedRun {
  prompt: string
  createdAt: string
  events: RunEvent[]
}

/**
 * Minimal file-backed share store: one JSON per shared run under $TMPDIR/patchbay-shares/.
 * Survives container restarts; cleaned up by whatever cleans /tmp. Deliberately not a KV
 * store — a demo link should outlive a single request but doesn't need forever persistence.
 */
const DIR = join(process.env.PATCHBAY_SHARE_DIR ?? tmpdir(), 'patchbay-shares')
const MAX_BYTES = 512 * 1024 // 512 kB per share, enough for 20+ repair attempts

function ensureDir() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
}

export function putShare(run: SharedRun): string {
  ensureDir()
  const payload = JSON.stringify(run)
  if (payload.length > MAX_BYTES) throw new Error(`Shared run too large (${payload.length} bytes, max ${MAX_BYTES}).`)
  const id = createHash('sha256').update(payload).update(Date.now().toString()).digest('base64url').slice(0, 12)
  writeFileSync(join(DIR, `${id}.json`), payload, 'utf8')
  return id
}

export function getShare(id: string): SharedRun | null {
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(id)) return null
  const path = join(DIR, `${id}.json`)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as SharedRun
  } catch {
    return null
  }
}

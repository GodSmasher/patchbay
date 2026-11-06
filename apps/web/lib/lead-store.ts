import { createHash, createHmac } from 'node:crypto'
import { kv } from '@vercel/kv'

/**
 * Lead store for the hosted /scan form.
 *
 * Captures (email, scanned target) so we have a warm list for the Jan 2027
 * hosted-monitoring launch. KV-backed when env present, in-memory otherwise.
 *
 * GDPR/CAN-SPAM: each email can unsubscribe via a signed token (no DB lookup
 * needed for the unsubscribe link). An unsubscribed email stays in the store
 * marked with `unsubscribed: true` so later imports / Nov-10 sender flows
 * must check `isUnsubscribed()` before sending.
 */

export interface Lead {
  email: string
  target: string
  reportId: string
  grade: string
  score: number
  source: 'web-scan' | 'cli' | 'tally'
  useCase?: string
  priceAnswer?: string
  capturedAt: string
  userAgent?: string
  ip?: string
}

const LEAD_PREFIX = 'patchbay:lead:'
const LEAD_INDEX = 'patchbay:leads:index'
const UNSUB_PREFIX = 'patchbay:unsub:'
const TTL_SECONDS = 60 * 60 * 24 * 365

const memory = new Map<string, Lead>()
const memoryIndex: string[] = []
const memoryUnsub = new Set<string>()

function kvAvailable(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

function normEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function leadKey(email: string, target: string): string {
  const seed = `${normEmail(email)}|${target.trim().toLowerCase()}`
  return createHash('sha256').update(seed).digest('base64url').slice(0, 16)
}

/**
 * HMAC-signed unsubscribe token. Deterministic (same email → same token), so
 * the unsubscribe link in an email never needs to hit a lookup table. Secret
 * comes from PATCHBAY_UNSUB_SECRET; in local dev falls back to a static string
 * (acceptable because dev KV is in-memory anyway).
 */
function unsubSecret(): string {
  return process.env.PATCHBAY_UNSUB_SECRET || 'dev-only-unsub-secret-change-in-prod'
}

export function unsubscribeToken(email: string): string {
  return createHmac('sha256', unsubSecret()).update(normEmail(email)).digest('base64url').slice(0, 24)
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = unsubscribeToken(email)
  // Constant-time-ish compare at this length — length is fixed and string compare
  // is fine for public opaque tokens.
  return expected === token
}

export interface SaveLeadResult {
  key: string
  isNew: boolean
  skipped?: 'unsubscribed'
}

/**
 * Idempotent save: same (email, target) pair never double-indexes, so one
 * person clicking Watch five times on the same server still counts as one
 * lead and the caller can gate the welcome mail on `isNew === true`.
 */
export async function saveLead(lead: Lead): Promise<SaveLeadResult> {
  const key = leadKey(lead.email, lead.target)
  if (await isUnsubscribed(lead.email)) {
    return { key, isNew: false, skipped: 'unsubscribed' }
  }
  if (kvAvailable()) {
    const existing = await kv.get<Lead>(LEAD_PREFIX + key)
    await kv.set(LEAD_PREFIX + key, lead, { ex: TTL_SECONDS })
    if (!existing) await kv.lpush(LEAD_INDEX, key)
    return { key, isNew: !existing }
  }
  const isNew = !memory.has(key)
  memory.set(key, lead)
  if (isNew) memoryIndex.unshift(key)
  return { key, isNew }
}

export async function leadCount(): Promise<number> {
  if (kvAvailable()) {
    return (await kv.llen(LEAD_INDEX)) ?? 0
  }
  return memoryIndex.length
}

export async function isUnsubscribed(email: string): Promise<boolean> {
  const e = normEmail(email)
  if (kvAvailable()) {
    return Boolean(await kv.get<number>(UNSUB_PREFIX + e))
  }
  return memoryUnsub.has(e)
}

export async function markUnsubscribed(email: string): Promise<void> {
  const e = normEmail(email)
  if (kvAvailable()) {
    await kv.set(UNSUB_PREFIX + e, Date.now())
    return
  }
  memoryUnsub.add(e)
}

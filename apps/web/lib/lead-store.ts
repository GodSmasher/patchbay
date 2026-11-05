import { createHash } from 'node:crypto'
import { kv } from '@vercel/kv'

/**
 * Lead store for the hosted /scan form.
 *
 * Captures (email, scanned target) so we have a warm list for the Jan 2027
 * hosted-monitoring launch. KV-backed when env present, in-memory otherwise.
 */

export interface Lead {
  email: string
  target: string
  reportId: string
  grade: string
  score: number
  source: 'web-scan'
  capturedAt: string
  userAgent?: string
  ip?: string
}

const LEAD_PREFIX = 'patchbay:lead:'
const LEAD_INDEX = 'patchbay:leads:index'
const TTL_SECONDS = 60 * 60 * 24 * 365

const memory = new Map<string, Lead>()
const memoryIndex: string[] = []

function kvAvailable(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

export function leadKey(email: string, target: string): string {
  const seed = `${email.trim().toLowerCase()}|${target.trim().toLowerCase()}`
  return createHash('sha256').update(seed).digest('base64url').slice(0, 16)
}

export async function saveLead(lead: Lead): Promise<string> {
  const key = leadKey(lead.email, lead.target)
  if (kvAvailable()) {
    await kv.set(LEAD_PREFIX + key, lead, { ex: TTL_SECONDS })
    await kv.lpush(LEAD_INDEX, key)
    return key
  }
  memory.set(key, lead)
  memoryIndex.unshift(key)
  return key
}

export async function leadCount(): Promise<number> {
  if (kvAvailable()) {
    return (await kv.llen(LEAD_INDEX)) ?? 0
  }
  return memoryIndex.length
}

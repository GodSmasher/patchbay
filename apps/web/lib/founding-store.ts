import { createHash } from 'node:crypto'
import { kv } from '@vercel/kv'

/**
 * Founding offer: the first 100 sign-ups get 50 % off the annual hosted plan.
 *
 * One claim per email. Positions come from an atomic INCR, so two people
 * submitting at the same moment can never both be #100. Claims after #100
 * are still stored (they are the regular waitlist) but marked founding:false.
 *
 * `ref` is a free-form campaign tag from the sign-up link (?ref=…), counted
 * per tag so we can see which channel converts (cold outreach, reddit, …).
 */

export const FOUNDING_LIMIT = 100
export const PRICE_REGULAR = 298
export const PRICE_FOUNDING = 149
export const PRICE_MONTHLY = 29.99

export interface FoundingClaim {
  email: string
  position: number
  founding: boolean
  serverUrl?: string
  ref?: string
  claimedAt: string
}

const EMAILS = 'patchbay:founding:emails'
const COUNTER = 'patchbay:founding:count'
const CLAIM_PREFIX = 'patchbay:founding:claim:'
const REFS = 'patchbay:founding:refs'

const memClaims = new Map<string, FoundingClaim>()
const memRefs = new Map<string, number>()
let memCounter = 0

function kvAvailable(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

function norm(email: string): string {
  return email.trim().toLowerCase()
}

function claimKey(email: string): string {
  return CLAIM_PREFIX + createHash('sha256').update(norm(email)).digest('base64url').slice(0, 16)
}

/** Total sign-ups so far (can exceed the limit; the page caps the display). */
export async function claimedCount(): Promise<number> {
  if (kvAvailable()) return (await kv.get<number>(COUNTER)) ?? 0
  return memCounter
}

export async function claimSpot(input: {
  email: string
  serverUrl?: string
  ref?: string
}): Promise<{ claim: FoundingClaim; isNew: boolean }> {
  const email = norm(input.email)

  if (kvAvailable()) {
    const added = await kv.sadd(EMAILS, email)
    if (added === 0) {
      const existing = await kv.get<FoundingClaim>(claimKey(email))
      if (existing) return { claim: existing, isNew: false }
    }
    const position = await kv.incr(COUNTER)
    const claim: FoundingClaim = {
      email,
      position,
      founding: position <= FOUNDING_LIMIT,
      serverUrl: input.serverUrl,
      ref: input.ref,
      claimedAt: new Date().toISOString(),
    }
    await kv.set(claimKey(email), claim)
    await kv.hincrby(REFS, input.ref || 'direct', 1)
    return { claim, isNew: true }
  }

  const existing = memClaims.get(email)
  if (existing) return { claim: existing, isNew: false }
  memCounter += 1
  const claim: FoundingClaim = {
    email,
    position: memCounter,
    founding: memCounter <= FOUNDING_LIMIT,
    serverUrl: input.serverUrl,
    ref: input.ref,
    claimedAt: new Date().toISOString(),
  }
  memClaims.set(email, claim)
  memRefs.set(input.ref || 'direct', (memRefs.get(input.ref || 'direct') ?? 0) + 1)
  return { claim, isNew: true }
}

/** Sign-ups per ?ref= tag. Admin only (see /api/founding). */
export async function refBreakdown(): Promise<Record<string, number>> {
  if (kvAvailable()) {
    const all = await kv.hgetall<Record<string, number>>(REFS)
    return all ?? {}
  }
  return Object.fromEntries(memRefs)
}

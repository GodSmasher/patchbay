import { NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import { Resend } from 'resend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RATE_WINDOW_SECONDS = 60
const RATE_LIMIT = 10

// Segment created via Resend MCP on 2026-11-17.
// IDs are not secrets: they identify the audience list we file subscribers into.
const WEEKLY_DIGEST_SEGMENT_ID = '45d0c7d0-8fc3-47b0-9188-1b979dea685a'

function kvAvailable(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

async function rateLimited(ip: string): Promise<boolean> {
  if (!kvAvailable()) return false
  const key = `patchbay:newsletter:rate:${ip}`
  const n = await kv.incr(key)
  if (n === 1) await kv.expire(key, RATE_WINDOW_SECONDS)
  return n > RATE_LIMIT
}

/**
 * POST /api/newsletter/subscribe
 *
 * Body: { email: string, source?: string }
 *
 * Creates a contact in the `patchbay-weekly-digest` Resend segment.
 * Resend sends the double-opt-in confirmation itself. Rate-limited per IP.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: { email?: string; source?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const email = (body.email ?? '').trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 })
  }
  const source = (body.source ?? 'site').slice(0, 64)

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (await rateLimited(ip)) {
    return NextResponse.json({ error: 'slow down' }, { status: 429 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('newsletter/subscribe: RESEND_API_KEY not configured')
    return NextResponse.json({ error: 'newsletter temporarily unavailable' }, { status: 503 })
  }

  try {
    const resend = new Resend(apiKey)
    const result = await resend.contacts.create({
      email,
      segmentIds: [WEEKLY_DIGEST_SEGMENT_ID],
      properties: { source },
    } as unknown as Parameters<typeof resend.contacts.create>[0])
    // Resend returns { data: { id }, error: null } on success; on duplicate it
    // returns { error: { name: 'validation_error', message: '...already exists' } }.
    const err = (result as unknown as { error?: { message?: string; name?: string } }).error
    if (err && !/already exists|duplicate/i.test(err.message ?? '')) {
      console.error('newsletter/subscribe: resend error', err)
      return NextResponse.json({ error: 'could not subscribe' }, { status: 502 })
    }
  } catch (e) {
    console.error('newsletter/subscribe: exception', e)
    return NextResponse.json({ error: 'could not subscribe' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}

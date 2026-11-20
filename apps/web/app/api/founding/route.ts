import { NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import { waitUntil } from '@vercel/functions'
import { claimSpot, claimedCount, refBreakdown, FOUNDING_LIMIT } from '@/lib/founding-store'
import { saveLead } from '@/lib/lead-store'
import { sendFoundingMail } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const REF_RE = /^[\w.-]{1,64}$/
const RATE_WINDOW_SECONDS = 60
const RATE_LIMIT = 10
const SITE_TARGET = 'site:early-access'

function kvAvailable(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

async function rateLimited(ip: string): Promise<boolean> {
  if (!kvAvailable()) return false
  const key = `patchbay:founding:rate:${ip}`
  const n = await kv.incr(key)
  if (n === 1) await kv.expire(key, RATE_WINDOW_SECONDS)
  return n > RATE_LIMIT
}

function totals(claimed: number) {
  return { claimed: Math.min(claimed, FOUNDING_LIMIT), limit: FOUNDING_LIMIT, remaining: Math.max(0, FOUNDING_LIMIT - claimed) }
}

/**
 * GET  /api/founding → { claimed, limit, remaining } for the live counter.
 *      With `Authorization: Bearer $PATCHBAY_ADMIN_TOKEN` it also returns
 *      { total, refs } — sign-ups per ?ref= tag, to see which channel converts.
 * POST /api/founding  { email, serverUrl?, ref? } → claims a founding spot.
 */
export async function GET(request: Request): Promise<Response> {
  const claimed = await claimedCount()
  const admin = process.env.PATCHBAY_ADMIN_TOKEN
  if (admin && request.headers.get('authorization') === `Bearer ${admin}`) {
    return NextResponse.json({ ...totals(claimed), total: claimed, refs: await refBreakdown() })
  }
  return NextResponse.json(totals(claimed), { headers: { 'cache-control': 'no-store' } })
}

export async function POST(request: Request): Promise<Response> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  if (await rateLimited(ip)) {
    return NextResponse.json({ error: 'too many requests, slow down' }, { status: 429 })
  }

  let body: { email?: string; serverUrl?: string; ref?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'body must be JSON' }, { status: 400 })
  }

  const email = (body.email ?? '').trim()
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'email looks invalid' }, { status: 400 })
  }

  let serverUrl: string | undefined
  const rawUrl = (body.serverUrl ?? '').trim()
  if (rawUrl) {
    try {
      const u = new URL(rawUrl)
      if (u.protocol !== 'https:' || rawUrl.length > 300) throw new Error()
      serverUrl = u.toString()
    } catch {
      return NextResponse.json({ error: 'server URL must be an https:// address' }, { status: 400 })
    }
  }
  const ref = typeof body.ref === 'string' && REF_RE.test(body.ref) ? body.ref : undefined

  const { claim, isNew } = await claimSpot({ email, serverUrl, ref })

  // Same list as every other sign-up, so unsubscribe and the launch mail
  // keep working from one place.
  const lead = await saveLead({
    email,
    target: serverUrl ?? SITE_TARGET,
    reportId: '',
    grade: '?',
    score: 0,
    source: 'site',
    page: '/early-access',
    capturedAt: claim.claimedAt,
    userAgent: request.headers.get('user-agent') ?? undefined,
    ip,
  })

  if (isNew && !lead.skipped) {
    waitUntil(
      sendFoundingMail({ email, position: claim.position, founding: claim.founding }).then((res) => {
        if (!res.ok) console.error('founding mail failed:', res.error)
      }),
    )
  }

  return NextResponse.json({
    ok: true,
    position: claim.position,
    founding: claim.founding,
    alreadyClaimed: !isNew,
    ...totals(await claimedCount()),
  })
}

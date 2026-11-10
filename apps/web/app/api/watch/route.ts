import { NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import { waitUntil } from '@vercel/functions'
import { saveLead, leadCount } from '@/lib/lead-store'
import { sendTallyWelcomeMail, sendWelcomeMail } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RATE_WINDOW_SECONDS = 60
const RATE_LIMIT = 10
// Leads from the standalone signup box (blog, docs) have no scanned server.
const SITE_TARGET = 'site:early-access'

function kvAvailable(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

async function rateLimited(ip: string): Promise<boolean> {
  if (!kvAvailable()) return false
  const key = `patchbay:watch:rate:${ip}`
  const n = await kv.incr(key)
  if (n === 1) await kv.expire(key, RATE_WINDOW_SECONDS)
  return n > RATE_LIMIT
}

/**
 * POST /api/watch
 *
 * Body: { email, target, reportId, grade, score }
 *   or: { email, source: 'site', page } from the signup box on blog and docs
 *       pages, where nothing was scanned.
 *
 * Opt-in watch registration for a scanned server. Called from the /scan
 * post-report CTA. Writes into the shared lead-store so the same email+target
 * dedupes.
 *
 * GET /api/watch returns the aggregate lead count for the social-proof counter.
 */
export async function POST(request: Request): Promise<Response> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  if (await rateLimited(ip)) {
    return NextResponse.json({ error: 'too many requests, slow down' }, { status: 429 })
  }

  let body: { email?: string; target?: string; reportId?: string; grade?: string; score?: number; source?: string; page?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'body must be JSON' }, { status: 400 })
  }

  const email = (body.email ?? '').trim()
  const target = (body.target ?? '').trim()
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'email looks invalid' }, { status: 400 })
  if (!target && body.source === 'site') {
    const page = typeof body.page === 'string' && /^\/[\w\-./]{0,200}$/.test(body.page) ? body.page : undefined
    const savedSite = await saveLead({
      email,
      target: SITE_TARGET,
      reportId: '',
      grade: '?',
      score: 0,
      source: 'site',
      page,
      capturedAt: new Date().toISOString(),
      userAgent: request.headers.get('user-agent') ?? undefined,
      ip,
    })
    if (savedSite.isNew && !savedSite.skipped) {
      waitUntil(
        sendTallyWelcomeMail({ email, origin: 'site' }).then((res) => {
          if (!res.ok) console.error('site welcome mail failed:', res.error)
          else console.log('site welcome mail sent to', email)
        }),
      )
    }
    return NextResponse.json({ ok: true, watcherCount: await leadCount(), alreadyWatching: !savedSite.isNew })
  }

  if (!target) return NextResponse.json({ error: 'missing target' }, { status: 400 })

  const saved = await saveLead({
    email,
    target,
    reportId: body.reportId ?? '',
    grade: body.grade ?? '?',
    score: body.score ?? 0,
    source: 'web-scan',
    capturedAt: new Date().toISOString(),
    userAgent: request.headers.get('user-agent') ?? undefined,
    ip,
  })

  // Only send the welcome mail the first time this (email, target) pair
  // is saved. Subsequent clicks are no-ops: no duplicate lead, no duplicate
  // mail. Also skip unsubscribed addresses.
  if (saved.isNew && !saved.skipped) {
    waitUntil(
      sendWelcomeMail({
        email,
        target,
        grade: body.grade ?? '?',
        score: body.score ?? 0,
        reportId: body.reportId ?? '',
      }).then((res) => {
        if (!res.ok) console.error('welcome mail failed:', res.error)
        else console.log('welcome mail sent to', email)
      }),
    )
  } else {
    console.log('watch repeat (no mail):', email, '→', target, 'skipped:', saved.skipped ?? 'duplicate')
  }

  const total = await leadCount()
  return NextResponse.json({ ok: true, watcherCount: total, alreadyWatching: !saved.isNew })
}

export async function GET(): Promise<Response> {
  const total = await leadCount()
  return NextResponse.json({ watcherCount: total })
}

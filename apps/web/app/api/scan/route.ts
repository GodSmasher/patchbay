import { NextResponse } from 'next/server'
import { auditTarget, score, letterGrade } from '@patchbay-nebius/audit-core'
import { kv } from '@vercel/kv'
import { saveReport, shortId, type StoredReport } from '@/lib/report-store'
import { saveLead } from '@/lib/lead-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * POST /api/scan
 *
 * Body: { url: string, email?: string }
 *
 * Runs auditTarget() server-side against the URL, stores the resulting
 * report so it can be viewed at /report/<id>, and (if email provided)
 * captures a lead for the Jan 2027 hosted-monitoring launch.
 *
 * No auth. Rate-limited per IP so we are not weaponised as a DDoS reflector.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RATE_WINDOW_SECONDS = 60
const RATE_LIMIT = 5

function kvAvailable(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

async function rateLimited(ip: string): Promise<boolean> {
  if (!kvAvailable()) return false
  const key = `patchbay:scan:rate:${ip}`
  const n = await kv.incr(key)
  if (n === 1) await kv.expire(key, RATE_WINDOW_SECONDS)
  return n > RATE_LIMIT
}

export async function POST(request: Request): Promise<Response> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  if (await rateLimited(ip)) {
    return NextResponse.json(
      { error: 'rate limit exceeded, try again in a minute' },
      { status: 429 },
    )
  }

  let body: { url?: string; email?: string }
  try {
    body = (await request.json()) as { url?: string; email?: string }
  } catch {
    return NextResponse.json({ error: 'body must be JSON' }, { status: 400 })
  }

  const url = (body.url ?? '').trim()
  const email = (body.email ?? '').trim()

  if (!/^https:\/\/[^\s]+$/i.test(url)) {
    return NextResponse.json(
      { error: 'url must start with https://' },
      { status: 400 },
    )
  }

  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'email looks invalid' }, { status: 400 })
  }

  let report
  try {
    report = await auditTarget(url, { timeoutMs: 8000 })
  } catch (e) {
    return NextResponse.json(
      { error: `scan failed: ${(e as Error).message}` },
      { status: 502 },
    )
  }

  const raw = JSON.stringify(report)
  const id = shortId(raw)
  const stored: StoredReport = {
    id,
    target: report.target,
    summary: report.summary,
    storedAt: new Date().toISOString(),
    body: report,
  }
  await saveReport(stored)

  const num = score(report.summary)
  const grade = letterGrade(num)

  if (email) {
    await saveLead({
      email,
      target: url,
      reportId: id,
      grade,
      score: num,
      source: 'web-scan',
      capturedAt: new Date().toISOString(),
      userAgent: request.headers.get('user-agent') ?? undefined,
      ip,
    })
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://patchbay-mcp.dev'
  return NextResponse.json({
    id,
    url: `${base}/report/${id}`,
    grade,
    score: num,
    findings: report.summary,
  })
}

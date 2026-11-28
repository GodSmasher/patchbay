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

  // Short-circuit for hosts that aren't actually MCP servers. An empty
  // finding set against a non-MCP URL would otherwise score 100 and
  // return A+ — misleading for anyone who typed the wrong URL (bug
  // reported by adam@trigger.tools, 2026-11-28). No stored report, no
  // badge, UI shows "Inconclusive" instead.
  const remote = report.snapshot?.remote
  const reachable = !!remote?.reachable
  if (!reachable) {
    return NextResponse.json({
      reachable: false,
      target: url,
      hint: 'No MCP server responded at this URL. Double-check the scheme, host and path. MCP endpoints usually end with /mcp.',
    })
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

  // Top-3 source-confirmed findings for the /audit landing's inline report.
  // Severity order: critical < high < medium < low < info. Only
  // source-confirmed slips through the gate — never promote a potential-fp
  // to a landing-page preview.
  const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
  const topFindings = [...report.findings]
    .filter((f) => f.verification === 'source-confirmed')
    .sort((a, b) => (sevOrder[a.severity] ?? 99) - (sevOrder[b.severity] ?? 99))
    .slice(0, 3)
    .map((f) => ({ id: f.id, severity: f.severity, title: f.title, docsUrl: f.docsUrl }))

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
    reachable: true,
    grade,
    score: num,
    findings: report.summary,
    topFindings,
  })
}

import { NextResponse } from 'next/server'
import { saveReport, shortId, type StoredReport } from '@/lib/report-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 256 * 1024

/**
 * POST /api/report
 *
 * Body: an AuditReport JSON blob as emitted by the CLI. We store the body,
 * derive a short id from its hash (so identical re-publishes deduplicate),
 * and return `{ id, url }` for the caller to print.
 *
 * Deliberately no auth. This is an opt-in publishing endpoint: the CLI
 * only hits it when the user passes `--publish`. Anyone who knows the id
 * can view the report.
 */
export async function POST(request: Request): Promise<Response> {
  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'report too large' }, { status: 413 })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'body must be valid JSON' }, { status: 400 })
  }

  const report = parsed as { target?: string; summary?: Record<string, number> }
  if (!report || typeof report.target !== 'string' || !report.summary) {
    return NextResponse.json({ error: 'body must look like an AuditReport' }, { status: 400 })
  }

  const id = shortId(raw)
  const entry: StoredReport = {
    id,
    target: report.target,
    summary: report.summary,
    storedAt: new Date().toISOString(),
    body: parsed,
  }
  await saveReport(entry)

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://patchbay-mcp.dev'
  return NextResponse.json({ id, url: `${base}/report/${id}` })
}

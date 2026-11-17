import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { buildWeeklyDigest } from '@/lib/weekly-digest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Vercel Cron Jobs deliver a GET with Authorization: Bearer <CRON_SECRET>.
// The secret is set in the Vercel dashboard and MUST also be present here.
function isAuthorised(req: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const auth = req.headers.get('authorization') || ''
  return auth === `Bearer ${expected}`
}

/**
 * GET /api/cron/weekly-digest
 *
 * Tuesday 08:00 UTC. Reads the latest sweep aggregate + weekly rescan
 * report, renders the digest, sends to the `patchbay-weekly-digest`
 * Resend segment as a broadcast. Dry-run by default; set
 * `?dry=0` on a manual invocation to actually send.
 */
export async function GET(req: Request): Promise<NextResponse> {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  }

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry') !== '0'

  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://patchbay-mcp.dev'
  // Broadcast-level unsubscribe is handled by Resend's {{RESEND_UNSUBSCRIBE_URL}}
  // placeholder; we also expose our own /api/unsubscribe for legacy leads.
  const unsubUrl = `${base}/api/unsubscribe?src=weekly-digest`
  const digest = buildWeeklyDigest(unsubUrl)

  if (!digest.dataAvailable) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'no fresh sweep data' })
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      subject: digest.subject,
      previewText: digest.previewText,
      htmlBytes: digest.html.length,
      textBytes: digest.text.length,
    })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  // Segment id for `patchbay-weekly-digest` (created via Resend MCP 2026-11-17).
  const SEGMENT_ID = '45d0c7d0-8fc3-47b0-9188-1b979dea685a'
  const FROM = process.env.RESEND_WEEKLY_FROM || 'Sarah Vogel <sarah@patchbay-mcp.dev>'
  const REPLY_TO = process.env.RESEND_WEEKLY_REPLY_TO || 'sarah@patchbay-mcp.dev'

  const resend = new Resend(apiKey)
  const broadcast = await resend.broadcasts.create({
    audienceId: SEGMENT_ID,
    from: FROM,
    replyTo: REPLY_TO,
    subject: digest.subject,
    html: digest.html,
    text: digest.text,
  } as unknown as Parameters<typeof resend.broadcasts.create>[0])
  const broadcastErr = (broadcast as unknown as { error?: { message?: string } }).error
  if (broadcastErr) {
    console.error('weekly-digest: broadcast create failed', broadcastErr)
    return NextResponse.json({ error: broadcastErr.message ?? 'broadcast create failed' }, { status: 502 })
  }
  const broadcastId = (broadcast as unknown as { data?: { id?: string } }).data?.id
  if (!broadcastId) {
    return NextResponse.json({ error: 'broadcast id missing' }, { status: 502 })
  }

  const send = await resend.broadcasts.send(broadcastId)
  const sendErr = (send as unknown as { error?: { message?: string } }).error
  if (sendErr) {
    console.error('weekly-digest: broadcast send failed', sendErr)
    return NextResponse.json({ error: sendErr.message ?? 'broadcast send failed' }, { status: 502 })
  }

  return NextResponse.json({ ok: true, broadcastId, subject: digest.subject })
}

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const TIER5_SEGMENT_ID = '5260059d-27f8-4f3c-9678-256cdb174701'
const API = 'https://api.resend.com'
const WARMING_START_DATE = process.env.WARMING_START_DATE ?? '2026-11-24'

const PLAN: Array<{ businessDay: number; quota: number; label: string }> = [
  { businessDay: 0, quota: 5,  label: 'warming-mon' },
  { businessDay: 1, quota: 10, label: 'warming-tue' },
  { businessDay: 2, quota: 20, label: 'warming-wed' },
  { businessDay: 3, quota: 35, label: 'warming-thu' },
  { businessDay: 4, quota: 50, label: 'warming-fri' },
  { businessDay: 5, quota: 65, label: 'ramp-week2-mon' },
  { businessDay: 6, quota: 80, label: 'ramp-week2-tue' },
  { businessDay: 7, quota: 95, label: 'ramp-week2-wed' },
  { businessDay: 8, quota: 100, label: 'cap-nikolaus' },
]

function isAuthorised(req: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  return req.headers.get('authorization') === `Bearer ${expected}`
}

function businessDaysSince(start: Date, today: Date): number {
  let n = 0
  const cur = new Date(start); cur.setUTCHours(0, 0, 0, 0)
  const end = new Date(today); end.setUTCHours(0, 0, 0, 0)
  while (cur < end) {
    const dow = cur.getUTCDay()
    if (dow !== 0 && dow !== 6) n++
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return n
}

function todayQuota(): { bd: number; quota: number; label: string } | null {
  const today = new Date()
  const dow = today.getUTCDay()
  if (dow === 0 || dow === 6) return null
  const start = new Date(WARMING_START_DATE + 'T00:00:00Z')
  const bd = businessDaysSince(start, today)
  if (bd < 0) return null
  const row = PLAN.find((p) => p.businessDay === bd) ?? PLAN[PLAN.length - 1]
  if (!row) return null
  return { bd, quota: row.quota, label: row.label }
}

async function resendFetch<T>(apiKey: string, path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  })
  if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${r.status}: ${await r.text().catch(() => '')}`)
  return r.json() as Promise<T>
}

interface Contact {
  id: string
  email: string
  first_name?: string
  properties?: Record<string, string | number | null>
  unsubscribed?: boolean
}

/**
 * GET /api/cron/cold-mail-warming
 * Runs Mon-Fri 09:00 UTC. Picks today's quota minus what already
 * shipped under the campaign label and sends to ready contacts in the
 * Tier-5 segment, each with its own template chosen from properties.
 * This cron route does NOT run the pre-send rescan hook — that happens
 * only in the local scripts/cold-mail-warming.ts path. The cron sends
 * the pre-rendered body fields on the Contact, so Resend's template
 * substitution stays verbatim.
 */
export async function GET(req: Request): Promise<NextResponse> {
  if (!isAuthorised(req)) return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  const apiKey = process.env.RESEND_API_KEY ?? ''
  if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY missing' }, { status: 500 })

  const today = todayQuota()
  if (!today) return NextResponse.json({ ok: true, skipped: true, reason: 'weekend or before start' })

  const contacts = await resendFetch<{ data: Contact[] }>(
    apiKey,
    `/segments/${TIER5_SEGMENT_ID}/contacts?limit=100`,
  )
  const ready = contacts.data
    .filter((c) => !c.unsubscribed)
    .filter((c) => c.properties?.ready_to_send === '1' || c.properties?.ready_to_send === 1)
    .slice(0, today.quota)

  const sent: string[] = []
  const errors: string[] = []
  for (const c of ready) {
    const subject = String(c.properties?.subject ?? '')
    const body = String(c.properties?.body ?? '')
    if (!subject || !body) {
      errors.push(`${c.email}: missing subject/body properties`)
      continue
    }
    try {
      await resendFetch(apiKey, `/emails`, {
        method: 'POST',
        body: JSON.stringify({
          from: 'Sarah Vogel <sarah@patchbay-mcp.dev>',
          to: c.email,
          reply_to: 'sarah@patchbay-mcp.dev',
          subject,
          text: body,
          tags: [{ name: 'campaign', value: today.label }],
        }),
      })
      sent.push(c.email)
    } catch (err) {
      errors.push(`${c.email}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return NextResponse.json({ ok: true, label: today.label, quota: today.quota, sent: sent.length, errors })
}

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const COLD_INBOX_ID = '6e07f842-02c9-448f-a7cd-f307b350706c'
const TIER5_SEGMENT_ID = '5260059d-27f8-4f3c-9678-256cdb174701'
const API = 'https://api.resend.com'

const UNSUB_PATTERNS = [
  /\bstop\b/i,
  /\bunsub(scribe)?\b/i,
  /\bremove\s+me\b/i,
  /\bplease\s+remove\b/i,
  /\bno\s+thanks\b/i,
  /\btake\s+me\s+off\b/i,
  /\bopt[-\s]?out\b/i,
]

function isAuthorised(req: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  return req.headers.get('authorization') === `Bearer ${expected}`
}

function senderEmail(from: string): string | null {
  const m = from.match(/<([^>]+)>/) ?? from.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+)/)
  return m?.[1] ?? null
}

async function resendFetch<T>(apiKey: string, path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  })
  if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${r.status}: ${await r.text().catch(() => '')}`)
  return r.json() as Promise<T>
}

interface Thread { id: string; from?: string; subject?: string; snippet?: string; labels?: string[] }

/**
 * GET /api/cron/cold-mail-suppression
 * Runs every hour at :15. Scans the cold-outreach-replies inbox for
 * STOP-style replies, suppresses the sender, removes from Tier-5
 * segment, labels the thread.
 */
export async function GET(req: Request): Promise<NextResponse> {
  if (!isAuthorised(req)) return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  const apiKey = process.env.RESEND_API_KEY ?? ''
  if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY missing' }, { status: 500 })

  const page = await resendFetch<{ data: Thread[] }>(
    apiKey,
    `/inboxes/${COLD_INBOX_ID}/threads?limit=100`,
  )
  const todo = page.data.filter((t) => !t.labels?.some((l) => l === 'unsubscribed' || l === 'needs-human'))

  let unsubCount = 0
  let humanCount = 0
  const errors: string[] = []

  for (const t of todo) {
    const body = `${t.subject ?? ''}\n${t.snippet ?? ''}`.slice(0, 500)
    const email = t.from ? senderEmail(t.from) : null
    const looksUnsub = UNSUB_PATTERNS.some((p) => p.test(body))

    if (looksUnsub && email) {
      try {
        await resendFetch(apiKey, `/suppressions`, {
          method: 'POST',
          body: JSON.stringify({ email, reason: 'reply contained unsubscribe signal' }),
        })
        await resendFetch(apiKey, `/segments/${TIER5_SEGMENT_ID}/contacts/${encodeURIComponent(email)}`, { method: 'DELETE' })
          .catch((e) => { if (!String(e).includes('404')) throw e })
        await resendFetch(apiKey, `/inboxes/${COLD_INBOX_ID}/threads/${t.id}/labels`, {
          method: 'POST',
          body: JSON.stringify({ labels: ['unsubscribed'] }),
        }).catch(() => { /* label may already exist */ })
        unsubCount++
      } catch (err) {
        errors.push(`${email}: ${err instanceof Error ? err.message : String(err)}`)
      }
    } else {
      await resendFetch(apiKey, `/inboxes/${COLD_INBOX_ID}/threads/${t.id}/labels`, {
        method: 'POST',
        body: JSON.stringify({ labels: ['needs-human'] }),
      }).catch(() => { /* label may already exist */ })
      humanCount++
    }
  }

  return NextResponse.json({ ok: true, scanned: todo.length, unsubCount, humanCount, errors })
}

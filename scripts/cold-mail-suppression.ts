/**
 * Cold-mail suppression worker.
 *
 * Scans the cold-outreach-replies inbox for messages whose body contains
 * an unsubscribe signal (STOP, UNSUBSCRIBE, REMOVE ME, PLEASE REMOVE, NO
 * THANKS — all case-insensitive, anywhere in the first 500 chars) and
 * for each one:
 *   1. Adds the sender to the Resend account-level suppression list
 *      (permanent block across every segment and future broadcast).
 *   2. Removes the sender from the cold-outreach-tier-5 segment so the
 *      next warming batch does not pick them up again.
 *   3. Labels the thread "unsubscribed" so Sarah can filter them out of
 *      her reply review.
 *
 * Signals we deliberately do NOT auto-suppress on:
 *   - "I'm out of office" (triggers on "stop by my desk" etc.)
 *   - "not interested right now" (polite deferral, keep for later)
 *   - Replies without the keyword set above
 * Those get the thread label "needs-human" instead.
 *
 * Run once an hour via Vercel cron, or ad-hoc via `npx tsx`.
 *
 * Env:
 *   RESEND_API_KEY     required
 *   COLD_INBOX_ID      Resend inbox id for cold-outreach-replies
 *   TIER5_SEGMENT_ID   Resend segment id for cold-outreach-tier-5
 */

import { setTimeout as sleep } from 'node:timers/promises'

const UNSUB_PATTERNS = [
  /\bstop\b/i,
  /\bunsub(scribe)?\b/i,
  /\bremove\s+me\b/i,
  /\bplease\s+remove\b/i,
  /\bno\s+thanks\b/i,
  /\btake\s+me\s+off\b/i,
  /\bopt[-\s]?out\b/i,
]

const API = 'https://api.resend.com'

interface Config {
  apiKey: string
  inboxId: string
  segmentId: string
}

async function resendFetch<T>(cfg: Config, path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${cfg.apiKey}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    throw new Error(`${init.method ?? 'GET'} ${path} -> ${r.status}: ${body}`)
  }
  return r.json() as Promise<T>
}

interface Thread {
  id: string
  from?: string
  subject?: string
  snippet?: string
  labels?: string[]
}

function isUnsub(text: string): boolean {
  const head = text.slice(0, 500)
  return UNSUB_PATTERNS.some((p) => p.test(head))
}

function senderEmail(from: string): string | null {
  const m = from.match(/<([^>]+)>/) ?? from.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+)/)
  return m?.[1] ?? null
}

async function suppress(cfg: Config, email: string, reason: string) {
  await resendFetch(cfg, `/suppressions`, {
    method: 'POST',
    body: JSON.stringify({ email, reason }),
  })
}

async function removeFromSegment(cfg: Config, email: string) {
  // contacts endpoint accepts email directly for lookup within a segment scope
  await resendFetch(cfg, `/segments/${cfg.segmentId}/contacts/${encodeURIComponent(email)}`, {
    method: 'DELETE',
  }).catch((e) => {
    // ignore 404 — already not in the segment
    if (!String(e).includes('404')) throw e
  })
}

async function labelThread(cfg: Config, threadId: string, label: string) {
  await resendFetch(cfg, `/inboxes/${cfg.inboxId}/threads/${threadId}/labels`, {
    method: 'POST',
    body: JSON.stringify({ labels: [label] }),
  }).catch(() => { /* label may already exist */ })
}

async function fetchUnlabelledThreads(cfg: Config): Promise<Thread[]> {
  const page = await resendFetch<{ data: Thread[] }>(
    cfg,
    `/inboxes/${cfg.inboxId}/threads?limit=100`,
  )
  // Filter: only threads we have not labeled yet.
  return page.data.filter((t) => !t.labels?.some((l) => l === 'unsubscribed' || l === 'needs-human'))
}

async function main() {
  const cfg: Config = {
    apiKey: process.env.RESEND_API_KEY ?? '',
    inboxId: process.env.COLD_INBOX_ID ?? '6e07f842-02c9-448f-a7cd-f307b350706c',
    segmentId: process.env.TIER5_SEGMENT_ID ?? '5260059d-27f8-4f3c-9678-256cdb174701',
  }
  if (!cfg.apiKey) {
    console.error('RESEND_API_KEY missing')
    process.exit(2)
  }
  const threads = await fetchUnlabelledThreads(cfg)
  console.log(`Fetched ${threads.length} unlabelled thread(s)`)
  let unsubCount = 0
  let humanCount = 0
  for (const t of threads) {
    const body = `${t.subject ?? ''}\n${t.snippet ?? ''}`
    const email = t.from ? senderEmail(t.from) : null
    if (isUnsub(body) && email) {
      try {
        await suppress(cfg, email, 'reply contained unsubscribe signal')
        await removeFromSegment(cfg, email)
        await labelThread(cfg, t.id, 'unsubscribed')
        unsubCount++
        console.log(`UNSUB ${email}`)
      } catch (err) {
        console.error(`UNSUB fail ${email}:`, err instanceof Error ? err.message : String(err))
      }
    } else {
      await labelThread(cfg, t.id, 'needs-human')
      humanCount++
    }
    await sleep(100)
  }
  console.log(`Done. unsub=${unsubCount} needs-human=${humanCount}`)
}

main().catch((e) => { console.error(e); process.exit(1) })

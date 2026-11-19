/**
 * Cold-mail warming scheduler.
 *
 * Ramps outbound volume over the first five weekdays of a warming week:
 *   Mon  5 mails
 *   Tue 10
 *   Wed 20
 *   Thu 35
 *   Fri 50
 * After Friday the ramp continues +15/day until it hits 100/d (Nikolaustag
 * cap). The exact plan is in PLAN[] below; edit there, not in the loop.
 *
 * On each run the script:
 *   1. Looks up today's quota in PLAN[] based on business-days-since-start.
 *   2. Counts how many mails we have already sent today from the tier-5
 *      segment in Resend (list-emails with a from-filter and 24h window).
 *   3. If sent < quota, picks up to (quota - sent) contacts from
 *      cold-outreach-tier-5 that have a "ready_to_send" property and are
 *      NOT on the suppression list.
 *   4. For each contact, assembles the broadcast from the template
 *      pilot-mails-tier5-top3.md and calls Resend's send-email endpoint.
 *
 * Content comes from Fable. This script never invents mail text; it reads
 * one of the templates and parameter-substitutes {{company}}, {{name}},
 * {{finding_snippet}}.
 *
 * Run once a day at 09:00 UTC via Vercel cron. Weekends off: the ramp
 * only counts weekdays.
 *
 * Env:
 *   RESEND_API_KEY     required
 *   TIER5_SEGMENT_ID   Resend segment id (default: cold-outreach-tier-5)
 *   WARMING_START_DATE ISO date (yyyy-mm-dd) — defaults to the next Monday
 *   DRY_RUN            if "1", prints picks but does not send
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

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

const API = 'https://api.resend.com'

function businessDaysSince(start: Date, today: Date): number {
  let n = 0
  const cur = new Date(start)
  cur.setUTCHours(0, 0, 0, 0)
  const end = new Date(today)
  end.setUTCHours(0, 0, 0, 0)
  while (cur < end) {
    const dow = cur.getUTCDay()
    if (dow !== 0 && dow !== 6) n++
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return n
}

function todayQuota(startISO: string): { bd: number; quota: number; label: string } | null {
  const today = new Date()
  // Skip weekends entirely.
  const dow = today.getUTCDay()
  if (dow === 0 || dow === 6) return null
  const start = new Date(startISO + 'T00:00:00Z')
  const bd = businessDaysSince(start, today)
  if (bd < 0) return null
  const row = PLAN.find((p) => p.businessDay === bd) ?? PLAN[PLAN.length - 1]
  if (!row) return null
  return { bd, quota: row.quota, label: row.label }
}

async function resendFetch<T>(apiKey: string, path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
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

async function fetchReadyContacts(apiKey: string, segmentId: string, limit: number): Promise<Contact[]> {
  const page = await resendFetch<{ data: Contact[] }>(
    apiKey,
    `/segments/${segmentId}/contacts?limit=100`,
  )
  return page.data
    .filter((c) => !c.unsubscribed)
    .filter((c) => c.properties?.ready_to_send === '1' || c.properties?.ready_to_send === 1)
    .slice(0, limit)
}

async function countSentToday(apiKey: string, label: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const page = await resendFetch<{ data: Array<{ tags?: Array<{ name: string; value: string }> }> }>(
    apiKey,
    `/emails?limit=100&from=${encodeURIComponent(since)}`,
  ).catch(() => ({ data: [] as Array<{ tags?: Array<{ name: string; value: string }> }> }))
  return page.data.filter((e) => e.tags?.some((t) => t.name === 'campaign' && t.value === label)).length
}

interface Template {
  subject: string
  body: string
}

function loadTemplate(name: string): Template {
  const path = join(ROOT, 'scratchpad', name)
  if (!existsSync(path)) throw new Error(`template missing: ${path}`)
  const raw = readFileSync(path, 'utf8')
  // Templates start with:
  //   Subject: ...\n
  //   \n
  //   body...
  const m = raw.match(/^Subject:\s*(.+?)\r?\n\r?\n([\s\S]+)$/)
  if (!m) throw new Error(`template ${name} is missing "Subject:" header`)
  const [, subject, body] = m
  return { subject: subject ?? '', body: body ?? '' }
}

function render(template: Template, ctx: Record<string, string>): Template {
  const sub = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => ctx[k] ?? `{{${k}}}`)
  return { subject: sub(template.subject), body: sub(template.body) }
}

async function sendOne(apiKey: string, to: string, tmpl: Template, label: string): Promise<void> {
  await resendFetch(apiKey, `/emails`, {
    method: 'POST',
    body: JSON.stringify({
      from: 'Sarah Vogel <sarah@patchbay-mcp.dev>',
      to,
      reply_to: 'sarah@patchbay-mcp.dev',
      subject: tmpl.subject,
      text: tmpl.body,
      tags: [{ name: 'campaign', value: label }],
    }),
  })
}

async function main() {
  const apiKey = process.env.RESEND_API_KEY ?? ''
  const segmentId = process.env.TIER5_SEGMENT_ID ?? '5260059d-27f8-4f3c-9678-256cdb174701'
  const startISO = process.env.WARMING_START_DATE ?? '2026-11-24' // next Monday
  const dryRun = process.env.DRY_RUN === '1'
  if (!apiKey) { console.error('RESEND_API_KEY missing'); process.exit(2) }
  const today = todayQuota(startISO)
  if (!today) { console.log('weekend or before start — no send today'); return }
  console.log(`business day ${today.bd} · quota ${today.quota} · label ${today.label}`)
  const sent = await countSentToday(apiKey, today.label)
  const remaining = Math.max(0, today.quota - sent)
  console.log(`already sent ${sent}; remaining ${remaining}`)
  if (remaining === 0) return
  const contacts = await fetchReadyContacts(apiKey, segmentId, remaining)
  console.log(`picked ${contacts.length} ready contact(s)`)
  const tmpl = loadTemplate('pilot-mails-tier5-top3.md')
  for (const c of contacts) {
    const ctx = {
      name: c.first_name ?? 'there',
      company: String(c.properties?.company ?? c.email.split('@')[1] ?? ''),
      finding_snippet: String(c.properties?.finding_snippet ?? ''),
    }
    const rendered = render(tmpl, ctx)
    if (dryRun) {
      console.log(`DRY ${c.email}\n  subj: ${rendered.subject}\n  body: ${rendered.body.slice(0, 120)}…`)
    } else {
      await sendOne(apiKey, c.email, rendered, today.label)
      console.log(`SENT ${c.email}`)
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1) })

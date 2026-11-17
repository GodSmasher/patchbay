import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Weekly MCP digest renderer.
 *
 * Reads the already-synced dashboard data from `public/dashboard/` and
 * produces the Tuesday send: subject, preview text, HTML body, plain-text
 * body. Called by /api/cron/weekly-digest once a week.
 *
 * Deliberately HTML-string-based for v1 — no React Email dep yet. The
 * markup is table-based because every real inbox client still parses
 * tables more reliably than div+CSS. Dark-mode support happens through
 * the `prefers-color-scheme` block in <style>, not inline overrides.
 */

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

interface Aggregate {
  capturedAt: string
  totalTargets: number
  reachable: number
  totals: Record<Severity, number>
  checkCounts: Record<string, number>
}

const BRAND = 'patchbay'
const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://patchbay-mcp.dev'

function readDashboard<T>(name: string): T | null {
  const abs = join(process.cwd(), 'public', 'dashboard', name)
  if (!existsSync(abs)) return null
  try { return JSON.parse(readFileSync(abs, 'utf8')) as T } catch { return null }
}

function readDashboardText(name: string): string | null {
  const abs = join(process.cwd(), 'public', 'dashboard', name)
  if (!existsSync(abs)) return null
  try { return readFileSync(abs, 'utf8') } catch { return null }
}

export interface WeeklyDigest {
  subject: string
  previewText: string
  html: string
  text: string
  dataAvailable: boolean
}

export function buildWeeklyDigest(unsubUrl: string): WeeklyDigest {
  const aggregate = readDashboard<Aggregate>('latest-aggregate.json')
  const weekly = readDashboardText('latest-weekly.md')

  if (!aggregate) {
    const subject = `${BRAND}: digest skipped — no fresh sweep data`
    const text = `We did not have a fresh daily sweep to summarise this week. Nothing to send.\n\nUnsubscribe: ${unsubUrl}\n`
    return { subject, previewText: 'No sweep data this week.', html: wrapHtml(text, unsubUrl), text, dataAvailable: false }
  }

  const date = aggregate.capturedAt.slice(0, 10)
  const total = aggregate.totals.critical + aggregate.totals.high + aggregate.totals.medium + aggregate.totals.low + aggregate.totals.info
  const reachPct = ((aggregate.reachable / aggregate.totalTargets) * 100).toFixed(1)

  const topChecks = Object.entries(aggregate.checkCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const subject = `${date}: ${aggregate.totals.critical} critical, ${aggregate.totals.high} high across ${aggregate.totalTargets} MCP servers`
  const previewText = `Reachable ${aggregate.reachable}/${aggregate.totalTargets} (${reachPct}%). Total ${total} findings. Top check: ${topChecks[0]?.[0] ?? 'none'}.`

  const weeklyExcerpt = weekly
    ? weekly.split('\n').slice(0, 24).join('\n')
    : '(no weekly rescan report yet)'

  const text = [
    `${BRAND} weekly MCP digest — ${date}`,
    '',
    `Targets scanned: ${aggregate.totalTargets}`,
    `Reachable: ${aggregate.reachable}/${aggregate.totalTargets} (${reachPct}%)`,
    `Findings: ${aggregate.totals.critical} critical · ${aggregate.totals.high} high · ${aggregate.totals.medium} medium · ${aggregate.totals.low} low · ${aggregate.totals.info} info`,
    '',
    'Top 5 checks by occurrence:',
    ...topChecks.map(([id, n]) => `  ${id}: ${n}`),
    '',
    '--- Weekly rescan excerpt ---',
    weeklyExcerpt,
    '',
    `Full dashboard: ${BASE}/dashboard`,
    `Leaderboard:   ${BASE}/leaderboard`,
    '',
    `Unsubscribe: ${unsubUrl}`,
  ].join('\n')

  const html = wrapHtml(renderBodyHtml({ aggregate, topChecks, weekly, date, reachPct }), unsubUrl)

  return { subject, previewText, html, text, dataAvailable: true }
}

function renderBodyHtml(input: {
  aggregate: Aggregate
  topChecks: Array<[string, number]>
  weekly: string | null
  date: string
  reachPct: string
}): string {
  const { aggregate, topChecks, weekly, date, reachPct } = input
  const sevRow = (['critical', 'high', 'medium', 'low', 'info'] as const)
    .map((s) => `<td style="padding:8px 12px;text-align:center;border:1px solid #e5e7eb"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">${s}</div><div style="font-size:18px;font-weight:600;color:#111827">${aggregate.totals[s]}</div></td>`)
    .join('')

  const checksRows = topChecks
    .map(([id, n]) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #f3f4f6"><a href="${BASE}/docs/${encodeURIComponent(id)}" style="color:#4338ca;text-decoration:none;font-family:ui-monospace,monospace">${id}</a></td><td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-variant-numeric:tabular-nums">${n}</td></tr>`)
    .join('')

  const weeklyBlock = weekly
    ? `<pre style="white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,monospace;font-size:12px;line-height:1.5;color:#374151;background:#f9fafb;padding:12px;border-radius:6px;border:1px solid #e5e7eb;max-height:none">${escapeHtml(weekly).slice(0, 4000)}</pre>`
    : '<p style="color:#9ca3af;font-size:13px">No weekly rescan report yet.</p>'

  return `
    <h1 style="margin:0 0 4px;font-size:22px;color:#111827">${BRAND} weekly MCP digest</h1>
    <p style="margin:0 0 20px;color:#6b7280;font-size:13px">Week of ${date} · ${aggregate.totalTargets} servers · ${aggregate.reachable} reachable (${reachPct}%)</p>

    <h2 style="font-size:14px;color:#374151;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.04em">Severity breakdown</h2>
    <table role="presentation" style="border-collapse:collapse;width:100%"><tr>${sevRow}</tr></table>

    <h2 style="font-size:14px;color:#374151;margin:24px 0 8px;text-transform:uppercase;letter-spacing:.04em">Top checks</h2>
    <table role="presentation" style="border-collapse:collapse;width:100%">${checksRows}</table>

    <h2 style="font-size:14px;color:#374151;margin:24px 0 8px;text-transform:uppercase;letter-spacing:.04em">Weekly rescan report</h2>
    ${weeklyBlock}

    <p style="margin:24px 0 8px"><a href="${BASE}/dashboard" style="color:#4338ca;font-weight:500;text-decoration:none">Open the full dashboard →</a></p>
    <p style="margin:0"><a href="${BASE}/leaderboard" style="color:#4338ca;font-weight:500;text-decoration:none">Open the leaderboard →</a></p>
  `
}

function wrapHtml(bodyOrText: string, unsubUrl: string): string {
  const body = bodyOrText.includes('<h1') ? bodyOrText : `<pre style="white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:13px">${escapeHtml(bodyOrText)}</pre>`
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${BRAND} weekly digest</title>
<style>
  body { margin:0; background:#ffffff; color:#111827; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; }
  a { color:#4338ca; }
  @media (prefers-color-scheme: dark) {
    body { background:#0b0d12 !important; color:#e5e7eb !important; }
    a { color:#a5b4fc !important; }
  }
</style>
</head>
<body>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="600" style="max-width:600px;width:100%;background:#ffffff">
<tr><td style="padding:0 8px">
${body}
<hr style="margin:32px 0 16px;border:none;border-top:1px solid #e5e7eb">
<p style="margin:0;font-size:12px;color:#6b7280">
You get this because you signed up at <a href="${BASE}" style="color:#6b7280">patchbay-mcp.dev</a>.
One click to unsubscribe: <a href="${unsubUrl}" style="color:#6b7280">${unsubUrl}</a>.
</p>
</td></tr></table>
</td></tr></table>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

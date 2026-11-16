#!/usr/bin/env tsx
/**
 * Generate weekly rescan report from daily sweep aggregates.
 *
 * Reads bench/mcp-sweep-YYYY-MM-DD-aggregate.json for the last 7 days,
 * computes deltas (findings resolved, findings opened, reachability drift,
 * per-check movement), writes bench/rescan-reports/YYYY-WW.md.
 *
 * Usage: tsx scripts/generate-weekly-rescan.ts [--weeks-back=0]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

interface Aggregate {
  capturedAt: string
  totalTargets: number
  reachable: number
  totals: Record<Severity, number>
  checkCounts: Record<string, number>
}

interface DatedAggregate extends Aggregate {
  date: string
}

const BENCH_DIR = join(process.cwd(), 'bench')
const REPORT_DIR = join(BENCH_DIR, 'rescan-reports')

function findAggregates(): DatedAggregate[] {
  const files = readdirSync(BENCH_DIR)
    .filter((f) => /^mcp-sweep-\d{4}-\d{2}-\d{2}-aggregate\.json$/.test(f))
    .sort()
  const out: DatedAggregate[] = []
  for (const f of files) {
    const date = f.slice('mcp-sweep-'.length, 'mcp-sweep-'.length + 10)
    const raw = JSON.parse(readFileSync(join(BENCH_DIR, f), 'utf8')) as Aggregate
    out.push({ ...raw, date })
  }
  return out
}

function isoWeek(d: Date): { year: number; week: number } {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNr = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNr + 3)
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  const diff = (target.getTime() - firstThursday.getTime()) / 86400000
  const week = 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
  return { year: target.getUTCFullYear(), week }
}

function pct(n: number, total: number): string {
  if (total === 0) return '0%'
  return `${((n / total) * 100).toFixed(1)}%`
}

function diff(a: number, b: number): string {
  const d = b - a
  if (d === 0) return '±0'
  return d > 0 ? `+${d}` : `${d}`
}

function diffCell(a: number, b: number): string {
  const d = b - a
  if (d === 0) return '±0'
  if (d > 0) return `▲ +${d}`
  return `▼ ${d}`
}

function generate(windowAggs: DatedAggregate[]): string {
  if (windowAggs.length === 0) throw new Error('no aggregates in window')
  const first = windowAggs[0]
  const last = windowAggs[windowAggs.length - 1]
  const { year, week } = isoWeek(new Date(last.capturedAt))
  const paddedWeek = String(week).padStart(2, '0')

  const totalDelta: Record<Severity, number> = {
    critical: last.totals.critical - first.totals.critical,
    high: last.totals.high - first.totals.high,
    medium: last.totals.medium - first.totals.medium,
    low: last.totals.low - first.totals.low,
    info: last.totals.info - first.totals.info,
  }

  const checksSeen = new Set<string>()
  for (const a of windowAggs) for (const k of Object.keys(a.checkCounts)) checksSeen.add(k)
  const perCheck: Array<{ id: string; first: number; last: number; delta: number }> = []
  for (const id of checksSeen) {
    const f = first.checkCounts[id] ?? 0
    const l = last.checkCounts[id] ?? 0
    perCheck.push({ id, first: f, last: l, delta: l - f })
  }
  perCheck.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.last - a.last)

  const lines: string[] = []
  lines.push(`# Weekly Rescan Report — ${year}-W${paddedWeek}`)
  lines.push('')
  lines.push(`**Window:** ${first.date} → ${last.date} (${windowAggs.length} daily sweeps)`)
  lines.push(`**Captured:** ${last.capturedAt}`)
  lines.push('')
  lines.push('## Executive summary')
  lines.push('')
  lines.push(`- **Targets scanned:** ${last.totalTargets} (${diff(first.totalTargets, last.totalTargets)} vs ${first.date})`)
  lines.push(`- **Reachable:** ${last.reachable}/${last.totalTargets} (${pct(last.reachable, last.totalTargets)})`)
  lines.push(`- **Findings end-of-week:** critical ${last.totals.critical}, high ${last.totals.high}, medium ${last.totals.medium}, low ${last.totals.low}, info ${last.totals.info}`)
  lines.push('')

  lines.push('## Severity drift (week-over-week)')
  lines.push('')
  lines.push('| Severity | Start of week | End of week | Delta |')
  lines.push('|---|---:|---:|---:|')
  for (const s of ['critical', 'high', 'medium', 'low', 'info'] as const) {
    lines.push(`| ${s} | ${first.totals[s]} | ${last.totals[s]} | ${diffCell(first.totals[s], last.totals[s])} |`)
  }
  lines.push('')

  lines.push('## Daily trajectory')
  lines.push('')
  lines.push('| Date | Reachable | Critical | High | Medium | Low | Info |')
  lines.push('|---|---:|---:|---:|---:|---:|---:|')
  for (const a of windowAggs) {
    lines.push(`| ${a.date} | ${a.reachable}/${a.totalTargets} | ${a.totals.critical} | ${a.totals.high} | ${a.totals.medium} | ${a.totals.low} | ${a.totals.info} |`)
  }
  lines.push('')

  lines.push('## Check movement (top 20 by |delta|)')
  lines.push('')
  lines.push('| Check | Start | End | Delta |')
  lines.push('|---|---:|---:|---:|')
  for (const row of perCheck.slice(0, 20)) {
    lines.push(`| ${row.id} | ${row.first} | ${row.last} | ${diffCell(row.first, row.last)} |`)
  }
  lines.push('')

  const resolved = perCheck.filter((r) => r.delta < 0 && r.last < r.first)
  const opened = perCheck.filter((r) => r.delta > 0 && r.last > r.first)
  lines.push('## Signals')
  lines.push('')
  if (resolved.length > 0) {
    lines.push(`- **Resolved during the week:** ${resolved.length} check types trended down (total ${resolved.reduce((n, r) => n + Math.abs(r.delta), 0)} findings).`)
  }
  if (opened.length > 0) {
    lines.push(`- **Newly opened during the week:** ${opened.length} check types trended up (total ${opened.reduce((n, r) => n + r.delta, 0)} findings).`)
  }
  const reachDrift = last.reachable - first.reachable
  if (reachDrift !== 0) {
    lines.push(`- **Reachability drift:** ${diff(first.reachable, last.reachable)} servers (${reachDrift > 0 ? 'more' : 'fewer'} reachable than at week start).`)
  }
  const totalDeltaSum = Object.values(totalDelta).reduce((n, v) => n + v, 0)
  lines.push(`- **Net findings delta:** ${diff(0, totalDeltaSum)} across all severities.`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('*Generated by [scripts/generate-weekly-rescan.ts](../../scripts/generate-weekly-rescan.ts) from daily sweep aggregates. Raw per-target data is kept as private 90-day GitHub artifacts; this report is anonymous aggregate only.*')
  lines.push('')
  return { body: lines.join('\n'), year, week: paddedWeek } as unknown as string
}

function main() {
  const aggregates = findAggregates()
  if (aggregates.length === 0) {
    console.error('No aggregate files found in bench/')
    process.exit(1)
  }
  const weeksBackArg = process.argv.find((a) => a.startsWith('--weeks-back='))
  const weeksBack = weeksBackArg ? parseInt(weeksBackArg.split('=')[1], 10) : 0

  const lastDate = new Date(aggregates[aggregates.length - 1].capturedAt)
  const cutoffEnd = new Date(lastDate.getTime() - weeksBack * 7 * 86400000)
  const cutoffStart = new Date(cutoffEnd.getTime() - 7 * 86400000)
  const windowAggs = aggregates.filter((a) => {
    const t = new Date(a.capturedAt).getTime()
    return t > cutoffStart.getTime() && t <= cutoffEnd.getTime()
  })
  if (windowAggs.length === 0) {
    console.error(`No aggregates in window ${cutoffStart.toISOString()} → ${cutoffEnd.toISOString()}`)
    process.exit(1)
  }

  const result = generate(windowAggs) as unknown as { body: string; year: number; week: string }
  if (!existsSync(REPORT_DIR)) mkdirSync(REPORT_DIR, { recursive: true })
  const outPath = join(REPORT_DIR, `${result.year}-W${result.week}.md`)
  writeFileSync(outPath, result.body, 'utf8')
  console.log(`Wrote ${outPath} (${result.body.length} bytes, ${windowAggs.length} daily sweeps)`)
}

main()

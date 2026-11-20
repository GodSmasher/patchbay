#!/usr/bin/env tsx
/**
 * Copy latest daily sweep aggregate + weekly rescan reports into
 * apps/web/public/ so the Next.js routes can read them via
 * process.cwd() + 'public/...'.
 *
 * - public/dashboard/latest-aggregate.json  — most recent daily aggregate
 * - public/dashboard/latest-weekly.md       — most recent weekly report
 *                                              (back-compat, kept for the
 *                                              /dashboard route)
 * - public/weekly/YYYY-WW.md                — ALL historical weekly reports,
 *                                              one per week, feeds
 *                                              /blog/weekly/[week]
 * - public/weekly/index.json                — ordered list of weeks with
 *                                              captured-at + brief summary,
 *                                              drives the blog index block
 * - public/dashboard/manifest.json          — sync metadata
 *
 * Run from repo root. Called by daily-sweep.yml and weekly-rescan.yml
 * right before they commit.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = process.cwd()
const BENCH_DIR = join(REPO_ROOT, 'bench')
const REPORTS_DIR = join(BENCH_DIR, 'rescan-reports')
const OUT_DIR = join(REPO_ROOT, 'apps', 'web', 'public', 'dashboard')
const WEEKLY_OUT_DIR = join(REPO_ROOT, 'apps', 'web', 'public', 'weekly')

function latestFile(dir: string, pattern: RegExp): string | null {
  if (!existsSync(dir)) return null
  const files = readdirSync(dir).filter((f) => pattern.test(f)).sort()
  return files.length > 0 ? join(dir, files[files.length - 1]) : null
}

interface WeeklyIndexEntry {
  slug: string          // "2026-W47"
  year: number
  week: number
  capturedAt: string | null  // ISO from the markdown header, if findable
  title: string         // H1 from the markdown
}

function extractCapturedAt(md: string): string | null {
  // `**Captured:** 2026-11-16T10:57:58.232Z`
  const m = /\*\*Captured:\*\*\s+(\S+)/.exec(md)
  return m?.[1] ?? null
}

function extractTitle(md: string): string {
  // First line starting with `# `
  for (const line of md.split('\n')) {
    const m = /^#\s+(.+)$/.exec(line)
    if (m) return m[1].trim()
  }
  return 'Weekly Rescan Report'
}

function syncWeeklyReports(): WeeklyIndexEntry[] {
  if (!existsSync(REPORTS_DIR)) return []
  if (!existsSync(WEEKLY_OUT_DIR)) mkdirSync(WEEKLY_OUT_DIR, { recursive: true })

  const files = readdirSync(REPORTS_DIR).filter((f) => /^\d{4}-W\d{2}\.md$/.test(f)).sort()
  const index: WeeklyIndexEntry[] = []

  for (const f of files) {
    const abs = join(REPORTS_DIR, f)
    const slug = f.replace(/\.md$/, '')           // "2026-W47"
    const [yearStr, weekStr] = slug.split('-W')
    copyFileSync(abs, join(WEEKLY_OUT_DIR, f))
    const md = readFileSync(abs, 'utf8')
    index.push({
      slug,
      year: Number(yearStr),
      week: Number(weekStr),
      capturedAt: extractCapturedAt(md),
      title: extractTitle(md),
    })
  }

  // Most-recent first
  index.sort((a, b) => (b.year - a.year) || (b.week - a.week))
  writeFileSync(join(WEEKLY_OUT_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n', 'utf8')
  console.log(`Copied ${files.length} weekly report(s) to public/weekly/, wrote index.json`)
  return index
}

function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

  const latestAgg = latestFile(BENCH_DIR, /^mcp-sweep-\d{4}-\d{2}-\d{2}-aggregate\.json$/)
  if (!latestAgg) {
    console.error('No daily sweep aggregates found in bench/')
    process.exit(1)
  }
  copyFileSync(latestAgg, join(OUT_DIR, 'latest-aggregate.json'))
  console.log(`Copied ${latestAgg} -> public/dashboard/latest-aggregate.json`)

  const latestReport = latestFile(REPORTS_DIR, /^\d{4}-W\d{2}\.md$/)
  if (latestReport) {
    copyFileSync(latestReport, join(OUT_DIR, 'latest-weekly.md'))
    console.log(`Copied ${latestReport} -> public/dashboard/latest-weekly.md`)
  } else {
    console.log('No weekly rescan report yet; skipping')
  }

  // Also populate public/weekly/ with every historical report + an index.
  // This drives the /blog/weekly/[week] route and the blog-index section.
  syncWeeklyReports()

  const manifest = {
    syncedAt: new Date().toISOString(),
    aggregate: latestAgg ? latestAgg.replace(REPO_ROOT + (process.platform === 'win32' ? '\\' : '/'), '') : null,
    weeklyReport: latestReport ? latestReport.replace(REPO_ROOT + (process.platform === 'win32' ? '\\' : '/'), '') : null,
  }
  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  console.log('Wrote manifest.json')
}

main()

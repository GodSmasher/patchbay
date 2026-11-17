#!/usr/bin/env tsx
/**
 * Copy latest daily sweep aggregate + latest weekly rescan report into
 * apps/web/public/dashboard/ so the Next.js /dashboard route can read them
 * via process.cwd() + 'public/dashboard/'.
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

function latestFile(dir: string, pattern: RegExp): string | null {
  if (!existsSync(dir)) return null
  const files = readdirSync(dir).filter((f) => pattern.test(f)).sort()
  return files.length > 0 ? join(dir, files[files.length - 1]) : null
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

  const manifest = {
    syncedAt: new Date().toISOString(),
    aggregate: latestAgg ? latestAgg.replace(REPO_ROOT + (process.platform === 'win32' ? '\\' : '/'), '') : null,
    weeklyReport: latestReport ? latestReport.replace(REPO_ROOT + (process.platform === 'win32' ? '\\' : '/'), '') : null,
  }
  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  console.log('Wrote manifest.json')
}

main()

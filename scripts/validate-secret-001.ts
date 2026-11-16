#!/usr/bin/env node
/**
 * SECRET-001 validation gate.
 *
 * Runs probeDirectory from audit-core against a positive corpus (strings
 * the scanner MUST flag) and a negative corpus (strings it MUST NOT flag,
 * including the five known false positives that caused
 * CVE-PATCHBAY-2026-0001 to be withdrawn).
 *
 * Exits non-zero on any mismatch. Wire this into CI so nobody can loosen
 * the regex back into a false-positive state without the test failing.
 *
 * Usage:
 *   npx tsx scripts/validate-secret-001.ts
 *   npx tsx scripts/validate-secret-001.ts --write-report
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { probeDirectory } from '../packages/audit-core/src/probe/directory'

interface Case {
  name: string
  file: string
  content: string
  origin?: string
  expectPattern?: string
}

interface Corpus {
  checkId: string
  kind: 'positive' | 'negative'
  cases: Case[]
}

interface CaseResult {
  name: string
  kind: 'positive' | 'negative'
  ok: boolean
  reason?: string
  matchedPatterns?: string[]
}

function loadCorpus(path: string): Corpus {
  return JSON.parse(readFileSync(path, 'utf8')) as Corpus
}

function runCase(c: Case, kind: 'positive' | 'negative'): CaseResult {
  const root = mkdtempSync(join(tmpdir(), 'patchbay-secret-001-'))
  try {
    const dest = join(root, c.file)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, c.content, 'utf8')
    const snap = probeDirectory(root)
    const hits = snap.directory?.secretHits ?? []
    const patterns = hits.map((h) => h.pattern)
    if (kind === 'positive') {
      if (!c.expectPattern) return { name: c.name, kind, ok: false, reason: 'positive case missing expectPattern', matchedPatterns: patterns }
      const ok = patterns.includes(c.expectPattern)
      return { name: c.name, kind, ok, reason: ok ? undefined : `expected pattern "${c.expectPattern}" not fired (got: ${patterns.join(', ') || 'nothing'})`, matchedPatterns: patterns }
    } else {
      const ok = hits.length === 0
      return { name: c.name, kind, ok, reason: ok ? undefined : `expected NO hit, got patterns: ${patterns.join(', ')}`, matchedPatterns: patterns }
    }
  } finally {
    try { rmSync(root, { recursive: true, force: true }) } catch { /* temp cleanup is best-effort */ }
  }
}

function main(): void {
  const writeReport = process.argv.includes('--write-report')
  const base = join(process.cwd(), 'bench', 'validation', 'SECRET-001')
  const pos = loadCorpus(join(base, 'positive-corpus.json'))
  const neg = loadCorpus(join(base, 'negative-corpus.json'))

  const results: CaseResult[] = []
  for (const c of pos.cases) results.push(runCase(c, 'positive'))
  for (const c of neg.cases) results.push(runCase(c, 'negative'))

  const posTotal = pos.cases.length, posPass = results.filter((r) => r.kind === 'positive' && r.ok).length
  const negTotal = neg.cases.length, negPass = results.filter((r) => r.kind === 'negative' && r.ok).length

  process.stdout.write('\n=== SECRET-001 VALIDATION ===\n')
  process.stdout.write(`positive  ${posPass}/${posTotal}\n`)
  process.stdout.write(`negative  ${negPass}/${negTotal}\n`)

  const failures = results.filter((r) => !r.ok)
  if (failures.length) {
    process.stdout.write('\n--- FAILURES ---\n')
    for (const f of failures) {
      process.stdout.write(`  [${f.kind}] ${f.name}: ${f.reason}\n`)
    }
  }

  if (writeReport) {
    const outPath = join(base, `results-${new Date().toISOString().slice(0, 10)}.json`)
    const report = {
      generatedAt: new Date().toISOString(),
      checkId: 'SECRET-001',
      summary: { positive: { pass: posPass, total: posTotal }, negative: { pass: negPass, total: negTotal }, failures: failures.length },
      results,
    }
    writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')
    process.stdout.write(`\nwrote ${outPath}\n`)
  }

  if (failures.length) process.exit(1)
  process.stdout.write('\nALL PASS\n')
}

main()

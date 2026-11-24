#!/usr/bin/env node
/**
 * validate-golden-corpus.ts — Phase C validation harness.
 *
 * For each case in bench/validation/golden-corpus.json:
 *   1. Deserialize the TargetSnapshot
 *   2. Run ALL_CHECKS from audit-core
 *   3. Compare actual finding IDs vs expected finding IDs
 *   4. Report per-case pass/fail + per-check FP / FN totals
 *
 * Writes bench/validation/validation-matrix.md with the full matrix.
 * Exit code 0 if every case produces exactly the expected set, 1 otherwise.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TargetSnapshot } from '../packages/audit-core/src/types'
import { ALL_CHECKS } from '../packages/audit-core/src/checks'

interface Case {
  name: string
  description: string
  snapshot: TargetSnapshot
  expectedFindings: string[]
}

interface Corpus {
  description: string
  cases: Case[]
}

interface CaseResult {
  name: string
  description: string
  expected: string[]
  actual: string[]
  falsePositives: string[]
  falseNegatives: string[]
  pass: boolean
}

function diff(expected: string[], actual: string[]): { fp: string[]; fn: string[] } {
  const exp = new Set(expected)
  const act = new Set(actual)
  const fp: string[] = []
  const fn: string[] = []
  for (const id of act) if (!exp.has(id)) fp.push(id)
  for (const id of exp) if (!act.has(id)) fn.push(id)
  return { fp, fn }
}

function runCorpus(corpus: Corpus): CaseResult[] {
  const results: CaseResult[] = []
  for (const c of corpus.cases) {
    const findings: string[] = []
    for (const check of ALL_CHECKS) {
      try {
        const outs = check.run(c.snapshot)
        for (const f of outs) findings.push(f.id)
      } catch (e) {
        findings.push(`${check.id}:threw:${(e as Error).message}`)
      }
    }
    const actual = [...new Set(findings)].sort()
    const expected = [...c.expectedFindings].sort()
    const { fp, fn } = diff(expected, actual)
    results.push({
      name: c.name,
      description: c.description,
      expected, actual,
      falsePositives: fp,
      falseNegatives: fn,
      pass: fp.length === 0 && fn.length === 0,
    })
  }
  return results
}

function renderMatrix(results: CaseResult[]): string {
  const lines: string[] = []
  lines.push('# patchbay audit-core golden-corpus validation matrix')
  lines.push('')
  lines.push(`Run: ${new Date().toISOString()}`)
  lines.push(`Cases: ${results.length}`)
  const passed = results.filter((r) => r.pass).length
  lines.push(`Pass: ${passed} / ${results.length}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push('| Case | Expected | Actual | FP | FN | Pass |')
  lines.push('|---|---|---|---|---|---|')
  for (const r of results) {
    lines.push(
      `| \`${r.name}\` | ${r.expected.join(', ') || '—'} | ${r.actual.join(', ') || '—'} | ${r.falsePositives.join(', ') || '—'} | ${r.falseNegatives.join(', ') || '—'} | ${r.pass ? '✅' : '❌'} |`,
    )
  }
  lines.push('')
  lines.push('## Per-check tallies')
  lines.push('')
  const checkStats: Record<string, { fp: number; fn: number; expected: number; actual: number }> = {}
  for (const r of results) {
    for (const id of r.expected) {
      checkStats[id] ??= { fp: 0, fn: 0, expected: 0, actual: 0 }
      checkStats[id].expected++
    }
    for (const id of r.actual) {
      checkStats[id] ??= { fp: 0, fn: 0, expected: 0, actual: 0 }
      checkStats[id].actual++
    }
    for (const id of r.falsePositives) checkStats[id].fp++
    for (const id of r.falseNegatives) checkStats[id].fn++
  }
  lines.push('| Check | Expected hits | Actual hits | FP | FN |')
  lines.push('|---|---:|---:|---:|---:|')
  for (const id of Object.keys(checkStats).sort()) {
    const s = checkStats[id]
    lines.push(`| \`${id}\` | ${s.expected} | ${s.actual} | ${s.fp} | ${s.fn} |`)
  }
  lines.push('')
  lines.push('## Failing cases')
  lines.push('')
  const failing = results.filter((r) => !r.pass)
  if (failing.length === 0) {
    lines.push('None. Every case produces the expected finding set exactly.')
  } else {
    for (const r of failing) {
      lines.push(`### \`${r.name}\``)
      lines.push('')
      lines.push(r.description)
      lines.push('')
      if (r.falsePositives.length > 0) {
        lines.push(`**False positives (actual but not expected):** ${r.falsePositives.map((x) => '`' + x + '`').join(', ')}`)
        lines.push('')
      }
      if (r.falseNegatives.length > 0) {
        lines.push(`**False negatives (expected but not fired):** ${r.falseNegatives.map((x) => '`' + x + '`').join(', ')}`)
        lines.push('')
      }
    }
  }
  return lines.join('\n') + '\n'
}

function main() {
  const corpusPath = join('bench', 'validation', 'golden-corpus.json')
  const outPath = join('bench', 'validation', 'validation-matrix.md')
  const corpus: Corpus = JSON.parse(readFileSync(corpusPath, 'utf8'))
  console.log(`[validate] loaded ${corpus.cases.length} cases from ${corpusPath}`)

  const results = runCorpus(corpus)
  const passed = results.filter((r) => r.pass).length
  console.log(`[validate] ${passed} / ${results.length} cases passed`)

  const md = renderMatrix(results)
  writeFileSync(outPath, md)
  console.log(`[validate] wrote ${outPath}`)

  if (passed !== results.length) {
    console.error('[validate] FAIL — see validation-matrix.md')
    process.exit(1)
  }
  console.log('[validate] PASS')
}

main()

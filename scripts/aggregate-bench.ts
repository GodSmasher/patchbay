// Aggregates existing bench/runs/pass-N/*.json into a variance report.
// Use when the benchmark run was interrupted and never wrote variance.json.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RunEvent, TestReport } from '../packages/agent/src/types'

interface Row {
  prompt: string
  ok: boolean
  firstTryGreen: boolean
  attempts: number
  costUsd: number
  seconds: number
}

const runsRoot = join(process.cwd(), 'bench', 'runs')
const passes = readdirSync(runsRoot)
  .filter((n) => n.startsWith('pass-'))
  .sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)))

const perPrompt = new Map<number, Row[]>()
let promptLabels = new Map<number, string>()

for (const pass of passes) {
  const dir = join(runsRoot, pass)
  for (const file of readdirSync(dir)) {
    const idx = Number(file.replace('.json', ''))
    if (!Number.isFinite(idx)) continue
    const data = JSON.parse(readFileSync(join(dir, file), 'utf8')) as { prompt: string; events: RunEvent[] }
    const events = data.events
    const reports = events.flatMap((e) => (e.type === 'tests' ? [e.report as TestReport] : []))
    const result = events.find((e) => e.type === 'result')
    const usage = events.find((e) => e.type === 'usage')
    const first = reports[0]
    const row: Row = {
      prompt: data.prompt,
      ok: result?.type === 'result' && result.ok,
      firstTryGreen: !!first && first.failed === 0 && first.typecheckOk && first.contract === 'passed',
      attempts: result?.type === 'result' ? result.attempts : reports.length,
      costUsd: usage?.type === 'usage' ? usage.usage.reduce((s, u) => s + u.costUsd, 0) : 0,
      seconds: 0,
    }
    promptLabels.set(idx, data.prompt)
    ;(perPrompt.get(idx) ?? perPrompt.set(idx, []).get(idx)!).push(row)
  }
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length)
const std = (xs: number[]) => {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1))
}

const indices = Array.from(perPrompt.keys()).sort((a, b) => a - b)
let totalRuns = 0
let totalGreen = 0
let totalFirstTry = 0
const perPromptRates: number[] = []
const varianceRows: Array<{ index: number; prompt: string; passes: number; greenRuns: number; firstTryRuns: number; costMean: number; costStd: number; attemptsMean: number }> = []
for (const idx of indices) {
  const runs = perPrompt.get(idx)!
  totalRuns += runs.length
  const g = runs.filter((r) => r.ok).length
  const ft = runs.filter((r) => r.firstTryGreen).length
  totalGreen += g
  totalFirstTry += ft
  perPromptRates.push(g / runs.length)
  const costs = runs.map((r) => r.costUsd)
  const attempts = runs.map((r) => r.attempts)
  varianceRows.push({
    index: idx,
    prompt: runs[0]!.prompt,
    passes: runs.length,
    greenRuns: g,
    firstTryRuns: ft,
    costMean: mean(costs),
    costStd: std(costs),
    attemptsMean: mean(attempts),
  })
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const totalCostMean = varianceRows.reduce((s, r) => s + r.costMean, 0)
const totalCostStd = Math.sqrt(varianceRows.reduce((s, r) => s + r.costStd ** 2, 0))

const lines = [
  '# patchbay benchmark — variance report',
  '',
  `2026-10-05/06 · runner: nebius · up to ${passes.length} passes per prompt (total ${totalRuns} runs)`,
  '',
  `Overall: **${pct(totalGreen / totalRuns)} green** (${totalGreen}/${totalRuns}) · **${pct(totalFirstTry / totalRuns)} first-try green** (${totalFirstTry}/${totalRuns}) · **$${totalCostMean.toFixed(4)} per full 20-prompt pass** ± $${totalCostStd.toFixed(4)}`,
  '',
  'Configuration for this pass: `PATCHBAY_PARALLEL_REPAIRS=2`, `PATCHBAY_MAX_ATTEMPTS=4`, pre-sandbox esbuild parse check enabled.',
  '',
  '| # | Integration | Green | First-try | Cost (mean ± σ) | Avg attempts |',
  '| --- | --- | --- | --- | --- | --- |',
  ...varianceRows.map(
    (r) => `| ${r.index} | ${r.prompt.slice(0, 90)}${r.prompt.length > 90 ? '…' : ''} | ${r.greenRuns}/${r.passes} | ${r.firstTryRuns}/${r.passes} | $${r.costMean.toFixed(4)} ± $${r.costStd.toFixed(4)} | ${r.attemptsMean.toFixed(1)} |`,
  ),
  '',
  'Green = full run finished with typecheck ok, 0 test failures, and the documentation-contract test passing. First-try = that was already true in attempt 1 (no repair needed).',
  '',
]
writeFileSync(join(process.cwd(), 'bench', 'RESULTS-variance.md'), lines.join('\n'))
writeFileSync(join(process.cwd(), 'bench', 'variance.json'), JSON.stringify({ totalRuns, totalGreen, totalFirstTry, totalCostMean, totalCostStd, prompts: varianceRows }, null, 2))
console.log(`${totalGreen}/${totalRuns} green (${pct(totalGreen / totalRuns)}), ${totalFirstTry}/${totalRuns} first-try (${pct(totalFirstTry / totalRuns)}), $${totalCostMean.toFixed(4)} per pass ± $${totalCostStd.toFixed(4)}`)

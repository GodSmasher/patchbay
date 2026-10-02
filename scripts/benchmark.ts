/**
 * npm run bench                       runs every prompt once, writes bench/results.json + bench/RESULTS.md
 * npm run bench -- 2 4 10             only these prompts (1-based); full event logs go to bench/runs/
 * npm run bench -- --passes=3         repeats every prompt N times, writes a variance report to
 *                                     bench/RESULTS-variance.md and bench/variance.json. Pass logs
 *                                     land in bench/runs/pass-K/N.json.
 *
 * Needs live keys in .env.local. Uses PATCHBAY_RUNNER from the environment (local or nebius).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadConfig, missingLiveKeys } from '../packages/agent/src/config'
import { startRun } from '../packages/agent/src/index'
import type { RunEvent, TestReport } from '../packages/agent/src/types'

const PROMPTS = [
  // Core 10 — single-call target, straightforward field mapping.
  'When someone submits our Typeform contact form, create the lead in Pipedrive as organization, person and deal.',
  'When a Stripe payment succeeds, add the customer to a Mailchimp audience with the plan as a tag.',
  'When a Calendly meeting is booked, post the invitee name, email and their answers to a Slack channel.',
  'When a GitHub issue gets the label "bug", create an issue in Linear in the Triage team.',
  'When a HubSpot contact becomes a customer, create a customer in Stripe with the same email and name.',
  'When a Shopify order is paid, append the order number, customer email and total to an Airtable table.',
  'When a new row is added to an Airtable base, send the row as a message to a Discord channel via webhook.',
  'When a Jotform submission arrives, create a task in Asana with the answers in the description.',
  'When an Intercom conversation is tagged "refund", create a ticket in Zendesk with the conversation link.',
  'When a Typeform response comes in, add the respondent as a contact in Brevo and subscribe them to a list.',
  // Hard 10 — signature verification, retries, chained calls, pagination, branching.
  'When a Pipedrive deal is moved to the Won stage, create a Notion page in the "Signed" database with the deal title, value, owner and close date.',
  'When a Shopify order webhook arrives, verify the HMAC-SHA256 signature from the X-Shopify-Hmac-Sha256 header against the shared secret, then forward the order summary to a Slack channel.',
  'When a Google Calendar event is created, add the first attendee as a checklist item on a Trello card in a configured list.',
  'When a Mailchimp API call returns HTTP 429, retry up to three times with exponential backoff and respect the Retry-After header, then log the final outcome to a Datadog event.',
  'When a Stripe checkout.session.completed webhook arrives, create or update a HubSpot contact with the customer email, using the Stripe session id as an Idempotency-Key.',
  'When a Jotform submission arrives, update an Airtable record by looking it up with filterByFormula on the email field and PATCHing only the empty fields.',
  'When a HubSpot deal is updated, search Salesforce for an Account by website domain; update it when a match is found, otherwise create a new Account.',
  'When a Linear issue is closed, fetch all its comments using cursor pagination and post a single digest message to a Discord channel.',
  'When a Zendesk ticket is created, open a matching GitHub issue in the configured repo and then post the GitHub issue URL back as a Zendesk ticket comment.',
  'When a Twilio incoming SMS webhook arrives, route it to Slack #sales when the body matches /pricing|quote|demo/i, otherwise to Slack #support.',
]

interface Row {
  prompt: string
  ok: boolean
  firstTryGreen: boolean
  attempts: number
  tests: string
  contract: TestReport['contract'] | 'n/a'
  officialSources: string
  costUsd: number
  seconds: number
  error?: string
}

async function main() {
  const config = loadConfig({ ...process.env, PATCHBAY_MOCK: 'false' })
  const missing = missingLiveKeys(config)
  if (missing.length) throw new Error(`Missing ${missing.join(', ')} in .env.local`)
  const argv = process.argv.slice(2)
  const passesArg = argv.find((a) => a.startsWith('--passes='))
  const passes = Math.max(1, Math.min(10, Number(passesArg?.split('=')[1] ?? 1)))
  const only = argv.filter((a) => !a.startsWith('--')).map(Number).filter((n) => n > 0)
  const selected = only.length ? only : PROMPTS.map((_, i) => i + 1)
  const benchDir = join(process.cwd(), 'bench')
  const runsDir = join(benchDir, 'runs')
  mkdirSync(runsDir, { recursive: true })

  // index-of-prompt -> array of per-pass rows
  const perPrompt = new Map<number, Row[]>()

  for (let pass = 1; pass <= passes; pass++) {
    if (passes > 1) process.stdout.write(`\n=== Pass ${pass}/${passes} ===\n`)
    for (const idx of selected) {
      const prompt = PROMPTS[idx - 1]!
      const started = Date.now()
      const events: RunEvent[] = []
      process.stdout.write(`\n▶ [#${idx}${passes > 1 ? `·p${pass}` : ''}] ${prompt.slice(0, 90)}${prompt.length > 90 ? '…' : ''}\n`)
      for await (const event of startRun(prompt, config)) {
        events.push(event)
        if (event.type === 'tests') process.stdout.write(`   attempt ${event.attempt}: ${event.report.passed}/${event.report.total}, typecheck ${event.report.typecheckOk ? 'ok' : 'failed'}, contract ${event.report.contract}\n`)
      }
      const row = toRow(prompt, events, started)
      const subdir = passes > 1 ? join(runsDir, `pass-${pass}`) : runsDir
      mkdirSync(subdir, { recursive: true })
      writeFileSync(join(subdir, `${idx}.json`), `${JSON.stringify({ prompt, events }, null, 2)}\n`)
      ;(perPrompt.get(idx) ?? perPrompt.set(idx, []).get(idx)!).push(row)
      process.stdout.write(`   → ${row.ok ? 'green' : 'not green'} after ${row.attempts} attempt(s), $${row.costUsd.toFixed(4)}\n`)
    }
  }

  const summaryBase = {
    runner: config.runner,
    models: Object.fromEntries(Object.entries(config.models).map(([tier, m]) => [tier, m.id])),
    date: new Date().toISOString().slice(0, 10),
    passes,
  }

  if (passes === 1) {
    const rows = Array.from(perPrompt.values()).flat()
    const summary = {
      ...summaryBase,
      runs: rows.length,
      green: rows.filter((r) => r.ok).length,
      firstTryGreen: rows.filter((r) => r.firstTryGreen).length,
      totalCostUsd: Number(rows.reduce((s, r) => s + r.costUsd, 0).toFixed(4)),
    }
    writeFileSync(join(benchDir, 'results.json'), `${JSON.stringify({ summary, rows }, null, 2)}\n`)
    writeFileSync(join(benchDir, 'RESULTS.md'), renderMarkdown(summary, rows))
    console.log(`\n${summary.green}/${summary.runs} green, ${summary.firstTryGreen} on the first try, $${summary.totalCostUsd} total. Written to bench/.`)
    return
  }

  // Variance report: one aggregated row per prompt, N raw rows per prompt in the JSON.
  const varianceRows: VarianceRow[] = []
  for (const idx of selected) {
    const runs = perPrompt.get(idx) ?? []
    if (!runs.length) continue
    const greenRuns = runs.filter((r) => r.ok).length
    const firstTryRuns = runs.filter((r) => r.firstTryGreen).length
    const costs = runs.map((r) => r.costUsd)
    const times = runs.map((r) => r.seconds)
    const attempts = runs.map((r) => r.attempts)
    varianceRows.push({
      index: idx,
      prompt: runs[0]!.prompt,
      passes: runs.length,
      greenRate: greenRuns / runs.length,
      firstTryRate: firstTryRuns / runs.length,
      greenRuns,
      firstTryRuns,
      costMean: mean(costs),
      costStd: std(costs),
      timeMean: mean(times),
      timeStd: std(times),
      attemptsMean: mean(attempts),
      runs,
    })
  }
  const totalGreenRate = varianceRows.length ? mean(varianceRows.map((r) => r.greenRate)) : 0
  const totalFirstTryRate = varianceRows.length ? mean(varianceRows.map((r) => r.firstTryRate)) : 0
  const totalCost = varianceRows.reduce((s, r) => s + r.costMean, 0)
  const totalCostStd = Math.sqrt(varianceRows.reduce((s, r) => s + r.costStd ** 2, 0))
  const summary = {
    ...summaryBase,
    prompts: varianceRows.length,
    greenRate: round(totalGreenRate, 3),
    firstTryRate: round(totalFirstTryRate, 3),
    costPerPassUsd: round(totalCost, 4),
    costPerPassStdUsd: round(totalCostStd, 4),
  }
  writeFileSync(join(benchDir, 'variance.json'), `${JSON.stringify({ summary, prompts: varianceRows }, null, 2)}\n`)
  writeFileSync(join(benchDir, 'RESULTS-variance.md'), renderVariance(summary, varianceRows))
  console.log(
    `\n${passes}-pass variance: ${(summary.greenRate * 100).toFixed(1)}% green · ${(summary.firstTryRate * 100).toFixed(1)}% first-try · $${summary.costPerPassUsd} per pass ± $${summary.costPerPassStdUsd}. Written to bench/RESULTS-variance.md.`,
  )
}

function toRow(prompt: string, events: RunEvent[], started: number): Row {
  const reports = events.flatMap((e) => (e.type === 'tests' ? [e.report] : []))
  const result = events.find((e) => e.type === 'result')
  const error = events.find((e) => e.type === 'error')
  const sources = events.find((e) => e.type === 'sources')
  const usage = events.find((e) => e.type === 'usage')
  const last = reports.at(-1)
  const first = reports[0]
  return {
    prompt,
    ok: result?.type === 'result' && result.ok,
    firstTryGreen: !!first && first.failed === 0 && first.typecheckOk && first.contract === 'passed',
    attempts: result?.type === 'result' ? result.attempts : reports.length,
    tests: last ? `${last.passed}/${last.total}` : '-',
    contract: last?.contract ?? 'n/a',
    officialSources: sources?.type === 'sources' ? `${sources.sources.filter((s) => s.official).length}/${sources.sources.length}` : '-',
    costUsd: usage?.type === 'usage' ? usage.usage.reduce((sum, u) => sum + u.costUsd, 0) : 0,
    seconds: Math.round((Date.now() - started) / 1000),
    ...(error?.type === 'error' ? { error: error.message.slice(0, 200) } : {}),
  }
}

interface VarianceRow {
  index: number
  prompt: string
  passes: number
  greenRate: number
  firstTryRate: number
  greenRuns: number
  firstTryRuns: number
  costMean: number
  costStd: number
  timeMean: number
  timeStd: number
  attemptsMean: number
  runs: Row[]
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length)
const std = (xs: number[]) => {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1))
}
const round = (n: number, d: number) => Number(n.toFixed(d))
const pct = (x: number) => `${(x * 100).toFixed(0)}%`

function renderVariance(summary: Record<string, unknown>, rows: VarianceRow[]): string {
  const lines = [
    '# patchbay benchmark — variance report',
    '',
    `${summary.date} · runner: ${summary.runner} · ${summary.passes} passes per prompt`,
    '',
    `Overall: **${pct(summary.greenRate as number)} green** · **${pct(summary.firstTryRate as number)} first-try green** · **$${summary.costPerPassUsd} per full pass** ± $${summary.costPerPassStdUsd}`,
    '',
    '| # | Integration | Green | First-try | Cost (mean ± σ) | Time (mean ± σ) | Avg attempts |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map(
      (r) => `| ${r.index} | ${r.prompt.slice(0, 90)}${r.prompt.length > 90 ? '…' : ''} | ${r.greenRuns}/${r.passes} | ${r.firstTryRuns}/${r.passes} | $${r.costMean.toFixed(4)} ± $${r.costStd.toFixed(4)} | ${r.timeMean.toFixed(0)}s ± ${r.timeStd.toFixed(0)}s | ${r.attemptsMean.toFixed(1)} |`,
    ),
    '',
    'Green = full run finished with typecheck ok, 0 test failures, and the documentation-contract test passing. First-try = that was already true in attempt 1 (no repair needed).',
    '',
  ]
  return lines.join('\n')
}

function renderMarkdown(summary: Record<string, unknown>, rows: Row[]): string {
  const lines = [
    '# patchbay benchmark',
    '',
    `${summary.date} · runner: ${summary.runner} · ${summary.green}/${summary.runs} green · ${summary.firstTryGreen}/${summary.runs} green on the first draft · $${summary.totalCostUsd} total`,
    '',
    '| Integration | Result | Attempts | Tests | Docs contract | Official sources | Cost | Time |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((r) => `| ${r.prompt} | ${r.ok ? '✅' : `❌${r.error ? ` ${r.error}` : ''}`} | ${r.attempts} | ${r.tests} | ${r.contract} | ${r.officialSources} | $${r.costUsd.toFixed(4)} | ${r.seconds}s |`),
    '',
  ]
  return lines.join('\n')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

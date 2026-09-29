/**
 * npm run bench              runs every prompt below live and writes bench/results.json + bench/RESULTS.md
 * npm run bench -- 3         only the first three
 *
 * Needs live keys in .env.local. Uses PATCHBAY_RUNNER from the environment (local or nebius).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadConfig, missingLiveKeys } from '../packages/agent/src/config'
import { startRun } from '../packages/agent/src/index'
import type { RunEvent, TestReport } from '../packages/agent/src/types'

const PROMPTS = [
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
  const limit = Number(process.argv[2]) || PROMPTS.length
  const rows: Row[] = []

  for (const prompt of PROMPTS.slice(0, limit)) {
    const started = Date.now()
    const events: RunEvent[] = []
    process.stdout.write(`\n▶ ${prompt}\n`)
    for await (const event of startRun(prompt, config)) {
      events.push(event)
      if (event.type === 'tests') process.stdout.write(`   attempt ${event.attempt}: ${event.report.passed}/${event.report.total}, typecheck ${event.report.typecheckOk ? 'ok' : 'failed'}, contract ${event.report.contract}\n`)
    }
    const reports = events.flatMap((e) => (e.type === 'tests' ? [e.report] : []))
    const result = events.find((e) => e.type === 'result')
    const error = events.find((e) => e.type === 'error')
    const sources = events.find((e) => e.type === 'sources')
    const usage = events.find((e) => e.type === 'usage')
    const last = reports.at(-1)
    const first = reports[0]
    rows.push({
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
    })
    process.stdout.write(`   → ${rows.at(-1)!.ok ? 'green' : 'not green'} after ${rows.at(-1)!.attempts} attempt(s), $${rows.at(-1)!.costUsd.toFixed(4)}\n`)
  }

  const dir = join(process.cwd(), 'bench')
  mkdirSync(dir, { recursive: true })
  const summary = {
    runner: config.runner,
    models: Object.fromEntries(Object.entries(config.models).map(([tier, m]) => [tier, m.id])),
    date: new Date().toISOString().slice(0, 10),
    runs: rows.length,
    green: rows.filter((r) => r.ok).length,
    firstTryGreen: rows.filter((r) => r.firstTryGreen).length,
    totalCostUsd: Number(rows.reduce((s, r) => s + r.costUsd, 0).toFixed(4)),
  }
  writeFileSync(join(dir, 'results.json'), `${JSON.stringify({ summary, rows }, null, 2)}\n`)
  writeFileSync(join(dir, 'RESULTS.md'), renderMarkdown(summary, rows))
  console.log(`\n${summary.green}/${summary.runs} green, ${summary.firstTryGreen} on the first try, $${summary.totalCostUsd} total. Written to bench/.`)
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

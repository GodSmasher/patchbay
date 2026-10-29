#!/usr/bin/env tsx
/**
 * Side-by-side ablation: 20 TS Core prompts, one pass against the fine-tuned
 * Qwen3-30B on your AI Cloud GPU endpoint vs one pass against the baseline
 * (whatever PATCHBAY_MODEL_STRONG points at by default — Nemotron Ultra on
 * Token Factory).
 *
 * How it decides which pass is which:
 *   - The fine-tune pass reads PATCHBAY_MODEL_STRONG / PATCHBAY_LLM_BASE_URL /
 *     PATCHBAY_LLM_PROVIDER / PATCHBAY_LLM_API_KEY from your .env.local as-is.
 *   - The baseline pass UNSETS those four so the agent falls back to its built-in
 *     Nemotron 3 Ultra 550B default on Token Factory.
 *
 * Writes a per-pass summary.json + a human-readable comparison.md to
 * scratchpad/variance_finetuned_ablation_out/.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const PROMPTS: readonly string[] = [
  'When someone submits our Typeform contact form, create the lead in Pipedrive as organization, person and deal.',
  'When a Stripe payment succeeds, add the customer to a Mailchimp audience with the plan as a tag.',
  'When a Calendly meeting is booked, post the invitee name, email and their answers to a Slack channel.',
  'When a GitHub issue gets the label "bug", create an issue in Linear in the Triage team.',
  'When a HubSpot contact becomes a customer, create a customer in Stripe with the same email and name.',
  'When a Shopify order is paid, append the order number, customer email and total to an Airtable table.',
  'When a new row is added to an Airtable base, send the row as a message to a Discord channel.',
  'When a Jotform submission arrives, create a task in Asana with the answers in the description.',
  'When an Intercom conversation is tagged "refund", create a ticket in Zendesk with the conversation summary.',
  'When a Typeform response comes in, add the respondent as a contact in Brevo and subscribe them to a list.',
  'When a Pipedrive deal is moved to the Won stage, create a Notion page in the "Signed" database with the deal title.',
  'When a Shopify order webhook arrives, verify the HMAC-SHA256 signature from the X-Shopify-Hmac-Sha256 header against the shared secret, then forward the order summary to a Slack channel.',
  'When a Google Calendar event is created, add the first attendee as a checklist item on a Trello card in the chosen list.',
  'When a Mailchimp API call returns HTTP 429, retry up to three times with exponential backoff that respects Retry-After.',
  'When a Stripe checkout.session.completed webhook arrives, create or update a HubSpot contact with the email and the plan name.',
  'When a Jotform submission arrives, update an Airtable record by looking it up with filterByFormula on the email field and PATCHing only the empty fields.',
  'When a HubSpot deal is updated, search Salesforce for an Account by website domain; update the matching Account record if found, otherwise insert a new one.',
  'When a Linear issue is closed, fetch all its comments using cursor pagination and post a summary to a Slack channel.',
  'When a Zendesk ticket is created, open a matching GitHub issue in the configured repo and post the issue URL back as a Zendesk ticket comment.',
  'When a Twilio incoming SMS webhook arrives, route it to Slack #sales when the body matches a product keyword, otherwise acknowledge quietly.',
]

const BATCH = 4
const BATCH_GAP_MS = 2000
const ROOT = process.cwd()
const OUT_DIR = join(ROOT, 'scratchpad', 'variance_finetuned_ablation_out')
mkdirSync(OUT_DIR, { recursive: true })

interface BuildResult {
  variant: 'finetuned' | 'baseline'
  promptIdx: number
  prompt: string
  green: boolean
  greenFirstTry: boolean
  passed: number
  total: number
  attempts: number
  cost: number
  seconds: number
}

function runOne(variant: 'finetuned' | 'baseline', prompt: string, promptIdx: number): Promise<BuildResult> {
  const start = Date.now()
  return new Promise((resolve) => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PATCHBAY_LANG: 'ts',
      PATCHBAY_MAX_ATTEMPTS: '4',
      PATCHBAY_PARALLEL_REPAIRS: '2',
      // Our Qwen3-30B fine-tune was trained on red→green repair pairs
      // (connector + test only, no README). Make README optional so the bench
      // measures what the model actually learned — functional connector + tests.
      PATCHBAY_OPTIONAL_README: '1',
    }
    if (variant === 'baseline') {
      // "baseline" = Nemotron Ultra for BOTH generate and repair.
      // Strip the repair-tier override so the repair step falls back to the strong model (Ultra).
      delete env.PATCHBAY_MODEL_REPAIR
      delete env.PATCHBAY_REPAIR_LLM_BASE_URL
      delete env.PATCHBAY_REPAIR_LLM_API_KEY
      delete env.PATCHBAY_REPAIR_LLM_PROVIDER
    }
    // "finetuned" variant keeps PATCHBAY_MODEL_REPAIR=patchbay-repair + REPAIR_LLM_* from .env.local
    // which routes only the repair step to the fine-tuned Qwen3-30B — Ultra still handles the
    // fresh-generation step (what Ultra is good at), fine-tune handles the red→green fixes
    // (what it was actually trained on).
    // Don't pass --env-file=.env.local here: the ablation script itself was launched with
    // --env-file-if-exists=.env.local, so all PATCHBAY_* / NEBIUS_* / TAVILY_* vars are
    // already in process.env. If we re-read .env.local in the child, the PATCHBAY_STRONG_*
    // we deliberately deleted for the baseline variant come right back.
    const p = spawn('node', ['packages/agent/dist/cli.js', 'build', prompt], {
      cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    p.stdout.on('data', (b) => (out += String(b)))
    p.stderr.on('data', (b) => (out += String(b)))
    p.on('close', () => {
      const slot = `${variant}-prompt-${String(promptIdx + 1).padStart(2, '0')}`
      writeFileSync(join(OUT_DIR, `${slot}.log`), out)
      const m = out.match(/[✖✔] verify — (\d+)\/(\d+) tests after (\d+) attempt/)
      const passed = m ? Number(m[1]) : 0
      const total = m ? Number(m[2]) : 0
      const attempts = m ? Number(m[3]) : 0
      const costs = [...out.matchAll(/\$(\d+\.\d+)/g)].map((x) => Number(x[1]))
      const cost = costs.length ? costs.reduce((s, c) => s + c, 0) : 0
      const seconds = Math.round((Date.now() - start) / 1000)
      const green = passed > 0 && passed === total
      const greenFirstTry = green && attempts === 1
      console.log(`  ${slot}: ${green ? '✔' : '✖'} ${passed}/${total}, ${attempts}a, $${cost.toFixed(4)}, ${seconds}s`)
      resolve({ variant, promptIdx, prompt, green, greenFirstTry, passed, total, attempts, cost, seconds })
    })
  })
}

async function runVariant(variant: 'finetuned' | 'baseline'): Promise<BuildResult[]> {
  const results: BuildResult[] = []
  console.log(`\n[${variant}] running ${PROMPTS.length} builds, batched ${BATCH}…`)
  for (let i = 0; i < PROMPTS.length; i += BATCH) {
    const slice = PROMPTS.slice(i, i + BATCH)
    const batch = await Promise.all(slice.map((p, k) => runOne(variant, p, i + k)))
    results.push(...batch)
    if (i + BATCH < PROMPTS.length) await new Promise((r) => setTimeout(r, BATCH_GAP_MS))
  }
  return results
}

interface Agg {
  variant: 'finetuned' | 'baseline'
  model: string
  baseUrl: string
  greens: number
  firstTry: number
  totalCost: number
  avgCost: number
  avgSeconds: number
}

function aggregate(variant: 'finetuned' | 'baseline', results: BuildResult[]): Agg {
  const greens = results.filter((r) => r.green).length
  const firstTry = results.filter((r) => r.greenFirstTry).length
  const totalCost = results.reduce((s, r) => s + r.cost, 0)
  const avgSeconds = results.reduce((s, r) => s + r.seconds, 0) / results.length
  return {
    variant,
    model: variant === 'finetuned'
      ? `${process.env.PATCHBAY_MODEL_REPAIR} (repair) + Nemotron-3-Ultra-550b-a55b (generate)`
      : 'nvidia/Nemotron-3-Ultra-550b-a55b (both steps)',
    baseUrl: variant === 'finetuned'
      ? `${process.env.PATCHBAY_REPAIR_LLM_BASE_URL} (repair) + Token Factory (generate)`
      : 'https://api.tokenfactory.nebius.com/v1',
    greens,
    firstTry,
    totalCost,
    avgCost: totalCost / results.length,
    avgSeconds,
  }
}

function pct(x: number): string { return `${(x * 100).toFixed(1)}%` }

function makeComparison(ft: Agg, base: Agg, n: number): string {
  const lines: string[] = []
  lines.push('# Fine-tuned Qwen3-30B on repair step vs pure Nemotron Ultra 550B')
  lines.push('')
  lines.push(`Same 20 TS Core prompts, one pass per variant = ${n} builds per variant.`)
  lines.push('')
  lines.push('The fine-tune was trained on red→green repair pairs, so this variant uses it ONLY for the repair step; Ultra still does the fresh-generation step.')
  lines.push('')
  lines.push('| | Fine-tune on repair + Ultra generate | Pure Ultra (both steps) |')
  lines.push('| --- | --- | --- |')
  lines.push(`| model | \`${ft.model}\` | \`${base.model}\` |`)
  lines.push(`| served from | \`${ft.baseUrl}\` | \`${base.baseUrl}\` |`)
  lines.push(`| green | **${pct(ft.greens / n)}** (${ft.greens}/${n}) | **${pct(base.greens / n)}** (${base.greens}/${n}) |`)
  lines.push(`| first-try | ${pct(ft.firstTry / n)} (${ft.firstTry}/${n}) | ${pct(base.firstTry / n)} (${base.firstTry}/${n}) |`)
  lines.push(`| cost / build (mean) | $${ft.avgCost.toFixed(4)} | $${base.avgCost.toFixed(4)} |`)
  lines.push(`| cost total | $${ft.totalCost.toFixed(4)} | $${base.totalCost.toFixed(4)} |`)
  lines.push(`| time / build (mean) | ${ft.avgSeconds.toFixed(0)}s | ${base.avgSeconds.toFixed(0)}s |`)
  lines.push('')
  const speedup = base.avgCost > 0 ? base.avgCost / Math.max(ft.avgCost, 1e-9) : 0
  lines.push(`Cost speedup (baseline $/build ÷ fine-tune $/build): **${speedup.toFixed(2)}×**${speedup > 1 ? ' cheaper' : ''}`)
  const greenDiff = ft.greens - base.greens
  const greenDiffPct = (greenDiff / n) * 100
  lines.push(`Green rate delta: **${greenDiffPct >= 0 ? '+' : ''}${greenDiffPct.toFixed(1)} pp**`)
  lines.push('')
  lines.push('Reproduce: `npx tsx --env-file-if-exists=.env.local scripts/bench-finetuned-ablation.ts`')
  return lines.join('\n') + '\n'
}

// Parse `${slot}.log` for a cached result when re-running one variant only.
function parseExistingLog(slot: string, variant: 'finetuned' | 'baseline', promptIdx: number): BuildResult | null {
  const path = join(OUT_DIR, `${slot}.log`)
  try {
    const out = require('node:fs').readFileSync(path, 'utf8') as string
    const m = out.match(/[✖✔] verify — (\d+)\/(\d+) tests after (\d+) attempt/)
    const passed = m ? Number(m[1]) : 0
    const total = m ? Number(m[2]) : 0
    const attempts = m ? Number(m[3]) : 0
    const costs = [...out.matchAll(/\$(\d+\.\d+)/g)].map((x) => Number(x[1]))
    const cost = costs.length ? costs.reduce((s, c) => s + c, 0) : 0
    const green = passed > 0 && passed === total
    return { variant, promptIdx, prompt: PROMPTS[promptIdx]!, green, greenFirstTry: green && attempts === 1, passed, total, attempts, cost, seconds: 0 }
  } catch { return null }
}

async function main() {
  const repair = process.env.PATCHBAY_MODEL_REPAIR
  const base = process.env.PATCHBAY_REPAIR_LLM_BASE_URL
  if (!repair || !base) {
    console.error('Missing PATCHBAY_MODEL_REPAIR and/or PATCHBAY_REPAIR_LLM_BASE_URL — set them in .env.local after deploying the GPU endpoint.')
    console.error('See scripts/deploy-finetune.md.')
    process.exit(1)
  }

  const variantFlag = process.argv.find((a) => a.startsWith('--variant='))?.split('=')[1]

  let ftResults: BuildResult[]
  let baseResults: BuildResult[]

  if (variantFlag === 'baseline') {
    console.log('[main] --variant=baseline — reusing cached fine-tune logs, running baseline only')
    ftResults = PROMPTS.map((_, i) => parseExistingLog(`finetuned-prompt-${String(i + 1).padStart(2, '0')}`, 'finetuned', i)!).filter(Boolean)
    if (ftResults.length !== PROMPTS.length) {
      console.error(`Expected ${PROMPTS.length} cached fine-tune logs, got ${ftResults.length}. Aborting.`)
      process.exit(1)
    }
    baseResults = await runVariant('baseline')
  } else {
    ftResults = await runVariant('finetuned')
    baseResults = await runVariant('baseline')
  }

  const ft = aggregate('finetuned', ftResults)
  const baseAgg = aggregate('baseline', baseResults)

  writeFileSync(join(OUT_DIR, 'summary.json'), JSON.stringify({ finetuned: { agg: ft, results: ftResults }, baseline: { agg: baseAgg, results: baseResults } }, null, 2))
  const md = makeComparison(ft, baseAgg, PROMPTS.length)
  writeFileSync(join(OUT_DIR, 'comparison.md'), md)

  console.log('\n' + md)
  console.log(`\nWritten to ${OUT_DIR}`)
}

void main().catch((e) => { console.error(e); process.exit(1) })

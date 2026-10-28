#!/usr/bin/env tsx
/**
 * Benchmark harness for the fine-tuned Qwen3-30B served from a Nebius AI Cloud
 * GPU endpoint. Same TS Core 20 prompts as our baseline variance pass, 2 passes
 * each = 40 live builds, batched 4-at-a-time to respect Tavily rate limits.
 *
 * The fine-tuned model is picked up from PATCHBAY_MODEL_STRONG (set in
 * .env.local after you follow scripts/deploy-finetune.md). This script does NOT
 * touch that env — it just spawns the CLI, which already honours it.
 *
 * Output: scratchpad/variance_finetuned_out/summary.json (same shape as the
 * other variance passes), plus one *.log per build for triage.
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

const PASSES = 2
const BATCH = 4
const BATCH_GAP_MS = 2000

const ROOT = process.cwd()
const OUT_DIR = join(ROOT, 'scratchpad', 'variance_finetuned_out')
mkdirSync(OUT_DIR, { recursive: true })

interface BuildResult {
  promptIdx: number
  passIdx: number
  prompt: string
  green: boolean
  greenFirstTry: boolean
  passed: number
  total: number
  attempts: number
  cost: number
  seconds: number
  errored: boolean
}

function runOne(prompt: string, promptIdx: number, passIdx: number): Promise<BuildResult> {
  const start = Date.now()
  return new Promise((resolve) => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PATCHBAY_LANG: 'ts',
      PATCHBAY_MAX_ATTEMPTS: '4',
      PATCHBAY_PARALLEL_REPAIRS: '2',
    }
    const p = spawn('node', ['--env-file=.env.local', 'packages/agent/dist/cli.js', 'build', prompt], {
      cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    p.stdout.on('data', (b) => (out += String(b)))
    p.stderr.on('data', (b) => (out += String(b)))
    p.on('close', () => {
      const slot = `prompt-${String(promptIdx + 1).padStart(2, '0')}-pass-${passIdx + 1}`
      writeFileSync(join(OUT_DIR, `${slot}.log`), out)
      const match = out.match(/[✖✔] verify — (\d+)\/(\d+) tests after (\d+) attempt/)
      const passed = match ? Number(match[1]) : 0
      const total = match ? Number(match[2]) : 0
      const attempts = match ? Number(match[3]) : 0
      const costs = [...out.matchAll(/\$(\d+\.\d+)/g)].map((m) => Number(m[1]))
      const cost = costs.length ? costs.reduce((s, c) => s + c, 0) : 0
      const seconds = Math.round((Date.now() - start) / 1000)
      const green = passed > 0 && passed === total
      const greenFirstTry = green && attempts === 1
      const errored = !match
      const marker = green ? '✔' : errored ? '!' : '✖'
      console.log(`  ${slot}: ${marker} ${passed}/${total}, ${attempts}a, $${cost.toFixed(4)}, ${seconds}s`)
      resolve({ promptIdx, passIdx, prompt, green, greenFirstTry, passed, total, attempts, cost, seconds, errored })
    })
  })
}

async function main() {
  const strong = process.env.PATCHBAY_MODEL_STRONG
  const base = process.env.PATCHBAY_LLM_BASE_URL
  console.log(`[bench-finetuned] PATCHBAY_MODEL_STRONG=${strong ?? '(default — Ultra)'}`)
  console.log(`[bench-finetuned] PATCHBAY_LLM_BASE_URL=${base ?? '(default — Token Factory)'}`)
  console.log(`Running ${PROMPTS.length * PASSES} builds (${PROMPTS.length} prompts × ${PASSES} passes), batched ${BATCH}…\n`)

  const jobs: (() => Promise<BuildResult>)[] = []
  for (let p = 0; p < PROMPTS.length; p++) {
    for (let pass = 0; pass < PASSES; pass++) {
      jobs.push(() => runOne(PROMPTS[p]!, p, pass))
    }
  }

  const results: BuildResult[] = []
  for (let i = 0; i < jobs.length; i += BATCH) {
    const slice = jobs.slice(i, i + BATCH)
    const batch = await Promise.all(slice.map((j) => j()))
    results.push(...batch)
    if (i + BATCH < jobs.length) await new Promise((r) => setTimeout(r, BATCH_GAP_MS))
  }

  const greens = results.filter((r) => r.green).length
  const firstTry = results.filter((r) => r.greenFirstTry).length
  const totalCost = results.reduce((s, r) => s + r.cost, 0)

  console.log('\n=== BENCH-FINETUNED summary ===')
  console.log(`  green:        ${greens}/${results.length} (${((greens / results.length) * 100).toFixed(1)}%)`)
  console.log(`  first-try:    ${firstTry}/${results.length} (${((firstTry / results.length) * 100).toFixed(1)}%)`)
  console.log(`  cost total:   $${totalCost.toFixed(4)}  (avg $${(totalCost / results.length).toFixed(4)} / build)`)
  console.log(`  cost / green: $${greens ? (results.filter((r) => r.green).reduce((s, r) => s + r.cost, 0) / greens).toFixed(4) : '—'}`)

  writeFileSync(join(OUT_DIR, 'summary.json'), JSON.stringify({
    model: strong ?? 'default',
    baseUrl: base ?? 'default',
    promptCount: PROMPTS.length,
    passes: PASSES,
    results,
    greens,
    firstTry,
    totalCost,
  }, null, 2))
  console.log(`\nFull log + summary.json in ${OUT_DIR}`)
}

void main().catch((e) => { console.error(e); process.exit(1) })

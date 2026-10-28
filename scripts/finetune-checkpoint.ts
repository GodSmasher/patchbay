#!/usr/bin/env tsx
/**
 * Poll a Nebius Token Factory fine-tune job to completion, then fetch and print the
 * checkpoint artifact URL + metadata — everything the AI Cloud deploy step needs.
 *
 * Usage:
 *   npx tsx --env-file-if-exists=.env.local scripts/finetune-checkpoint.ts <job-id> [--interval=60] [--once]
 *
 * Behaviour:
 *   - Polls GET /fine_tuning/jobs/{id} every `--interval` seconds (default 60) until
 *     status becomes succeeded / failed / cancelled.
 *   - `--once` skips polling and just reports the current state (useful in CI).
 *   - On success: tries /fine_tuning/jobs/{id}/checkpoints (OpenAI-style). If that
 *     endpoint 404s on Nebius we fall back to the job object's own fine_tuned_model
 *     id + any artifact URLs attached to the job itself.
 *   - On failure/cancellation: prints the error payload and exits 1.
 *
 * The printed output ends with the exact next-step snippet for scripts/deploy-finetune.md
 * so it's one copy-paste from here to a running GPU.
 */

const API = 'https://api.tokenfactory.nebius.com/v1'

function key(): string {
  const k = process.env.NEBIUS_API_KEY
  if (!k) throw new Error('NEBIUS_API_KEY missing. Run with --env-file-if-exists=.env.local.')
  return k
}

interface FetchResult<T> { status: number; body: T | null; raw: string }

async function req<T>(path: string): Promise<FetchResult<T>> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${key()}` } })
  const raw = await res.text()
  let body: T | null = null
  if (raw) {
    try { body = JSON.parse(raw) as T } catch { body = null }
  }
  return { status: res.status, body, raw }
}

async function requireReq<T>(path: string): Promise<T> {
  const r = await req<T>(path)
  if (r.status < 200 || r.status >= 300) {
    throw new Error(`GET ${path} → HTTP ${r.status}: ${r.raw.slice(0, 500)}`)
  }
  if (r.body === null) throw new Error(`GET ${path} → empty body`)
  return r.body
}

interface Job {
  id: string
  status: string
  fine_tuned_model: string | null
  trained_tokens: number | null
  error: unknown
  // Nebius-specific extensions some tenants see on the job object itself:
  result_files?: string[]
  artifacts?: { name?: string; url?: string; bytes?: number }[]
  checkpoints?: Checkpoint[]
}

interface Checkpoint {
  id: string
  created_at?: number
  fine_tuned_model_checkpoint?: string
  step_number?: number
  metrics?: Record<string, number>
  download_url?: string
  model_url?: string
  bytes?: number
}

const TERMINAL = new Set(['succeeded', 'failed', 'cancelled'])

function parseFlags(argv: string[]): { jobId: string; intervalSec: number; once: boolean } {
  let jobId = ''
  let intervalSec = 60
  let once = false
  for (const a of argv) {
    if (a === '--once') { once = true; continue }
    const m = a.match(/^--interval=(\d+)$/)
    if (m) { intervalSec = Math.max(5, Number(m[1])); continue }
    if (!a.startsWith('--')) jobId = a
  }
  return { jobId, intervalSec, once }
}

async function waitForTerminal(jobId: string, intervalSec: number, once: boolean): Promise<Job> {
  for (;;) {
    const job = await requireReq<Job>(`/fine_tuning/jobs/${jobId}`)
    const ts = new Date().toISOString().slice(11, 19)
    console.log(`[${ts}] ${job.status}${job.trained_tokens ? ` · ${job.trained_tokens} tokens` : ''}`)
    if (TERMINAL.has(job.status) || once) return job
    await new Promise((r) => setTimeout(r, intervalSec * 1000))
  }
}

/** Try /fine_tuning/jobs/{id}/checkpoints first; swallow 404s (Nebius may not expose it). */
async function fetchCheckpoints(jobId: string): Promise<Checkpoint[]> {
  const r = await req<{ data: Checkpoint[] }>(`/fine_tuning/jobs/${jobId}/checkpoints`)
  if (r.status === 404) {
    console.log('\n(/checkpoints returned 404 — falling back to job object artifacts.)')
    return []
  }
  if (r.status < 200 || r.status >= 300) {
    console.warn(`/checkpoints HTTP ${r.status}: ${r.raw.slice(0, 200)} — falling back.`)
    return []
  }
  return r.body?.data ?? []
}

function fmtBytes(n: number | undefined): string {
  if (!n || !Number.isFinite(n)) return '?'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let v = n, i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`
}

function printDeployHints(args: { modelId: string | null; checkpointUrl: string | null }) {
  console.log('\n---- next: deploy on Nebius AI Cloud ----')
  console.log('Full walkthrough: scripts/deploy-finetune.md')
  console.log('')
  console.log('TL;DR:')
  console.log('  1. console.eu-north1.nebius.com → AI orchestration → Create Endpoint')
  console.log('  2. GPU: H100 (eu-north1, $0.79/hr) or H200 ($1.50/hr)')
  console.log('  3. Image: vllm/vllm-openai:latest (or build scripts/vllm-deploy/)')
  if (args.checkpointUrl) console.log(`  4. CHECKPOINT_URL=${args.checkpointUrl}`)
  console.log('  5. Expose port 8000')
  console.log('  6. Copy the endpoint URL + a bearer token')
  console.log('')
  console.log('  Then in .env.local:')
  console.log('    PATCHBAY_LLM_BASE_URL=<endpoint-url>/v1')
  console.log('    PATCHBAY_LLM_PROVIDER=generic')
  console.log(`    PATCHBAY_MODEL_STRONG=${args.modelId ?? '<fine_tuned_model id>'}`)
  console.log('')
  console.log('  Benchmark against the fine-tuned model:')
  console.log('    npx tsx --env-file-if-exists=.env.local scripts/bench-finetuned-ablation.ts')
}

async function main() {
  const { jobId, intervalSec, once } = parseFlags(process.argv.slice(2))
  if (!jobId) {
    console.error('Usage: scripts/finetune-checkpoint.ts <ftjob-...> [--interval=60] [--once]')
    process.exit(1)
  }

  const job = await waitForTerminal(jobId, intervalSec, once)
  if (!TERMINAL.has(job.status)) {
    console.log(`\n(--once set; current status: ${job.status})`)
    return
  }
  if (job.status === 'failed' || job.status === 'cancelled') {
    console.log(`\n❌ job ${job.status}`)
    if (job.error) console.log(JSON.stringify(job.error, null, 2))
    process.exit(1)
  }

  // succeeded
  console.log(`\n✅ succeeded`)
  if (job.fine_tuned_model) console.log(`   fine_tuned_model: ${job.fine_tuned_model}`)

  // Prefer /checkpoints; fall back to any artifact URLs attached to the job.
  const checkpoints = await fetchCheckpoints(jobId)
  let chosenUrl: string | null = null

  if (checkpoints.length) {
    console.log(`\ncheckpoints (${checkpoints.length}):`)
    for (const ck of checkpoints) {
      const bits = [
        `  - ${ck.id}`,
        ck.step_number != null ? `step ${ck.step_number}` : '',
        ck.bytes ? fmtBytes(ck.bytes) : '',
      ].filter(Boolean).join(' · ')
      console.log(bits)
      if (ck.fine_tuned_model_checkpoint) console.log(`      model:    ${ck.fine_tuned_model_checkpoint}`)
      if (ck.download_url) console.log(`      download: ${ck.download_url}`)
      if (ck.model_url) console.log(`      model:    ${ck.model_url}`)
    }
    const last = checkpoints.at(-1)!
    chosenUrl = last.download_url ?? last.model_url ?? null
  } else if (job.artifacts?.length) {
    console.log(`\njob artifacts (${job.artifacts.length}):`)
    for (const a of job.artifacts) {
      console.log(`  - ${a.name ?? '?'} (${fmtBytes(a.bytes)}) ${a.url ?? ''}`.trimEnd())
    }
    chosenUrl = job.artifacts[0]?.url ?? null
  } else if (job.result_files?.length) {
    console.log(`\nresult_files: ${job.result_files.join(', ')}`)
    console.log('(These are file ids; fetch via /files/{id}/content when ready to download.)')
  } else {
    console.log('\n(No artifact URLs returned by the API — the fine_tuned_model id above is the handle.')
    console.log(' Nebius may expose checkpoint download only through the console; check')
    console.log(' console.eu-north1.nebius.com → Token Factory → Fine-tuned models for a Download button.)')
  }

  printDeployHints({ modelId: job.fine_tuned_model, checkpointUrl: chosenUrl })
}

void main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})

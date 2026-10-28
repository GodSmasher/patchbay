/**
 * End-to-end fine-tune launcher for Nebius Token Factory (OpenAI-compatible API).
 *
 * Usage:
 *   npx tsx scripts/finetune.ts upload
 *       → uploads bench/training-{train,eval}.jsonl, prints the file IDs
 *   npx tsx scripts/finetune.ts start --model=<id> --train=<file-id> --eval=<file-id>
 *       → creates the fine-tune job, prints job ID
 *   npx tsx scripts/finetune.ts status <job-id>
 *       → prints job state
 *   npx tsx scripts/finetune.ts watch <job-id>
 *       → polls every 60s until the job terminates
 *
 * Reads NEBIUS_API_KEY from env (.env.local via --env-file-if-exists).
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const API = 'https://api.tokenfactory.nebius.com/v1'

function key(): string {
  const k = process.env.NEBIUS_API_KEY
  if (!k) throw new Error('NEBIUS_API_KEY missing. Run with: npx tsx --env-file-if-exists=.env.local scripts/finetune.ts …')
  return k
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key()}`, ...(init.headers ?? {}) },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → HTTP ${res.status}: ${text.slice(0, 500)}`)
  return (text ? JSON.parse(text) : {}) as T
}

async function uploadFile(path: string, purpose: string): Promise<string> {
  const buf = readFileSync(path)
  const form = new FormData()
  form.append('purpose', purpose)
  form.append('file', new Blob([buf], { type: 'application/jsonl' }), path.split(/[\\/]/).pop() ?? 'data.jsonl')
  const body = await req<{ id: string; filename: string; bytes: number }>('/files', { method: 'POST', body: form })
  console.log(`uploaded ${body.filename} → ${body.id} (${body.bytes} bytes)`)
  return body.id
}

async function cmdUpload() {
  const base = process.cwd()
  const train = await uploadFile(join(base, 'bench', 'training-train.jsonl'), 'fine-tune')
  const evalId = await uploadFile(join(base, 'bench', 'training-eval.jsonl'), 'fine-tune')
  console.log('\nNext:')
  console.log(`  npx tsx --env-file-if-exists=.env.local scripts/finetune.ts start --model=nvidia/Nemotron-3_5-Lightning --train=${train} --eval=${evalId}`)
}

async function cmdStart(args: Record<string, string>) {
  const hyperparameters: Record<string, number> = {
    n_epochs: Number(args.epochs ?? 3),
    learning_rate_multiplier: Number(args.lr ?? 1),
    batch_size: Number(args.batch ?? 1),
  }
  // Nebius Token Factory accepts a `context_length` hyperparameter — our repair pairs
  // routinely hit 10-11k tokens (full connector + failing-test report + fixed files),
  // so the default 8192 rejects the dataset. 16384 covers everything in training-{train,eval}.jsonl.
  if (args.context) hyperparameters.context_length = Number(args.context)
  const body = {
    model: args.model ?? 'nvidia/Nemotron-3_5-Lightning',
    training_file: args.train,
    validation_file: args.eval,
    suffix: args.suffix ?? 'patchbay-repair',
    hyperparameters,
    integrations: [],
  }
  const job = await req<{ id: string; status: string; model: string }>('/fine_tuning/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  console.log(`created job ${job.id} on ${job.model}, status: ${job.status}`)
  console.log(`\nWatch:\n  npx tsx --env-file-if-exists=.env.local scripts/finetune.ts watch ${job.id}`)
}

async function cmdStatus(jobId: string) {
  const job = await req<{ id: string; status: string; fine_tuned_model: string | null; trained_tokens: number | null; error: unknown }>(`/fine_tuning/jobs/${jobId}`)
  console.log(JSON.stringify(job, null, 2))
}

async function cmdWatch(jobId: string) {
  const terminal = new Set(['succeeded', 'failed', 'cancelled'])
  for (;;) {
    const job = await req<{ id: string; status: string; fine_tuned_model: string | null; trained_tokens: number | null; error: unknown }>(`/fine_tuning/jobs/${jobId}`)
    const ts = new Date().toISOString().slice(11, 19)
    console.log(`[${ts}] ${job.status}${job.trained_tokens ? ` · ${job.trained_tokens} tokens` : ''}`)
    if (terminal.has(job.status)) {
      if (job.fine_tuned_model) console.log(`\n✅ fine-tuned model: ${job.fine_tuned_model}`)
      if (job.error) console.log(`\n❌ error:`, job.error)
      return
    }
    await new Promise((r) => setTimeout(r, 60_000))
  }
}

function parseArgs(args: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const a of args) {
    const m = a.match(/^--([^=]+)=(.*)$/)
    if (m) out[m[1]!] = m[2]!
  }
  return out
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  if (cmd === 'upload') return cmdUpload()
  if (cmd === 'start') return cmdStart(parseArgs(rest))
  if (cmd === 'status') return cmdStatus(rest[0]!)
  if (cmd === 'watch') return cmdWatch(rest[0]!)
  console.error('usage: finetune.ts {upload | start --model=… --train=… --eval=… | status <id> | watch <id>}')
  process.exit(1)
}

main().catch((e) => { console.error(e.message || e); process.exit(1) })

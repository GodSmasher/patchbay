#!/usr/bin/env tsx
/**
 * Download the result_files of a succeeded Nebius Token Factory fine-tune job and
 * reconstruct the HuggingFace-style checkpoint directory layout on disk.
 *
 * Usage:
 *   npx tsx --env-file-if-exists=.env.local scripts/finetune-download.ts <job-id> [--step=15] [--out=./checkpoints]
 *
 * What it does:
 *   1. GET /fine_tuning/jobs/{id} → list of result_file ids
 *   2. For each file: GET /files/{id} → metadata (incl. filename like `ftckpt_<ckpt-id>/<path>`)
 *   3. Filter to the requested step's checkpoint (default: latest)
 *   4. For each kept file: GET /files/{id}/content → write to <out>/<ckpt-id>/<path>
 *   5. Print the directory, byte count, and the exact vLLM `--model` argument to use
 */

import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { dirname, join } from 'node:path'

const API = 'https://api.tokenfactory.nebius.com/v1'

function key(): string {
  const k = process.env.NEBIUS_API_KEY
  if (!k) throw new Error('NEBIUS_API_KEY missing. Run with --env-file-if-exists=.env.local.')
  return k
}

async function req<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${key()}` } })
  const text = await res.text()
  if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}: ${text.slice(0, 400)}`)
  return (text ? JSON.parse(text) : {}) as T
}

interface Job { id: string; status: string; result_files?: string[]; fine_tuned_model: string | null }
interface FileMeta { id: string; filename: string; bytes: number; purpose: string }

function parseArgs(argv: string[]): { jobId: string; step: string | null; out: string } {
  let jobId = ''
  let step: string | null = null
  let out = './checkpoints'
  for (const a of argv) {
    const stepMatch = a.match(/^--step=(.+)$/)
    const outMatch = a.match(/^--out=(.+)$/)
    if (stepMatch) step = stepMatch[1]!
    else if (outMatch) out = outMatch[1]!
    else if (!a.startsWith('--')) jobId = a
  }
  return { jobId, step, out }
}

async function downloadFile(id: string, destPath: string): Promise<void> {
  mkdirSync(dirname(destPath), { recursive: true })
  const res = await fetch(`${API}/files/${id}/content`, { headers: { Authorization: `Bearer ${key()}` } })
  if (!res.ok || !res.body) throw new Error(`download ${id}: HTTP ${res.status}`)
  await pipeline(Readable.fromWeb(res.body as unknown as import('node:stream/web').ReadableStream<Uint8Array>), createWriteStream(destPath))
}

function fmtBytes(n: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 10 ? 0 : 2)} ${units[i]}`
}

async function main() {
  const { jobId, step, out } = parseArgs(process.argv.slice(2))
  if (!jobId) {
    console.error('Usage: scripts/finetune-download.ts <ftjob-...> [--step=15] [--out=./checkpoints]')
    process.exit(1)
  }

  console.log(`job ${jobId}`)
  const job = await req<Job>(`/fine_tuning/jobs/${jobId}`)
  if (job.status !== 'succeeded') {
    console.error(`job status is "${job.status}", not succeeded — nothing to download`)
    process.exit(1)
  }
  const files = job.result_files ?? []
  console.log(`result_files: ${files.length}`)

  // Pull metadata for all files to see the checkpoint grouping.
  const metas: FileMeta[] = []
  for (const id of files) {
    const meta = await req<FileMeta>(`/files/${id}`)
    metas.push(meta)
  }
  const byCkpt = new Map<string, FileMeta[]>()
  for (const m of metas) {
    const match = m.filename.match(/^(ftckpt_[^\/]+)\//)
    const bucket = match ? match[1]! : 'root'
    const list = byCkpt.get(bucket) ?? []
    list.push(m)
    byCkpt.set(bucket, list)
  }
  console.log('')
  console.log(`checkpoints (${byCkpt.size}):`)
  for (const [ckpt, list] of byCkpt) {
    const totalBytes = list.reduce((s, m) => s + m.bytes, 0)
    console.log(`  ${ckpt} — ${list.length} files, ${fmtBytes(totalBytes)}`)
  }

  // Pick which checkpoint to download. Default: largest / latest.
  // Each checkpoint is suffixed by its step via the chat_template path, but easier: just sort by
  // first-seen file id (newest typically last in result_files) and pick the final one.
  const sortedByOrder = [...byCkpt.entries()]
  let chosenCkpt: string
  if (step !== null) {
    const found = sortedByOrder.find(([_c, list]) => list.some((f) => f.filename.includes(`step-${step}`) || f.filename.includes(`ckpt-step-${step}`)))
    if (found) chosenCkpt = found[0]
    else {
      // Fallback: sort by total bytes and pick largest (step-15 is almost always largest due to packing).
      sortedByOrder.sort((a, b) => b[1].reduce((s, m) => s + m.bytes, 0) - a[1].reduce((s, m) => s + m.bytes, 0))
      chosenCkpt = sortedByOrder[0]![0]
      console.log(`(no file name contained step-${step}; falling back to the biggest checkpoint: ${chosenCkpt})`)
    }
  } else {
    // No step: pick largest. For a 3-epoch run with eval every N steps, the final/largest = best candidate.
    sortedByOrder.sort((a, b) => b[1].reduce((s, m) => s + m.bytes, 0) - a[1].reduce((s, m) => s + m.bytes, 0))
    chosenCkpt = sortedByOrder[0]![0]
  }
  const chosen = byCkpt.get(chosenCkpt)!
  const totalBytes = chosen.reduce((s, m) => s + m.bytes, 0)
  console.log('')
  console.log(`→ downloading ${chosen.length} files from ${chosenCkpt} (${fmtBytes(totalBytes)})`)

  const outDir = join(out, chosenCkpt)
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  // Download sequentially — safer under rate limits, slower than parallel but no retries needed.
  let done = 0
  for (const file of chosen) {
    const relPath = file.filename.replace(/^ftckpt_[^\/]+\//, '')
    const dest = join(outDir, relPath)
    process.stdout.write(`  [${done + 1}/${chosen.length}] ${relPath} (${fmtBytes(file.bytes)}) ...`)
    await downloadFile(file.id, dest)
    process.stdout.write(' ✓\n')
    done++
  }

  console.log('')
  console.log(`✅ downloaded to ${outDir}`)
  console.log(`total ${fmtBytes(totalBytes)}`)
  console.log('')
  console.log('vLLM serve command:')
  console.log(`  python -m vllm.entrypoints.openai.api_server \\`)
  console.log(`    --model ${outDir} \\`)
  console.log(`    --served-model-name patchbay-repair \\`)
  console.log(`    --max-model-len 32768 \\`)
  console.log(`    --port 8000`)
  console.log('')
  console.log('Then in .env.local:')
  console.log('  PATCHBAY_LLM_BASE_URL=http://<gpu-ip>:8000/v1')
  console.log('  PATCHBAY_LLM_PROVIDER=generic')
  console.log('  PATCHBAY_MODEL_STRONG=patchbay-repair')
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})

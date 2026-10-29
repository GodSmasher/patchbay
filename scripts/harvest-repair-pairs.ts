#!/usr/bin/env tsx
/**
 * Walk bench/runs/pass-* and the just-finished ablation logs, extract every
 * red-to-green attempt transition as a training pair for a second fine-tune run.
 *
 * Output format matches our existing training file: JSONL with one object per pair
 * containing `red_files`, `red_report`, `green_files`, `prompt`. The format exactly
 * matches scratchpad/finetune_dataset/train.jsonl so we can concatenate and retrain.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT_DIR = 'scratchpad/finetune_dataset_v2'
mkdirSync(OUT_DIR, { recursive: true })

interface FilesEvent { type: 'files'; attempt: number; files: { path: string; content: string }[] }
interface TestsEvent { type: 'tests'; attempt: number; report: {
  typecheckOk: boolean; typecheckOutput: string
  passed: number; failed: number; total: number
  failures: { name: string; message?: string }[]
} }
interface BenchRun { prompt: string; events: ({ type: string } & Record<string, unknown>)[] }

interface Pair {
  prompt: string
  source: string
  red_files: { path: string; content: string }[]
  red_report: TestsEvent['report']
  green_files: { path: string; content: string }[]
}

function extractPairsFromRun(run: BenchRun, source: string): Pair[] {
  const pairs: Pair[] = []
  const attempts = new Map<number, { files?: FilesEvent['files']; report?: TestsEvent['report'] }>()
  for (const e of run.events) {
    if (e.type === 'files') {
      const f = e as unknown as FilesEvent
      const entry = attempts.get(f.attempt) ?? {}
      entry.files = f.files
      attempts.set(f.attempt, entry)
    } else if (e.type === 'tests') {
      const t = e as unknown as TestsEvent
      const entry = attempts.get(t.attempt) ?? {}
      entry.report = t.report
      attempts.set(t.attempt, entry)
    }
  }
  const ordered = [...attempts.entries()].sort(([a], [b]) => a - b)
  // Extract EVERY (attempt N red → attempt N+1 any) pair where files + report exist.
  // The source attempt number is the RED attempt, matching the convention of the original
  // bench/training-train.jsonl (where attemptNumber tags the failing attempt whose output we fix).
  for (let i = 0; i < ordered.length - 1; i++) {
    const [n, red] = ordered[i]!
    const [, next] = ordered[i + 1]!
    if (!red.files || !red.report || !next.files) continue
    const isRed = !red.report.typecheckOk || red.report.failed > 0
    if (!isRed) continue
    pairs.push({
      prompt: run.prompt,
      source: `${source}#attempt-${n}`,
      red_files: red.files,
      red_report: red.report,
      green_files: next.files,
    })
  }
  return pairs
}

function readBenchDir(dir: string): Pair[] {
  if (!existsSync(dir)) return []
  const pairs: Pair[] = []
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue
    const run: BenchRun = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    const sourceLabel = `${dir}/${file}`
    pairs.push(...extractPairsFromRun(run, sourceLabel))
  }
  return pairs
}

const sources = ['bench/runs/pass-1', 'bench/runs/pass-2', 'bench/runs/pass-3', 'bench/runs/pass-4', 'bench/runs/pass-5']
const allPairs: Pair[] = []
for (const s of sources) {
  const p = readBenchDir(s)
  console.log(`${s}: ${p.length} red→green pairs`)
  allPairs.push(...p)
}

// Light dedup: same prompt + same red test failures → same pair semantically.
const seen = new Set<string>()
const unique = allPairs.filter((p) => {
  const key = `${p.prompt}|${p.red_report.failed}|${(p.red_report.failures[0]?.name) ?? ''}|${p.red_report.total}`
  if (seen.has(key)) return false
  seen.add(key)
  return true
})

console.log(`\n${allPairs.length} total pairs, ${unique.length} after dedup`)

// Match the exact format of bench/training-train.jsonl so the new pairs concat cleanly.
const SYSTEM = `You are the repair step of patchbay. Given a TypeScript connector that failed its sandbox tests, output the full set of fixed files that will make every test pass. Output each file as <file path="…">…</file> blocks with no prose outside them.`

function fileBlocks(files: { path: string; content: string }[]): string {
  return files.map((f) => `<file path="${f.path}">\n${f.content}\n</file>`).join('\n')
}

function formatRedUser(p: Pair): string {
  const typecheck = p.red_report.typecheckOk ? '' : `\n\nTypecheck errors:\n${p.red_report.typecheckOutput}`
  const fails = p.red_report.failures.map((f) => `- ${f.name}${f.message ? `\n  ${f.message.slice(0, 600)}` : ''}`).join('\n')
  return `Original request: ${p.prompt}\n\nCurrent files:\n${fileBlocks(p.red_files)}${typecheck}\n\nFailing tests (${p.red_report.failed}/${p.red_report.total}):\n${fails}`
}

function formatGreenAssistant(p: Pair): string {
  return fileBlocks(p.green_files)
}

const out: string[] = []
for (const p of unique) {
  const attemptMatch = p.source.match(/attempt-(\d+)/)
  // attemptNumber here = the RED attempt that was fixed, matching bench/training-train.jsonl convention.
  const attemptNumber = attemptMatch ? Number(attemptMatch[1]) : 0
  const passSource = p.source.replace(/^bench\/runs\//, '').replace(/#.*/, '')
  out.push(JSON.stringify({
    prompt: p.prompt,
    passSource,
    attemptNumber,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: formatRedUser(p) },
      { role: 'assistant', content: formatGreenAssistant(p) },
    ],
  }))
}

const outPath = join(OUT_DIR, 'train.jsonl')
writeFileSync(outPath, out.join('\n') + '\n')
console.log(`\nWrote ${unique.length} training pairs to ${outPath}`)
console.log(`Total bytes: ${Buffer.byteLength(out.join('\n'), 'utf8') / 1024 / 1024} MiB`)

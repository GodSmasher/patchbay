/**
 * Walks every recorded benchmark run and emits one JSONL training example per observed
 * (red state → green state) repair step. The resulting dataset is what we'll fine-tune
 * a Nemotron repair model on so patchbay can get past its 79% ceiling.
 *
 * Each line is a `messages`-shaped record ready for Nebius AI Cloud fine-tuning:
 *   { prompt, messages: [{role: 'system', content: SYSTEM}, {role: 'user', content: BROKEN_FILES + FAILURE_REPORT}, {role: 'assistant', content: FIXED_FILES}] }
 *
 * Usage:
 *   npx tsx scripts/extract-training-data.ts > bench/training-data.jsonl
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface RunFile { prompt: string; events: Event[] }
interface Event { type: string; [k: string]: unknown }
interface FilesEvent extends Event { type: 'files'; attempt: number; files: Array<{ path: string; content: string }> }
interface TestsEvent extends Event { type: 'tests'; attempt: number; report: TestReport }
interface ResultEvent extends Event { type: 'result'; ok: boolean; attempts: number; files: Array<{ path: string; content: string }>; report?: TestReport }
interface TestReport { typecheckOk: boolean; typecheckOutput: string; passed: number; failed: number; total: number; failures: Array<{ name: string; message: string }>; contract?: string }

interface TrainingExample {
  prompt: string
  passSource: string
  attemptNumber: number
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
}

const SYSTEM = `You are the repair step of patchbay. Given a TypeScript connector that failed its sandbox tests, output the full set of fixed files that will make every test pass. Output each file as <file path="…">…</file> blocks with no prose outside them.`

function renderFiles(files: Array<{ path: string; content: string }>): string {
  return files.map((f) => `<file path="${f.path}">\n${f.content}\n</file>`).join('\n')
}

function renderFailure(report: TestReport): string {
  const tc = report.typecheckOk ? 'Typecheck passed.' : `Typecheck failed:\n${report.typecheckOutput.slice(0, 3000)}`
  const failures = report.failures.map((f) => `- ${f.name}\n  ${f.message.slice(0, 800)}`).join('\n\n')
  return `${tc}\n\nTest results: ${report.passed}/${report.total} passing, contract ${report.contract ?? 'n/a'}.\n\nFailures:\n${failures}`
}

function extractFromRun(data: RunFile, source: string): TrainingExample[] {
  const examples: TrainingExample[] = []
  const files = data.events.filter((e): e is FilesEvent => e.type === 'files')
  const tests = data.events.filter((e): e is TestsEvent => e.type === 'tests')
  const result = data.events.find((e): e is ResultEvent => e.type === 'result')

  for (const testEvent of tests) {
    if (testEvent.report.failed === 0 && testEvent.report.typecheckOk) continue
    const redFiles = files.find((f) => f.attempt === testEvent.attempt)?.files
    if (!redFiles) continue

    const nextAttempt = testEvent.attempt + 1
    let greenFiles = files.find((f) => f.attempt === nextAttempt)?.files
    if (!greenFiles && result?.ok && result.attempts === nextAttempt) greenFiles = result.files
    if (!greenFiles) continue

    const nextTests = tests.find((t) => t.attempt === nextAttempt)
    const isNextGreen = (nextTests && nextTests.report.failed === 0 && nextTests.report.typecheckOk) || (result?.ok && result.attempts === nextAttempt)
    if (!isNextGreen) continue

    examples.push({
      prompt: data.prompt,
      passSource: source,
      attemptNumber: testEvent.attempt,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Original request: ${data.prompt}\n\nCurrent files:\n${renderFiles(redFiles)}\n\n${renderFailure(testEvent.report)}\n\nReturn the fixed files.` },
        { role: 'assistant', content: renderFiles(greenFiles) },
      ],
    })
  }
  return examples
}

function main() {
  const base = join(process.cwd(), 'bench', 'runs')
  const passes = readdirSync(base).filter((d) => d.startsWith('pass-'))
  const standalone = readdirSync(base).filter((f) => f.endsWith('.json'))
  const all: TrainingExample[] = []
  for (const file of standalone) {
    const raw = JSON.parse(readFileSync(join(base, file), 'utf8')) as RunFile
    all.push(...extractFromRun(raw, `root/${file}`))
  }
  for (const pass of passes) {
    const files = readdirSync(join(base, pass)).filter((f) => f.endsWith('.json'))
    for (const file of files) {
      const raw = JSON.parse(readFileSync(join(base, pass, file), 'utf8')) as RunFile
      const examples = extractFromRun(raw, `${pass}/${file}`)
      all.push(...examples)
    }
  }
  const out = all.map((e) => JSON.stringify(e)).join('\n')
  writeFileSync(join(process.cwd(), 'bench', 'training-data.jsonl'), out + '\n')
  console.error(`Extracted ${all.length} training examples across ${passes.length} passes.`)
  console.error(`Written to bench/training-data.jsonl (${(Buffer.byteLength(out) / 1024).toFixed(1)} KB).`)
  const byPass = new Map<string, number>()
  for (const e of all) byPass.set(e.passSource.split('/')[0]!, (byPass.get(e.passSource.split('/')[0]!) ?? 0) + 1)
  for (const [p, n] of byPass) console.error(`  ${p}: ${n} examples`)
}

main()

/**
 * Evaluate a repair model (base or fine-tuned) against the held-out eval set.
 * For each example:
 *   1. Send system+user to the model
 *   2. Parse <file …> blocks from the response
 *   3. Score: format-ok (parses?) + file-coverage (same paths?) + content-similarity (line-overlap ratio)
 *
 * Usage:
 *   npx tsx --env-file-if-exists=.env.local scripts/eval-repair.ts \
 *     --model=nvidia/Nemotron-3_5-Lightning \
 *     [--file=bench/training-eval.jsonl]
 *
 *   # After fine-tune:
 *   npx tsx --env-file-if-exists=.env.local scripts/eval-repair.ts \
 *     --model=ft:nvidia/Nemotron-3_5-Lightning:patchbay-repair:xyz
 */

import { readFileSync } from 'node:fs'

interface Example { messages: Array<{ role: string; content: string }> }
interface File { path: string; content: string }

const API = 'https://api.tokenfactory.nebius.com/v1/chat/completions'

function parseFiles(text: string): File[] {
  const files: File[] = []
  const re = /<file\s+path="([^"]+)">([\s\S]*?)<\/file>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) files.push({ path: m[1]!, content: m[2]!.trim() })
  return files
}

function lineOverlap(a: string, b: string): number {
  const aLines = new Set(a.split('\n').map((l) => l.trim()).filter(Boolean))
  const bLines = b.split('\n').map((l) => l.trim()).filter(Boolean)
  if (!bLines.length) return 0
  const hits = bLines.filter((l) => aLines.has(l)).length
  return hits / bLines.length
}

async function callModel(model: string, messages: Array<{ role: string; content: string }>): Promise<string> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.NEBIUS_API_KEY!}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: 16000 }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${model} → ${res.status}: ${text.slice(0, 300)}`)
  const data = JSON.parse(text) as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content ?? ''
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')) as Array<[string, string]>)
  const model = args.model
  if (!model) throw new Error('--model=<id> is required')
  const file = args.file ?? 'bench/training-eval.jsonl'

  const lines = readFileSync(file, 'utf8').trim().split('\n')
  const examples = lines.map((l) => JSON.parse(l) as Example)
  console.log(`Evaluating ${model} on ${examples.length} examples from ${file}\n`)

  let formatOk = 0
  let fullCoverage = 0
  let totalOverlap = 0
  const perExample: Array<{ idx: number; formatOk: boolean; coverage: number; overlap: number }> = []

  for (let i = 0; i < examples.length; i++) {
    const ex = examples[i]!
    const expected = parseFiles(ex.messages[2]!.content)
    const expectedPaths = new Set(expected.map((f) => f.path))

    try {
      const answer = await callModel(model, ex.messages.slice(0, 2))
      const got = parseFiles(answer)
      const gotPaths = new Set(got.map((f) => f.path))

      const formatOkThis = got.length > 0
      const coverage = expected.length ? [...expectedPaths].filter((p) => gotPaths.has(p)).length / expected.length : 0

      let overlap = 0
      for (const exp of expected) {
        const match = got.find((g) => g.path === exp.path)
        if (match) overlap += lineOverlap(match.content, exp.content)
      }
      overlap = expected.length ? overlap / expected.length : 0

      if (formatOkThis) formatOk++
      if (coverage === 1) fullCoverage++
      totalOverlap += overlap

      perExample.push({ idx: i, formatOk: formatOkThis, coverage, overlap })
      console.log(`[${i + 1}/${examples.length}] format:${formatOkThis ? '✓' : '✗'} coverage:${(coverage * 100).toFixed(0)}% overlap:${(overlap * 100).toFixed(0)}%`)
    } catch (error) {
      console.log(`[${i + 1}/${examples.length}] ERROR: ${(error as Error).message}`)
      perExample.push({ idx: i, formatOk: false, coverage: 0, overlap: 0 })
    }
  }

  console.log(`\n=== ${model} ===`)
  console.log(`Format OK:       ${formatOk}/${examples.length} (${((formatOk / examples.length) * 100).toFixed(1)}%)`)
  console.log(`Full file cover: ${fullCoverage}/${examples.length} (${((fullCoverage / examples.length) * 100).toFixed(1)}%)`)
  console.log(`Avg line overlap: ${((totalOverlap / examples.length) * 100).toFixed(1)}%`)
}

main().catch((e) => { console.error(e.message || e); process.exit(1) })

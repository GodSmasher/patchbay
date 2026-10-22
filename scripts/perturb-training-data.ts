/**
 * Expand the fine-tune training set by taking the GREEN final files from every
 * benchmark run and injecting the classes of bugs patchbay has historically made
 * on first drafts. Each perturbation becomes a (red + synthetic failure report)
 * -> (original green) training pair, in the same JSONL schema as
 * extract-training-data.ts.
 *
 * The bug catalog comes from docs/build-log.md and the recurring failures in the
 * variance benchmarks: off-by-one retry counts, cursor pagination without
 * hasNextPage, missing Retry-After parse, URL template placeholders left in
 * literally, fixed delay instead of exponential backoff, wrong auth header name.
 *
 * Usage:
 *   npx tsx scripts/perturb-training-data.ts > bench/training-data-perturbed.jsonl
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface RunFile { prompt: string; events: Event[] }
interface Event { type: string; [k: string]: unknown }
interface ResultEvent extends Event { type: 'result'; ok: boolean; files: Array<{ path: string; content: string }> }
interface File { path: string; content: string }

interface Perturbation {
  name: string
  /** Only apply if the connector matches this test (returns true to attempt). */
  applies: (files: File[]) => boolean
  /** Returns the files with the bug injected, or null if it couldn't be inserted here. */
  inject: (files: File[]) => { files: File[]; failure: string } | null
}

const SYSTEM = `You are the repair step of patchbay. Given a TypeScript connector that failed its sandbox tests, output the full set of fixed files that will make every test pass. Output each file as <file path="…">…</file> blocks with no prose outside them.`

function renderFiles(files: File[]): string {
  return files.map((f) => `<file path="${f.path}">\n${f.content}\n</file>`).join('\n')
}

function connector(files: File[]): File | undefined {
  return files.find((f) => f.path === 'src/connector.ts')
}

const perturbations: Perturbation[] = [
  {
    name: 'off_by_one_retry',
    applies: (files) => /maxRetries|max.?attempts|MAX_?RETRIES/.test(connector(files)?.content ?? ''),
    inject: (files) => {
      const c = connector(files)
      if (!c) return null
      // Flip "<= maxRetries" / "< maxRetries" boundary so one extra call happens.
      const patched = c.content.replace(/(for\s*\(\s*let\s+\w+\s*=\s*0\s*;\s*\w+\s*)(<=|<)(\s*maxRetries)/, (_m, pre, op, post) => `${pre}${op === '<' ? '<=' : '<'}${post}`)
      if (patched === c.content) return null
      return { files: files.map((f) => (f.path === c.path ? { ...f, content: patched } : f)), failure: `Typecheck passed.\n\nTest results: N/N passing except retry-count assertion.\n\nFailures:\n- handle exhausts retries and throws\n  AssertionError: expected 3 to be 4 (fetch call count after exhausted retries)` }
    },
  },
  {
    name: 'cursor_truthy_only',
    applies: (files) => /hasNextPage|next_cursor|after:|starting_after|page_info/.test(connector(files)?.content ?? ''),
    inject: (files) => {
      const c = connector(files)
      if (!c) return null
      const patched = c.content.replace(/while\s*\(\s*([a-zA-Z_$][\w$.]*?\.hasNextPage|data\.hasNextPage|hasMore)\s*\)/, 'while (cursor)')
      if (patched === c.content) return null
      return { files: files.map((f) => (f.path === c.path ? { ...f, content: patched } : f)), failure: `Typecheck passed.\n\nTest results: pagination test failed, infinite loop on empty cursor.\n\nFailures:\n- handle terminates pagination\n  AssertionError: expected 2 pages, got 4 (loop didn't stop on empty cursor)` }
    },
  },
  {
    name: 'missing_retry_after',
    applies: (files) => /Retry-After|retry-after|retryAfter/i.test(connector(files)?.content ?? ''),
    inject: (files) => {
      const c = connector(files)
      if (!c) return null
      // Replace the Retry-After-aware delay with a fixed 1000ms delay.
      const patched = c.content.replace(/const\s+delay\s*=\s*Math\.max\([^)]+\)/, 'const delay = 1000')
      if (patched === c.content) return null
      return { files: files.map((f) => (f.path === c.path ? { ...f, content: patched } : f)), failure: `Typecheck passed.\n\nTest results: Retry-After honored test failed.\n\nFailures:\n- honors Retry-After header on 429\n  AssertionError: expected delay 5000, got 1000` }
    },
  },
  {
    name: 'placeholder_url',
    applies: (files) => /\{[a-z_]+\}\./.test(connector(files)?.content ?? ''),
    inject: (files) => {
      const c = connector(files)
      if (!c) return null
      // Leave a {company_domain} placeholder literally in the URL.
      const patched = c.content.replace(/`https:\/\/\$\{([^}]+)\}\.([a-z]+)\.com/, '`https://{$1}.$2.com')
      if (patched === c.content) return null
      return { files: files.map((f) => (f.path === c.path ? { ...f, content: patched } : f)), failure: `Typecheck passed.\n\nTest results: contract test failed, request URL contains literal placeholder.\n\nFailures:\n- contract handles the documented example payload\n  Error: not a documented endpoint — got POST https://{company_domain}.pipedrive.com/...` }
    },
  },
  {
    name: 'auth_header_wrong',
    applies: (files) => /Authorization.*Bearer/.test(connector(files)?.content ?? ''),
    inject: (files) => {
      const c = connector(files)
      if (!c) return null
      const patched = c.content.replace(/'?Authorization'?\s*:\s*`?Bearer\s+/, "'X-Auth-Token': `")
      if (patched === c.content) return null
      return { files: files.map((f) => (f.path === c.path ? { ...f, content: patched } : f)), failure: `Typecheck passed.\n\nTest results: auth header assertion failed.\n\nFailures:\n- sends Bearer token in Authorization header\n  AssertionError: expected 'Bearer token' got undefined` }
    },
  },
  {
    name: 'missing_validation',
    applies: (files) => /throw new Error\('Missing required field/.test(connector(files)?.content ?? ''),
    inject: (files) => {
      const c = connector(files)
      if (!c) return null
      const patched = c.content.replace(/if\s*\(!\w+\)\s*\{\s*throw new Error\('Missing required field[^']*'\)[\s\S]*?\}/, '// validation removed')
      if (patched === c.content) return null
      return { files: files.map((f) => (f.path === c.path ? { ...f, content: patched } : f)), failure: `Typecheck passed.\n\nTest results: missing-field validation test failed.\n\nFailures:\n- throws on missing required field\n  AssertionError: expected [Function] to throw error including 'Missing required field' but it did not throw` }
    },
  },
]

interface TrainingExample {
  prompt: string
  passSource: string
  perturbation: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
}

function extractGreenFromRun(data: RunFile, source: string): { files: File[]; prompt: string; source: string } | null {
  const result = data.events.find((e): e is ResultEvent => e.type === 'result' && e.ok === true)
  if (!result || !result.files) return null
  return { files: result.files, prompt: data.prompt, source }
}

function main() {
  const base = join(process.cwd(), 'bench', 'runs')
  const dirs = readdirSync(base)
  const greenRuns: Array<{ files: File[]; prompt: string; source: string }> = []

  const standalone = dirs.filter((f) => f.endsWith('.json'))
  for (const file of standalone) {
    const raw = JSON.parse(readFileSync(join(base, file), 'utf8')) as RunFile
    const g = extractGreenFromRun(raw, `root/${file}`)
    if (g) greenRuns.push(g)
  }
  const passes = dirs.filter((d) => d.startsWith('pass-'))
  for (const pass of passes) {
    const files = readdirSync(join(base, pass)).filter((f) => f.endsWith('.json'))
    for (const file of files) {
      const raw = JSON.parse(readFileSync(join(base, pass, file), 'utf8')) as RunFile
      const g = extractGreenFromRun(raw, `${pass}/${file}`)
      if (g) greenRuns.push(g)
    }
  }

  const examples: TrainingExample[] = []
  for (const run of greenRuns) {
    for (const p of perturbations) {
      if (!p.applies(run.files)) continue
      const result = p.inject(run.files)
      if (!result) continue
      examples.push({
        prompt: run.prompt,
        passSource: run.source,
        perturbation: p.name,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Original request: ${run.prompt}\n\nCurrent files:\n${renderFiles(result.files)}\n\n${result.failure}\n\nReturn the fixed files.` },
          { role: 'assistant', content: renderFiles(run.files) },
        ],
      })
    }
  }

  const out = examples.map((e) => JSON.stringify(e)).join('\n')
  writeFileSync(join(process.cwd(), 'bench', 'training-data-perturbed.jsonl'), out + '\n')
  console.error(`Generated ${examples.length} perturbation examples from ${greenRuns.length} green runs.`)
  const byPerturbation = new Map<string, number>()
  for (const e of examples) byPerturbation.set(e.perturbation, (byPerturbation.get(e.perturbation) ?? 0) + 1)
  for (const [p, n] of byPerturbation) console.error(`  ${p}: ${n}`)
  console.error(`Written to bench/training-data-perturbed.jsonl (${(Buffer.byteLength(out) / 1024).toFixed(1)} KB).`)
}

main()

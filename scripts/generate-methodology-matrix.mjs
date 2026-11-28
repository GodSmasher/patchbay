#!/usr/bin/env node
/**
 * Regenerate the check-to-source matrix inside apps/web/app/methodology/page.tsx
 * from the METADATA exports in packages/audit-core/src/checks/*.ts.
 *
 * Runs in two modes:
 *   write : rewrites page.tsx and exits 0
 *   check : exits 0 if page.tsx already matches, 1 otherwise (CI gate)
 *
 * Usage:
 *   node scripts/generate-methodology-matrix.mjs write
 *   node scripts/generate-methodology-matrix.mjs check
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')
const CHECKS_DIR = resolve(REPO, 'packages/audit-core/src/checks')
const PAGE = resolve(REPO, 'apps/web/app/methodology/page.tsx')
const START = '// MATRIX:START (generated — do not edit, run scripts/generate-methodology-matrix.mjs)'
const END = '// MATRIX:END'

const mode = process.argv[2] ?? 'check'
if (mode !== 'write' && mode !== 'check') {
  console.error('usage: generate-methodology-matrix.mjs write|check')
  process.exit(2)
}

// Minimal METADATA extractor. We don't run a TS compiler — a regex against the
// exported object is enough because the script that injected these blocks
// controls their shape.
function parseMetadata(src, path) {
  const m = src.match(/export const METADATA\s*=\s*\{([\s\S]*?)\}\s*as const/)
  if (!m) return null
  const body = m[1]
  const get = (key) => {
    const r = new RegExp("\\b" + key + ":\\s*('([^']*)'|\"([^\"]*)\"|true|false)")
    const mm = body.match(r)
    if (!mm) throw new Error(`${path}: METADATA missing "${key}"`)
    if (mm[2] !== undefined) return mm[2]
    if (mm[3] !== undefined) return mm[3]
    return mm[1] === 'true'
  }
  return {
    id: get('id'),
    category: get('category'),
    primarySource: get('primarySource'),
    confidence: get('confidence'),
    published: get('published'),
  }
}

const VALID_CONFIDENCE = new Set(['HIGH', 'MEDIUM', 'CONTEXTUAL'])

const files = readdirSync(CHECKS_DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
const SKIP_FILES = new Set(['index.ts', 'test-helpers.ts', 'tool-shapes.ts'])

const rows = []
const errors = []
for (const f of files) {
  if (SKIP_FILES.has(f)) continue
  const path = resolve(CHECKS_DIR, f)
  const src = readFileSync(path, 'utf8')
  const md = parseMetadata(src, path)
  if (!md) {
    errors.push(`${f}: no METADATA export`)
    continue
  }
  if (!VALID_CONFIDENCE.has(md.confidence)) {
    errors.push(`${f}: METADATA.confidence must be one of HIGH|MEDIUM|CONTEXTUAL (got "${md.confidence}")`)
    continue
  }
  if (md.published) rows.push(md)
}

if (errors.length > 0) {
  console.error('METADATA validation failed:')
  for (const e of errors) console.error('  ' + e)
  process.exit(1)
}

// Stable alpha sort by id so the matrix diff is minimal.
rows.sort((a, b) => a.id.localeCompare(b.id))

function escape(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}
function formatRow(r) {
  return [
    '  {',
    `    check: '${escape(r.id)}',`,
    `    category: '${escape(r.category)}',`,
    `    primarySource: '${escape(r.primarySource)}',`,
    `    confidence: '${r.confidence}',`,
    '  },',
  ].join('\n')
}

const body = ['const CHECK_MATRIX: CheckRow[] = [', ...rows.map(formatRow), ']'].join('\n')
const block = [START, body, END].join('\n')

const original = readFileSync(PAGE, 'utf8')
const startIdx = original.indexOf(START)
const endIdx = original.indexOf(END)
if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
  console.error(`methodology page is missing MATRIX markers.\n  expected lines:\n    ${START}\n    ${END}`)
  process.exit(1)
}
const next = original.slice(0, startIdx) + block + original.slice(endIdx + END.length)

if (mode === 'check') {
  if (next === original) {
    console.log(`ok (${rows.length} published checks)`)
    process.exit(0)
  }
  console.error('methodology matrix is stale — run: node scripts/generate-methodology-matrix.mjs write')
  // Show a one-screen diff hint so the CI log is actually actionable.
  const originalBlock = original.slice(startIdx, endIdx + END.length)
  console.error('\n--- current (truncated) ---')
  console.error(originalBlock.split('\n').slice(0, 6).join('\n') + '\n...')
  console.error('--- expected (truncated) ---')
  console.error(block.split('\n').slice(0, 6).join('\n') + '\n...')
  process.exit(1)
}

writeFileSync(PAGE, next)
console.log(`wrote matrix: ${rows.length} published checks`)

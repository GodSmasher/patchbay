#!/usr/bin/env node
/**
 * PROCESS-001 validation gate.
 *
 * Scans production source for the exec/execSync pattern that caused
 * SEC-001 (command injection in scan_repo via `execSync` with a
 * template-literal string containing `${...}`). When the shell parses
 * the double-quoted template, `$(...)`, backticks and `;` / `&&` inside
 * any interpolated value still expand, so the prefix check that preceded
 * the call was not protection.
 *
 * This gate catches the DIRECT pattern — the template literal is written
 * at the exec call site itself. It does not catch the indirect pattern
 * (build the string into a local variable first, pass the variable).
 * Indirect patterns are harder to grep for without a real AST pass; if
 * they show up we extend this gate rather than retire it.
 *
 * Exits non-zero on the first hit. Allow-listed files are listed in
 * ALLOWED_FILES below with a one-line justification each.
 *
 * Usage:
 *   npx tsx scripts/validate-process-001.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(__dirname, '..')

const SCAN_ROOTS = [
  'packages/mcp/src',
  'packages/agent/src',
  'packages/audit-core/src',
  'apps/web/app',
  'apps/web/lib',
  'scripts',
]

const EXTS = /\.(?:mts|cts|ts|tsx|mjs|cjs|js)$/i
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.turbo', 'fixtures'])

/** Files that intentionally contain a template-literal exec pattern. */
const ALLOWED_FILES = new Set<string>([
  // Regression tests for SEC-001 exercise execFileSync (argv form) directly in
  // the test body; the grep below never matches the argv form, so these are
  // only here as documentation of what was considered and intentionally left
  // without an exemption.
])

/**
 * Catches the exec / execSync call shape that caused SEC-001: see commit
 * 04ea42f for the before/after diff. Template literal with `${}` goes
 * directly into exec*; the shell interprets the interpolated value.
 *
 * Does NOT match execFile* (the safe form), does NOT match constant
 * template literals (no `${` inside), does NOT match `thing.execSync(`
 * method calls on objects — the `(?<![\w.])` keeps us out of those.
 */
const PATTERN = /(?<![\w.])(?:exec|execSync)\s*\(\s*`[^`]*\$\{/

interface Hit { file: string; line: number; snippet: string }

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try { entries = readdirSync(dir) } catch { return out }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue
    const p = join(dir, name)
    let st
    try { st = statSync(p) } catch { continue }
    if (st.isDirectory()) walk(p, out)
    else if (EXTS.test(name) && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(name)) out.push(p)
  }
  return out
}

function scanFile(abs: string): Hit[] {
  const rel = relative(ROOT, abs).replaceAll('\\', '/')
  if (ALLOWED_FILES.has(rel)) return []
  const text = readFileSync(abs, 'utf8')
  const lines = text.split('\n')
  const hits: Hit[] = []
  for (let i = 0; i < lines.length; i++) {
    // 2-line window so a template that opens on line N and interpolates on
    // line N+1 is caught too.
    const window = lines.slice(i, i + 2).join('\n')
    if (PATTERN.test(window)) {
      hits.push({ file: rel, line: i + 1, snippet: lines[i].trim() })
    }
  }
  return hits
}

function main(): void {
  const files: string[] = []
  for (const r of SCAN_ROOTS) walk(join(ROOT, r), files)

  const hits: Hit[] = []
  for (const f of files) hits.push(...scanFile(f))

  // One hit per (file, line) — a template spanning two lines reports twice
  // via the 2-line window; collapse.
  const seen = new Set<string>()
  const unique = hits.filter((h) => {
    const key = `${h.file}:${h.line}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (unique.length > 0) {
    console.error('PROCESS-001 FAIL: exec/execSync template-literal with ${} interpolation')
    console.error('')
    for (const h of unique) {
      console.error(`  ${h.file}:${h.line}`)
      console.error(`    ${h.snippet}`)
    }
    console.error('')
    console.error('This is the SEC-001 pattern (GHSA-wv32-8ppf-r6ww). The shell')
    console.error('interprets $(...), backticks and ; / && inside any interpolated')
    console.error('value, and a startsWith-style prefix check does not protect it.')
    console.error('')
    console.error('Fix: replace with execFileSync + argv array + "--" separator:')
    console.error('    execFileSync(cmd, [arg1, arg2, "--", userValue], { ... })')
    console.error('')
    console.error('If a template literal with interpolation is intentional here')
    console.error('(for example, a one-off script where the interpolated value')
    console.error('is a constant or a result of earlier static validation), add')
    console.error('the file path to ALLOWED_FILES in scripts/validate-process-001.ts')
    console.error('with a one-line justification.')
    process.exit(1)
  }

  console.log(`PROCESS-001 OK: scanned ${files.length} file(s) across ${SCAN_ROOTS.length} root(s), no template-literal exec/execSync interpolation.`)
}

main()

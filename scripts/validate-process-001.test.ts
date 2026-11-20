/**
 * PROCESS-001 validator — meta-tests.
 *
 * Runs the validator against planted fixtures to prove both directions:
 *   - positive fixture: reintroduces the SEC-001 pattern → validator exits 1
 *   - negative fixture: uses the fixed execFileSync shape → validator exits 0
 *
 * If this file ever passes with a validator that silently approves the SEC-001
 * pattern, the gate in CI has rotted and must be fixed before trusting it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const REPO_ROOT = join(__dirname, '..')
const VALIDATOR = join(__dirname, 'validate-process-001.ts')

function runValidatorInIsolatedRepo(positiveSnippet: string | null): { code: number; stdout: string; stderr: string } {
  // We cannot point the real validator at an arbitrary dir — SCAN_ROOTS is
  // hard-coded relative to the script's __dirname. Instead we build a
  // throwaway copy of just the directory layout the validator scans, write
  // the validator and (optionally) the positive snippet into it, then run.
  const work = mkdtempSync(join(tmpdir(), 'process-001-test-'))
  try {
    // Mirror the layout: scripts/ at the root, scanned dirs as empty folders.
    mkdirSync(join(work, 'scripts'), { recursive: true })
    for (const d of ['packages/mcp/src', 'packages/agent/src', 'packages/audit-core/src', 'apps/web/app', 'apps/web/lib']) {
      mkdirSync(join(work, d), { recursive: true })
    }
    cpSync(VALIDATOR, join(work, 'scripts', 'validate-process-001.ts'))

    if (positiveSnippet) {
      writeFileSync(join(work, 'packages/agent/src/planted.ts'), positiveSnippet)
    }

    try {
      const stdout = execFileSync('npx', ['-y', 'tsx', 'scripts/validate-process-001.ts'], {
        cwd: work,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      return { code: 0, stdout, stderr: '' }
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string }
      return { code: e.status ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' }
    }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

describe('PROCESS-001 validator', () => {
  it('passes on an empty tree with no planted code', () => {
    const r = runValidatorInIsolatedRepo(null)
    expect(r.code).toBe(0)
    expect(r.stdout).toMatch(/PROCESS-001 OK/)
  })

  it('catches the exact SEC-001 pattern reintroduced', () => {
    // Faithful reproduction of what SEC-001 looked like in cli.ts pre-fix.
    const planted = [
      `import { execSync } from 'node:child_process'`,
      ``,
      `export function badScan(url: string, target: string) {`,
      '  execSync(`git clone --depth=1 "${url}" "${target}"`, { stdio: "inherit" })',
      `}`,
      ``,
    ].join('\n')
    const r = runValidatorInIsolatedRepo(planted)
    expect(r.code).toBe(1)
    expect(r.stderr).toMatch(/PROCESS-001 FAIL/)
    expect(r.stderr).toMatch(/packages\/agent\/src\/planted\.ts/)
  })

  it('does not flag the fixed execFileSync argv shape', () => {
    const planted = [
      `import { execFileSync } from 'node:child_process'`,
      ``,
      `export function goodScan(url: string, target: string) {`,
      `  execFileSync('git', ['clone', '--depth=1', '--', url, target], { stdio: 'inherit' })`,
      `}`,
      ``,
    ].join('\n')
    const r = runValidatorInIsolatedRepo(planted)
    expect(r.code).toBe(0)
    expect(r.stdout).toMatch(/PROCESS-001 OK/)
  })

  it('does not flag a constant template literal (no interpolation)', () => {
    const planted = [
      `import { execSync } from 'node:child_process'`,
      ``,
      `export function listFiles() {`,
      '  return execSync(`ls -la`, { encoding: "utf8" })',
      `}`,
      ``,
    ].join('\n')
    const r = runValidatorInIsolatedRepo(planted)
    expect(r.code).toBe(0)
  })

  it('does not flag thing.execSync() method calls (noise suppression)', () => {
    const planted = [
      `const runner = { execSync: (cmd: string) => cmd }`,
      '',
      'export function demo(x: string) {',
      '  return runner.execSync(`echo ${x}`)',
      '}',
      '',
    ].join('\n')
    const r = runValidatorInIsolatedRepo(planted)
    expect(r.code).toBe(0)
  })
})

/**
 * SEC-001 regression: command injection via GitHub URL in `patchbay scan`.
 *
 * Reported by Pietro Procaccini, 2026-11-20. The old implementation ran
 * `execSync(`git clone --depth=1 "${url}" "${target}"`)` and the
 * `startsWith("https://github.com/")` guard did not prevent
 * `$(...)` / backtick expansion inside the shell's double quotes.
 *
 * This test asserts the invariant that the fixed pattern uses:
 *   execFileSync('git', ['clone', '--depth=1', '--', url, target])
 * does NOT invoke a shell, so shell metacharacters in the URL are passed
 * literally to git.
 *
 * It is NOT a strict regression guard for the production call site: if
 * someone reverts `packages/agent/src/cli.ts:scan` back to `execSync`
 * with string interpolation, this test will still pass because it
 * exercises `execFileSync` directly. The follow-up PROCESS-001 CI check
 * (grep for `execSync(.*\${` patterns in src/) is the real guard.
 *
 * What this test documents is the shape of the mitigation.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, unlinkSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('SEC-001 mitigation shape', () => {
  it('execFileSync(git, [clone, --depth=1, --, url, target]) does not shell-evaluate a $(…) payload in url', () => {
    const probe = join(tmpdir(), `sec-001-probe-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    if (existsSync(probe)) unlinkSync(probe)

    const maliciousUrl = `https://github.com/octocat/Hello-World$(touch ${probe})`
    const workDir = mkdtempSync(join(tmpdir(), 'sec-001-scan-'))
    const target = join(workDir, 'clone-target')

    try {
      execFileSync('git', ['clone', '--depth=1', '--', maliciousUrl, target], {
        stdio: 'ignore',
      })
    } catch {
      // Expected: git rejects a URL containing literal `$(…)` characters
      // (either as a parse error or a lookup failure). What matters for
      // SEC-001 is the next assertion.
    } finally {
      rmSync(workDir, { recursive: true, force: true })
    }

    expect(existsSync(probe)).toBe(false)
  })
})

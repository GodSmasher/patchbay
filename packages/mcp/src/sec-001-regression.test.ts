/**
 * SEC-001 regression: command injection via GitHub URL in the `scan_repo`
 * MCP tool. Mirrors packages/agent/src/sec-001-regression.test.ts — same
 * invariant, same shape. See that file's header for context.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, unlinkSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('SEC-001 mitigation shape (mcp)', () => {
  it('execFileSync(git, [clone, --depth=1, --, url, target]) does not shell-evaluate a $(…) payload in url', () => {
    const probe = join(tmpdir(), `sec-001-mcp-probe-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    if (existsSync(probe)) unlinkSync(probe)

    const maliciousUrl = `https://github.com/octocat/Hello-World$(touch ${probe})`
    const workDir = mkdtempSync(join(tmpdir(), 'sec-001-mcp-scan-'))
    const target = join(workDir, 'clone-target')

    try {
      execFileSync('git', ['clone', '--depth=1', '--', maliciousUrl, target], {
        stdio: 'ignore',
      })
    } catch {
      // Expected git failure on the bogus URL. SEC-001 is about what did
      // NOT happen as a side effect of trying.
    } finally {
      rmSync(workDir, { recursive: true, force: true })
    }

    expect(existsSync(probe)).toBe(false)
  })
})

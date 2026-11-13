import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { probeDirectory } from './directory'

function mkdir(): string {
  return mkdtempSync(join(tmpdir(), 'patchbay-audit-'))
}

describe('probeDirectory', () => {
  it('detects an openai-shaped secret', () => {
    const root = mkdir()
    // Assemble the test key from fragments so the pre-commit secret
    // scanner, which uses the same tightened regex as audit-core,
    // does not flag this test source. The scanner matches the runtime
    // value in the written file, not the source literal.
    const testKey = 'sk' + '-' + 'abcdefghij1234567890ABCDEFGHIJabcdefghij1234'
    writeFileSync(join(root, 'client.ts'), `const key = "${testKey}"\n`)
    const snap = probeDirectory(root)
    expect(snap.directory!.secretHits.some((h) => h.pattern === 'openai-key')).toBe(true)
  })

  it('collects env vars used', () => {
    const root = mkdir()
    writeFileSync(join(root, 'a.ts'), 'const k = process.env.OPENAI_API_KEY\n')
    writeFileSync(join(root, 'b.py'), "import os\nos.environ['SLACK_TOKEN']\n")
    const snap = probeDirectory(root)
    expect(snap.directory!.envVarsUsed).toContain('OPENAI_API_KEY')
    expect(snap.directory!.envVarsUsed).toContain('SLACK_TOKEN')
  })

  it('ignores node_modules', () => {
    const root = mkdir()
    mkdirSync(join(root, 'node_modules'))
    const fixtureKey = 'sk' + '-aaaaaaaaaaaaaaaaaaaa1234'
    writeFileSync(join(root, 'node_modules', 'bad.ts'), `const k = "${fixtureKey}"\n`)
    writeFileSync(join(root, 'ok.ts'), '// no secret here\n')
    const snap = probeDirectory(root)
    expect(snap.directory!.secretHits).toEqual([])
  })
})

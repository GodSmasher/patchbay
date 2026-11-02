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
    writeFileSync(join(root, 'client.ts'), `const key = "sk-abcdefghij1234567890ABCDEFGHIJ"\n`)
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
    writeFileSync(join(root, 'node_modules', 'bad.ts'), 'const k = "sk-aaaaaaaaaaaaaaaaaaaa1234"\n')
    writeFileSync(join(root, 'ok.ts'), '// no secret here\n')
    const snap = probeDirectory(root)
    expect(snap.directory!.secretHits).toEqual([])
  })
})

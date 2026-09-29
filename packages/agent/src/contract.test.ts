import { describe, expect, it } from 'vitest'
import { contractMissing, renderFixtures, withContract, withFixtures } from './contract'
import type { ApiSpec, TestReport } from './types'

const spec: ApiSpec = {
  source: { app: 'Calendly', role: 'source', method: 'POST', url: '(webhook)', auth: { type: 'none', envVar: 'X' }, example: { event: 'invitee.created', payload: { name: 'Ada' } }, docsUrl: 'https://developer.calendly.com/webhooks', notes: [] },
  target: [
    { app: 'Slack', role: 'target', method: 'post', url: 'https://slack.com/api/chat.postMessage', auth: { type: 'bearer', envVar: 'SLACK_BOT_TOKEN' }, example: {}, responseExample: { ok: true, ts: '1.2' }, docsUrl: 'https://api.slack.com/methods/chat.postMessage', notes: [] },
  ],
}

const report = (over: Partial<TestReport> = {}): TestReport => ({ typecheckOk: true, typecheckOutput: '', passed: 3, failed: 0, total: 3, failures: [], durationMs: 1, ranOn: 'x', ...over })
const tests = (content: string) => [{ path: 'src/connector.test.ts', content }]

describe('renderFixtures', () => {
  it('writes the documented example, endpoints and responses with their sources', () => {
    const file = renderFixtures(spec)
    expect(file.path).toBe('src/fixtures.ts')
    expect(file.content).toContain('// Source: https://developer.calendly.com/webhooks')
    expect(file.content).toContain('"event": "invitee.created"')
    expect(file.content).toContain('"method": "POST"')
    expect(file.content).toContain('"POST https://slack.com/api/chat.postMessage": {')
  })

  it('replaces a fixtures file the model tried to write', () => {
    const merged = withFixtures([{ path: 'src/fixtures.ts', content: 'tampered' }, { path: 'a.ts', content: '' }], renderFixtures(spec))
    expect(merged.map((f) => f.path)).toEqual(['a.ts', 'src/fixtures.ts'])
    expect(merged[1]?.content).not.toBe('tampered')
  })
})

describe('contract status', () => {
  const good = "import { SOURCE_EXAMPLE } from './fixtures'\ndescribe('contract', () => { handle(SOURCE_EXAMPLE) })"

  it('requires the import, the describe block and the example payload', () => {
    expect(contractMissing(tests(good))).toBeNull()
    expect(contractMissing(tests("describe('contract', () => {})"))).toMatch(/does not import/)
    expect(contractMissing(tests("import { X } from './fixtures'\ndescribe('other', () => {})"))).toMatch(/no describe\("contract"/)
    expect(contractMissing(tests("import { TARGET_RESPONSES } from './fixtures'\ndescribe('contract', () => {})"))).toMatch(/never pass SOURCE_EXAMPLE/)
  })

  it('adds a failing check when the contract block is missing and blocks green', () => {
    const r = withContract(report(), tests("describe('x', () => {})"))
    expect(r).toMatchObject({ contract: 'missing', failed: 1, total: 4 })
  })

  it('marks failed contract tests', () => {
    const r = withContract(report({ failed: 1, failures: [{ name: 'contract handles the documented payload', message: 'boom' }] }), tests(good))
    expect(r.contract).toBe('failed')
    expect(withContract(report(), tests(good)).contract).toBe('passed')
  })
})

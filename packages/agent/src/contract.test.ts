import { describe, expect, it } from 'vitest'
import { contractMissing, renderFixtures, withContract, withFixtures } from './contract'
import type { ApiSpec, TestReport } from './types'

const spec: ApiSpec = {
  source: { app: 'Calendly', role: 'source', method: 'POST', url: '(webhook)', auth: { type: 'none', envVar: 'X' }, example: { event: 'invitee.created', payload: { name: 'Ada' } }, docsUrl: 'https://developer.calendly.com/webhooks', notes: [] },
  target: [
    { app: 'Slack', role: 'target', method: 'post', url: 'https://slack.com/api/chat.postMessage', auth: { type: 'bearer', envVar: 'SLACK_BOT_TOKEN' }, example: {}, responseExample: { ok: true, ts: '1.2' }, docsUrl: 'https://api.slack.com/methods/chat.postMessage', notes: [] },
  ],
}

const report = (over: Partial<TestReport> = {}): TestReport => ({ typecheckOk: true, typecheckOutput: '', passed: 3, failed: 0, total: 3, failures: [], durationMs: 1, ranOn: 'x', passedNames: ['contract handles the example'], ...over })
const tests = (content: string) => [{ path: 'src/connector.test.ts', content }]

describe('renderFixtures', () => {
  it('writes the documented example, endpoints and responses with their sources', () => {
    const file = renderFixtures(spec)
    expect(file.path).toBe('src/fixtures.ts')
    expect(file.content).toContain('// Source: https://developer.calendly.com/webhooks')
    expect(file.content).toContain('"event": "invitee.created"')
    expect(file.content).toContain('"method": "POST"')
    expect(file.content).toContain('"url": "https://slack.com/api/chat.postMessage"')
    expect(file.content).toContain('export function contractFetch()')
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

  it('fails the contract when the contract test never passed, e.g. a crashed test file', () => {
    const r = withContract(report({ passed: 0, total: 1, failed: 1, passedNames: [], failures: [{ name: 'test file', message: 'SyntaxError' }] }), tests(good))
    expect(r.contract).toBe('failed')
    expect(r.failures.at(-1)?.name).toBe('contract (did not run)')
  })

  it('marks failed contract tests', () => {
    const r = withContract(report({ failed: 1, failures: [{ name: 'contract handles the documented payload', message: 'boom' }] }), tests(good))
    expect(r.contract).toBe('failed')
    expect(withContract(report(), tests(good)).contract).toBe('passed')
  })
})

describe('rendered fixtures module', () => {
  it('compiles, matches templated URLs and answers with documented responses', async () => {
    const { mkdirSync, writeFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const { pathToFileURL } = await import('node:url')
    const templated: ApiSpec = {
      ...spec,
      target: [
        { ...spec.target[0]!, method: 'post', url: 'https://usX.api.mailchimp.com/3.0/lists/{list_id}/members/{subscriber_hash}/tags', responseExample: { ok: 1 } },
        { ...spec.target[0]!, method: 'get', url: 'https://api.example.com/v1/users/:id', responseExample: { id: 7 } },
      ],
    }
    const dir = join(process.cwd(), '.fixture-tmp', `fixtures-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    const file = join(dir, 'fixtures.ts')
    writeFileSync(file, renderFixtures(templated).content)
    const mod = (await import(pathToFileURL(file).href)) as typeof import('./fixtures-shape')

    expect(mod.findEndpoint('POST', 'https://us21.api.mailchimp.com/3.0/lists/abc123/members/9f86d08/tags')).toBeTruthy()
    expect(mod.findEndpoint('POST', 'https://us21.api.mailchimp.com/3.0/lists/abc123/members')).toBeUndefined()
    expect(mod.findEndpoint('GET', 'https://evil.com/v1/users/1')).toBeUndefined()
    expect(mod.findEndpoint('get', 'https://api.example.com/v1/users/42')).toBeTruthy()

    const { fetch, calls } = mod.contractFetch()
    const res = await fetch('https://us21.api.mailchimp.com/3.0/lists/L1/members/h1/tags', {
      method: 'POST', headers: { Authorization: 'Bearer k' }, body: JSON.stringify({ tags: [{ name: 'pro', status: 'active' }] }),
    })
    expect(await res.json()).toEqual({ ok: 1 })
    expect(calls[0]).toMatchObject({ method: 'POST', body: { tags: [{ name: 'pro', status: 'active' }] } })
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer k')
    await expect(fetch('https://api.example.com/v1/other', { method: 'GET' })).rejects.toThrow(/not a documented endpoint/)
  })
})

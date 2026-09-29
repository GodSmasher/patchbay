import { describe, expect, it } from 'vitest'
import { loadConfig } from './config'
import type { LlmClient } from './llm'
import { renderFileBlocks } from './parse'
import { REPLAY_RUN, replayRun } from './replay'
import { runAgent } from './run'
import type { SandboxRunner } from './sandbox'
import type { SearchClient } from './tavily'
import type { GeneratedFile, RunEvent, TestReport } from './types'

const meta = await import('./fixtures/typeform-pipedrive/meta.json')

const files = (tag: string): GeneratedFile[] => [
  { path: 'src/connector.ts', content: `// ${tag}\n` },
  { path: 'src/connector.test.ts', content: "import { SOURCE_EXAMPLE } from './fixtures'\ndescribe('contract', () => { it('runs', () => handle(SOURCE_EXAMPLE)) })\n" },
  { path: 'README.md', content: '# readme\n' },
]

const report = (failed: number): TestReport => ({
  typecheckOk: true, typecheckOutput: '', passed: 6 - failed, failed, total: 6,
  failures: failed ? [{ name: 'auth header', message: 'expected x-api-token' }] : [], durationMs: 10, ranOn: 'fake',
})

function fakes(testResults: number[]) {
  const prompts: string[] = []
  const models: string[] = []
  const llm: LlmClient = {
    async chat(model, messages) {
      models.push(model.id)
      const system = messages[0]?.content ?? ''
      prompts.push(messages[1]?.content ?? '')
      if (system.includes('planning step')) return JSON.stringify(meta.plan)
      if (system.includes('research step')) return JSON.stringify(meta.spec)
      return renderFileBlocks(files(`draft-${prompts.length}`))
    },
    usage: () => [{ model: 'm', promptTokens: 10, completionTokens: 5, costUsd: 0.001 }],
  }
  const search: SearchClient = {
    search: async (q) => [{ title: q, url: `https://docs.test/${encodeURIComponent(q)}`, content: 'snippet', score: 1 }],
    extract: async (urls) => urls.map((url) => ({ url, content: 'docs' })),
  }
  let run = 0
  const sandbox: SandboxRunner = {
    prepare: async (log) => { log('prepared'); return 'img' },
    runTests: async () => report(testResults[run++] ?? 0),
  }
  return { llm, search, sandbox, prompts, models }
}

async function collect(gen: AsyncGenerator<RunEvent>) {
  const events: RunEvent[] = []
  for await (const e of gen) events.push(e)
  return events
}

describe('runAgent', () => {
  it('repairs until the sandbox tests pass and uses one model per tier', async () => {
    const f = fakes([2, 0])
    const config = { ...loadConfig({}), maxAttempts: 3 }
    const events = await collect(runAgent('Typeform to Pipedrive', { config, ...f }))

    const tests = events.filter((e) => e.type === 'tests')
    expect(tests.map((e) => e.type === 'tests' && e.report.failed)).toEqual([2, 0])
    const result = events.find((e) => e.type === 'result')
    expect(result).toMatchObject({ type: 'result', ok: true, attempts: 2 })
    const lastFiles = events.filter((e) => e.type === 'files').at(-1)
    expect(lastFiles?.type === 'files' && lastFiles.files.map((f) => f.path)).toEqual([
      'src/connector.ts', 'src/connector.test.ts', 'README.md', 'src/fixtures.ts',
    ])
    expect(tests.every((e) => e.type === 'tests' && e.report.contract === 'passed')).toBe(true)
    expect(f.prompts[2]).toContain('SOURCE_EXAMPLE')
    expect(f.prompts[3]).toContain('expected x-api-token')
    expect(f.models).toEqual([config.models.fast.id, config.models.mid.id, config.models.strong.id, config.models.strong.id])
    expect(events.filter((e) => e.type === 'step' && e.status === 'done').map((e) => e.type === 'step' && e.step))
      .toEqual(['plan', 'research', 'generate', 'verify', 'package'])
  })

  it('stops after maxAttempts and reports the run as failed', async () => {
    const f = fakes([1, 1, 1, 1])
    const events = await collect(runAgent('x', { config: { ...loadConfig({}), maxAttempts: 2 }, ...f }))
    expect(events.filter((e) => e.type === 'tests')).toHaveLength(2)
    expect(events.find((e) => e.type === 'result')).toMatchObject({ ok: false, attempts: 2 })
  })

  it('emits an error event instead of throwing', async () => {
    const f = fakes([0])
    f.sandbox.prepare = async () => { throw new Error('sandbox quota exceeded') }
    const events = await collect(runAgent('x', { config: loadConfig({}), ...f }))
    expect(events.at(-1)).toEqual({ type: 'error', message: 'sandbox quota exceeded' })
    expect(events).toContainEqual({ type: 'step', step: 'verify', status: 'error', detail: 'sandbox quota exceeded' })
  })
})

describe('contract enforcement', () => {
  it('sends a draft without contract tests back for repair', async () => {
    const f = fakes([0, 0])
    let codegenCalls = 0
    const chat = f.llm.chat
    f.llm.chat = async (model, messages, options) => {
      const answer = await chat(model, messages, options)
      if (!messages[0]?.content.includes('code-generation step')) return answer
      codegenCalls++
      return codegenCalls === 1 ? answer.replace("describe('contract'", "describe('happy path'") : answer
    }
    const events = await collect(runAgent('x', { config: { ...loadConfig({}), maxAttempts: 3 }, ...f }))
    const reports = events.flatMap((e) => (e.type === 'tests' ? [e.report] : []))
    expect(reports[0]).toMatchObject({ contract: 'missing' })
    expect(reports[0]?.failures.at(-1)?.name).toBe('contract (static check)')
    expect(reports.at(-1)).toMatchObject({ contract: 'passed', failed: 0 })
  })
})

describe('replay fixture', () => {
  it('shows a failing first draft and a green repair', async () => {
    const events = await collect(replayRun(REPLAY_RUN, 0))
    expect(events[0]).toEqual({ type: 'mode', mode: 'replay' })
    const tests = events.flatMap((e) => (e.type === 'tests' ? [e.report] : []))
    expect(tests[0]?.failed).toBeGreaterThan(0)
    expect(tests.at(-1)).toMatchObject({ failed: 0, typecheckOk: true })
    expect(events.find((e) => e.type === 'result')).toMatchObject({ ok: true, attempts: 2 })
  })
})

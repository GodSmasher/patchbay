import type { AgentConfig } from './config'
import { renderFixtures, withContract, withFixtures } from './contract'
import type { LlmClient } from './llm'
import { extractJson, parseFileBlocks, renderFileBlocks } from './parse'
import {
  GENERATE_SYSTEM,
  PLAN_SYSTEM,
  SPEC_SYSTEM,
  generateUser,
  planUser,
  repairUser,
  specUser,
} from './prompts'
import { isGreen } from './report'
import type { SandboxRunner } from './sandbox'
import { isOfficial, rankOfficial } from './sources'
import type { SearchClient } from './tavily'
import type { ApiSpec, GeneratedFile, Plan, RunEvent, Source, StepId, TestReport } from './types'

export interface AgentDeps {
  config: AgentConfig
  llm: LlmClient
  search: SearchClient
  sandbox: SandboxRunner
}

const REQUIRED_FILES = ['src/connector.ts', 'src/connector.test.ts', 'README.md']

/**
 * plan (fast model) → research (Tavily + mid model) → generate (strong model)
 * → verify in a Nebius sandbox → repair with the failures, up to maxAttempts.
 */
export async function* runAgent(prompt: string, deps: AgentDeps): AsyncGenerator<RunEvent> {
  const { config, llm, search, sandbox } = deps
  const queue: RunEvent[] = []
  const log = (step: StepId) => (message: string) => queue.push({ type: 'log', step, message })
  const drain = function* () {
    while (queue.length) yield queue.shift() as RunEvent
  }

  yield { type: 'mode', mode: 'live' }
  let current: StepId = 'plan'
  try {
    yield { type: 'step', step: 'plan', status: 'start' }
    const plan = await makePlan(prompt, llm, config)
    yield { type: 'plan', plan }
    yield { type: 'step', step: 'plan', status: 'done', detail: plan.summary }

    current = 'research'
    yield { type: 'step', step: 'research', status: 'start' }
    const prepared = sandbox.prepare(log('verify')).catch((error: unknown) => error as Error)
    const { spec, sources } = await research(plan, search, llm, config, log('research'))
    yield* drain()
    yield { type: 'sources', sources }
    yield { type: 'spec', spec }
    yield { type: 'step', step: 'research', status: 'done', detail: `${spec.target.length + 1} endpoints from ${sources.length} pages` }

    current = 'generate'
    yield { type: 'step', step: 'generate', status: 'start' }
    const fixtures = renderFixtures(spec)
    let files = withFixtures(await generate(plan, spec, fixtures.content, llm, config), fixtures)
    yield { type: 'files', attempt: 1, files }
    yield { type: 'step', step: 'generate', status: 'done', detail: files.map((f) => f.path).join(', ') }

    current = 'verify'
    yield { type: 'step', step: 'verify', status: 'start' }
    const baseImage = await prepared
    yield* drain()
    if (baseImage instanceof Error) throw baseImage

    let report: TestReport | null = null
    let attempt = 1
    for (;;) {
      report = withContract(await sandbox.runTests(baseImage, files, log('verify')), files)
      yield* drain()
      yield { type: 'tests', attempt, report }
      if (isGreen(report) || attempt >= config.maxAttempts) break
      attempt++
      yield { type: 'log', step: 'verify', message: `Attempt ${attempt - 1} failed (${report.failed} tests, typecheck ${report.typecheckOk ? 'ok' : 'failed'}), repairing` }
      files = withFixtures(await repair(files, report, llm, config), fixtures)
      yield { type: 'files', attempt, files }
    }
    const ok = report !== null && isGreen(report)
    yield { type: 'step', step: 'verify', status: ok ? 'done' : 'error', detail: `${report.passed}/${report.total} tests after ${attempt} attempt${attempt > 1 ? 's' : ''}` }

    current = 'package'
    yield { type: 'step', step: 'package', status: 'start' }
    yield { type: 'usage', usage: llm.usage() }
    yield { type: 'result', ok, attempts: attempt, files, report }
    yield { type: 'step', step: 'package', status: 'done' }
  } catch (error) {
    yield* drain()
    yield { type: 'step', step: current, status: 'error', detail: messageOf(error) }
    yield { type: 'usage', usage: llm.usage() }
    yield { type: 'error', message: messageOf(error) }
  }
}

async function makePlan(prompt: string, llm: LlmClient, config: AgentConfig): Promise<Plan> {
  const answer = await llm.chat(config.models.fast, [
    { role: 'system', content: PLAN_SYSTEM },
    { role: 'user', content: planUser(prompt) },
  ], { thinking: false, maxTokens: 2000 })
  const plan = extractJson<Plan>(answer)
  if (!plan.source?.app || !plan.target?.app) throw new Error('Could not identify a source and a target app in the request')
  plan.fieldMapping ??= []
  plan.assumptions ??= []
  return plan
}

async function research(
  plan: Plan,
  search: SearchClient,
  llm: LlmClient,
  config: AgentConfig,
  log: (m: string) => void,
): Promise<{ spec: ApiSpec; sources: Source[] }> {
  const sides = [plan.source, plan.target]
  const hits = (await Promise.all(sides.map((side) => search.search(side.docsQuery, { maxResults: 8 })))).map((list, i) => {
    const side = sides[i]!
    const ranked = rankOfficial(list, side.app).slice(0, 2)
    const official = ranked.filter((h) => isOfficial(h.url, side.app)).length
    log(`Searched "${side.docsQuery}": ${list.length} results, ${official} of 2 picked from ${side.app}'s own docs`)
    return ranked.map((h) => ({ ...h, app: side.app }))
  })
  const picked = hits.flat()
  const urls = [...new Set(picked.map((h) => h.url))]
  const pages = await search.extract(urls)
  log(`Extracted ${pages.length} documentation pages`)
  const docs = pages.length ? pages : picked.map((h) => ({ url: h.url, content: h.content }))

  const answer = await llm.chat(config.models.mid, [
    { role: 'system', content: SPEC_SYSTEM },
    { role: 'user', content: specUser(plan, docs) },
  ], { thinking: false, maxTokens: 6000 })
  const spec = extractJson<ApiSpec>(answer)
  if (!spec.source || !Array.isArray(spec.target) || spec.target.length === 0) {
    throw new Error('Research did not produce a usable API spec')
  }
  return { spec, sources: picked.map((h) => ({ title: h.title, url: h.url, official: isOfficial(h.url, h.app) })) }
}

async function generate(plan: Plan, spec: ApiSpec, fixtures: string, llm: LlmClient, config: AgentConfig): Promise<GeneratedFile[]> {
  const answer = await llm.chat(config.models.strong, [
    { role: 'system', content: GENERATE_SYSTEM },
    { role: 'user', content: generateUser(plan, spec, fixtures) },
  ], { maxTokens: 32_000, temperature: 0.1 })
  return requireFiles(parseFileBlocks(answer))
}

async function repair(files: GeneratedFile[], report: TestReport, llm: LlmClient, config: AgentConfig): Promise<GeneratedFile[]> {
  const answer = await llm.chat(config.models.strong, [
    { role: 'system', content: GENERATE_SYSTEM },
    { role: 'user', content: repairUser(renderFileBlocks(files), report) },
  ], { maxTokens: 32_000, temperature: 0.1 })
  const repaired = parseFileBlocks(answer)
  const merged = new Map(files.map((f) => [f.path, f]))
  for (const file of repaired) merged.set(file.path, file)
  return requireFiles([...merged.values()])
}

function requireFiles(files: GeneratedFile[]): GeneratedFile[] {
  const missing = REQUIRED_FILES.filter((path) => !files.some((f) => f.path === path))
  if (missing.length) throw new Error(`Model output is missing ${missing.join(', ')}`)
  return REQUIRED_FILES.map((path) => files.find((f) => f.path === path) as GeneratedFile)
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

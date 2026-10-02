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
    let skipInitialTest = false
    for (;;) {
      if (!skipInitialTest) {
        report = withContract(await sandbox.runTests(baseImage, files, log('verify')), files)
        yield* drain()
        yield { type: 'tests', attempt, report: report! }
      }
      skipInitialTest = false
      if (isGreen(report!) || attempt >= config.maxAttempts) break
      attempt++
      yield { type: 'log', step: 'verify', message: `Attempt ${attempt - 1} failed (${report!.failed} tests, typecheck ${report!.typecheckOk ? 'ok' : 'failed'}), repairing` }
      if (config.parallelRepairs > 1) {
        const r = await repairParallel(files, report!, {
          llm, sandbox, config, baseImage,
          withFixtures: (next) => withFixtures(next, fixtures),
        }, log('verify'))
        yield* drain()
        files = r.files
        report = r.report
        yield { type: 'files', attempt, files }
        yield { type: 'tests', attempt, report, branches: r.branches }
        skipInitialTest = true
      } else {
        files = withFixtures(await repair(files, report!, llm, config), fixtures)
        yield { type: 'files', attempt, files }
      }
    }
    const ok = report !== null && isGreen(report)
    yield { type: 'step', step: 'verify', status: ok ? 'done' : 'error', detail: `${report!.passed}/${report!.total} tests after ${attempt} attempt${attempt > 1 ? 's' : ''}` }

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

/** plan → research only, ends with the spec. No code generation, no sandbox. */
export async function* researchAgent(prompt: string, deps: Omit<AgentDeps, 'sandbox'>): AsyncGenerator<RunEvent> {
  const { config, llm, search } = deps
  yield { type: 'mode', mode: 'live' }
  let current: StepId = 'plan'
  try {
    yield { type: 'step', step: 'plan', status: 'start' }
    const plan = await makePlan(prompt, llm, config)
    yield { type: 'plan', plan }
    yield { type: 'step', step: 'plan', status: 'done', detail: plan.summary }

    current = 'research'
    yield { type: 'step', step: 'research', status: 'start' }
    const queue: RunEvent[] = []
    const { spec, sources } = await research(plan, search, llm, config, (m) =>
      queue.push({ type: 'log', step: 'research', message: m }),
    )
    while (queue.length) yield queue.shift() as RunEvent
    yield { type: 'sources', sources }
    yield { type: 'spec', spec }
    yield { type: 'step', step: 'research', status: 'done', detail: `${spec.target.length + 1} endpoints from ${sources.length} pages` }
    yield { type: 'usage', usage: llm.usage() }
  } catch (error) {
    yield { type: 'step', step: current, status: 'error', detail: messageOf(error) }
    yield { type: 'usage', usage: llm.usage() }
    yield { type: 'error', message: messageOf(error) }
  }
}

/** verify + repair loop for already-generated files. Uses sandbox + strong model. */
export async function* verifyAgent(
  files: GeneratedFile[],
  deps: Omit<AgentDeps, 'search'>,
): AsyncGenerator<RunEvent> {
  const { config, llm, sandbox } = deps
  yield { type: 'mode', mode: 'live' }
  const queue: RunEvent[] = []
  const log = (message: string) => queue.push({ type: 'log', step: 'verify', message })
  const drain = function* () {
    while (queue.length) yield queue.shift() as RunEvent
  }

  try {
    yield { type: 'step', step: 'verify', status: 'start' }
    const baseImage = await sandbox.prepare(log)
    yield* drain()

    let current = files
    let report: TestReport | null = null
    let attempt = 1
    let skipInitialTest = false
    for (;;) {
      if (!skipInitialTest) {
        report = await sandbox.runTests(baseImage, current, log)
        yield* drain()
        yield { type: 'tests', attempt, report: report! }
      }
      skipInitialTest = false
      if (isGreen(report!) || attempt >= config.maxAttempts) break
      attempt++
      yield { type: 'log', step: 'verify', message: `Attempt ${attempt - 1} failed (${report!.failed} tests, typecheck ${report!.typecheckOk ? 'ok' : 'failed'}), repairing` }
      if (config.parallelRepairs > 1) {
        const r = await repairParallel(current, report!, {
          llm, sandbox, config, baseImage,
          withFixtures: (next) => next,
        }, log)
        yield* drain()
        current = r.files
        report = r.report
        yield { type: 'files', attempt, files: current }
        yield { type: 'tests', attempt, report, branches: r.branches }
        skipInitialTest = true
      } else {
        current = await repair(current, report!, llm, config)
        yield { type: 'files', attempt, files: current }
      }
    }
    const ok = report !== null && isGreen(report)
    yield { type: 'step', step: 'verify', status: ok ? 'done' : 'error', detail: `${report!.passed}/${report!.total} tests after ${attempt} attempt${attempt > 1 ? 's' : ''}` }
    yield { type: 'usage', usage: llm.usage() }
    yield { type: 'result', ok, attempts: attempt, files: current, report }
  } catch (error) {
    yield* drain()
    yield { type: 'step', step: 'verify', status: 'error', detail: messageOf(error) }
    yield { type: 'usage', usage: llm.usage() }
    yield { type: 'error', message: messageOf(error) }
  }
}

export async function makePlan(prompt: string, llm: LlmClient, config: AgentConfig): Promise<Plan> {
  const answer = await llm.chat(config.models.fast, [
    { role: 'system', content: PLAN_SYSTEM },
    { role: 'user', content: planUser(prompt) },
  ], { thinking: false, maxTokens: 2000 })
  const plan = await parseJsonOrAsk<Plan>(answer, llm, config.models.fast, PLAN_SYSTEM)
  if (!plan.source?.app || !plan.target?.app) throw new Error('Could not identify a source and a target app in the request')
  plan.fieldMapping ??= []
  plan.assumptions ??= []
  return plan
}

export async function research(
  plan: Plan,
  search: SearchClient,
  llm: LlmClient,
  config: AgentConfig,
  log: (m: string) => void,
): Promise<{ spec: ApiSpec; sources: Source[] }> {
  const sides = [plan.source, plan.target]
  const hits = await Promise.all(
    sides.map(async (side) => {
      let list = await search.search(side.docsQuery, { maxResults: 8 })
      if (!list.some((h) => isOfficial(h.url, side.app))) {
        const domain = guessDomain(side.app)
        const focused = await search.search(side.docsQuery, { maxResults: 5, includeDomains: [domain] })
        log(`No ${side.app} page in the results, searched ${domain} directly: ${focused.length} results`)
        list = [...focused, ...list]
      }
      const ranked = rankOfficial(list, side.app).slice(0, 2)
      const official = ranked.filter((h) => isOfficial(h.url, side.app)).length
      log(`Searched "${side.docsQuery}": ${official} of 2 picked from ${side.app}'s own docs`)
      return ranked.map((h) => ({ ...h, app: side.app }))
    }),
  )
  const picked = hits.flat()
  const urls = [...new Set(picked.map((h) => h.url))]
  const pages = await search.extract(urls)
  log(`Extracted ${pages.length} documentation pages`)
  const docs = pages.length ? pages : picked.map((h) => ({ url: h.url, content: h.content }))

  const answer = await llm.chat(config.models.mid, [
    { role: 'system', content: SPEC_SYSTEM },
    { role: 'user', content: specUser(plan, docs) },
  ], { thinking: false, maxTokens: 6000 })
  const spec = await parseJsonOrAsk<ApiSpec>(answer, llm, config.models.mid, SPEC_SYSTEM)
  if (!spec.source || !Array.isArray(spec.target) || spec.target.length === 0) {
    throw new Error('Research did not produce a usable API spec')
  }
  return { spec, sources: picked.map((h) => ({ title: h.title, url: h.url, official: isOfficial(h.url, h.app) })) }
}

export async function generate(plan: Plan, spec: ApiSpec, fixtures: string, llm: LlmClient, config: AgentConfig): Promise<GeneratedFile[]> {
  const answer = await llm.chat(config.models.strong, [
    { role: 'system', content: GENERATE_SYSTEM },
    { role: 'user', content: generateUser(plan, spec, fixtures) },
  ], { maxTokens: 32_000, temperature: 0.1 })
  return requireFiles(parseFileBlocks(answer))
}

export async function repair(
  files: GeneratedFile[],
  report: TestReport,
  llm: LlmClient,
  config: AgentConfig,
  options: { temperature?: number } = {},
): Promise<GeneratedFile[]> {
  const answer = await llm.chat(config.models.strong, [
    { role: 'system', content: GENERATE_SYSTEM },
    { role: 'user', content: repairUser(renderFileBlocks(files), report) },
  ], { maxTokens: 32_000, temperature: options.temperature ?? 0.1 })
  const repaired = parseFileBlocks(answer)
  const merged = new Map(files.map((f) => [f.path, f]))
  for (const file of repaired) merged.set(file.path, file)
  return requireFiles([...merged.values()])
}

/** Varied temperatures so N parallel repair calls diverge instead of returning near-identical output. */
const REPAIR_TEMPERATURES = [0.1, 0.4, 0.7, 0.9]

/**
 * Generates up to N repair variants in parallel (different temperatures), verifies all of them
 * in parallel sandbox forks of the same checkpoint, and picks the first green one (or the one
 * with the most passed tests when none is green).
 */
export async function repairParallel(
  files: GeneratedFile[],
  report: TestReport,
  deps: {
    llm: LlmClient
    sandbox: SandboxRunner
    config: AgentConfig
    baseImage: string
    withFixtures: (files: GeneratedFile[]) => GeneratedFile[]
  },
  log: (m: string) => void,
): Promise<{ files: GeneratedFile[]; report: TestReport; branches: Array<{ branch: number; passed: number; total: number; typecheckOk: boolean; green: boolean }> }> {
  const n = Math.max(1, Math.min(REPAIR_TEMPERATURES.length, deps.config.parallelRepairs))
  const temperatures = REPAIR_TEMPERATURES.slice(0, n)
  log(`Repairing with ${n} parallel branch${n > 1 ? 'es' : ''} (temperatures ${temperatures.join(', ')})`)

  const candidates = await Promise.all(
    temperatures.map(async (temperature, i) => {
      const generated = await repair(files, report, deps.llm, deps.config, { temperature })
      return { branch: i + 1, files: deps.withFixtures(generated) }
    }),
  )

  const results = await Promise.all(
    candidates.map(async (c) => {
      const branchReport = withContract(
        await deps.sandbox.runTests(deps.baseImage, c.files, (m) => log(`[branch ${c.branch}] ${m}`)),
        c.files,
      )
      return { ...c, report: branchReport }
    }),
  )

  for (const r of results) {
    log(
      `branch ${r.branch}: ${r.report.passed}/${r.report.total}, typecheck ${r.report.typecheckOk ? 'ok' : 'failed'}, contract ${r.report.contract}`,
    )
  }

  const green = results.find((r) => isGreen(r.report))
  const winner = green ?? results.reduce((best, r) => (r.report.passed > best.report.passed ? r : best))
  log(`Chose branch ${winner.branch}${green ? ' (first green)' : ' (most tests passed)'}`)

  return {
    files: winner.files,
    report: winner.report,
    branches: results.map((r) => ({
      branch: r.branch,
      passed: r.report.passed,
      total: r.report.total,
      typecheckOk: r.report.typecheckOk,
      green: isGreen(r.report),
    })),
  }
}

function requireFiles(files: GeneratedFile[]): GeneratedFile[] {
  const missing = REQUIRED_FILES.filter((path) => !files.some((f) => f.path === path))
  if (missing.length) throw new Error(`Model output is missing ${missing.join(', ')}`)
  return REQUIRED_FILES.map((path) => files.find((f) => f.path === path) as GeneratedFile)
}

/** One retry for structured steps: invalid JSON goes back to the same model once to be fixed. */
async function parseJsonOrAsk<T>(answer: string, llm: LlmClient, model: AgentConfig['models']['fast'], system: string): Promise<T> {
  try {
    return extractJson<T>(answer)
  } catch (error) {
    const fixed = await llm.chat(model, [
      { role: 'system', content: system },
      { role: 'user', content: `This answer is not valid JSON (${messageOf(error)}). Return the same content as strict JSON: double quotes, no comments, no trailing commas.\n\n${answer.slice(0, 12_000)}` },
    ], { thinking: false, maxTokens: 6000 })
    return extractJson<T>(fixed)
  }
}

function guessDomain(app: string): string {
  return `${app.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

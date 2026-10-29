import { loadConfig, missingLiveKeys, type AgentConfig } from './config'
import { createNebiusClient } from './llm'
import { createLocalRunner } from './local-runner'
import { replayRun } from './replay'
import { researchAgent, runAgent, verifyAgent } from './run'
import { createNebiusSandbox } from './sandbox'
import { createTavilyClient } from './tavily'
import type { GeneratedFile, RunEvent } from './types'

function buildLlm(config: AgentConfig) {
  const modelOverrides: Record<string, { baseUrl: string; apiKey: string; supportsNemotronThinking?: boolean; contextWindow?: number }> = {}
  if (config.strongOverride) {
    modelOverrides[config.models.strong.id] = {
      baseUrl: config.strongOverride.baseUrl,
      apiKey: config.strongOverride.apiKey,
      supportsNemotronThinking: config.strongOverride.provider === 'nebius',
      // Fine-tune vLLM endpoints we deploy use --max-model-len 32768.
      contextWindow: 32768,
    }
  }
  if (config.repairOverride) {
    modelOverrides[config.models.repair.id] = {
      baseUrl: config.repairOverride.baseUrl,
      apiKey: config.repairOverride.apiKey,
      supportsNemotronThinking: config.repairOverride.provider === 'nebius',
      contextWindow: 32768,
    }
  }
  return createNebiusClient({
    apiKey: config.nebiusApiKey,
    baseUrl: config.nebiusBaseUrl,
    supportsNemotronThinking: config.llmProvider === 'nebius',
    modelOverrides: Object.keys(modelOverrides).length ? modelOverrides : undefined,
  })
}

export * from './types'
export { loadConfig, missingLiveKeys } from './config'
export { REPLAY_RUN, replayRun, type RecordedRun } from './replay'
export { runAgent, researchAgent, verifyAgent, makePlan, research, generate, repair, repairParallel, type AgentDeps } from './run'
export { isGreen, parseTestOutput, parsePytestOutput } from './report'
export { renderFixtures, renderFixturesPy, renderFixturesFor, contractMissing, contractMissingPy, contractMissingFor, withContract, withContractFor, withFixtures, FIXTURES_PATH, FIXTURES_PATH_PY } from './contract'
export { scanRepo, scanFiles, formatReport, type Opportunity, type ScanInputFile } from './scanner'

/** Live run when keys are configured and mock mode is off, otherwise the recorded replay. */
export function startRun(prompt: string, config: AgentConfig = loadConfig()): AsyncGenerator<RunEvent> {
  if (config.mock || missingLiveKeys(config).length > 0) return replayRun()
  return runAgent(prompt, {
    config,
    llm: buildLlm(config),
    search: createTavilyClient({ apiKey: config.tavilyApiKey }),
    sandbox:
      config.runner === 'local'
        ? createLocalRunner()
        : createNebiusSandbox({
            apiKey: config.nebiusApiKey,
            project: config.nebiusProject,
            baseUrl: config.sandboxUrl,
            preparedImage: config.baseImage,
            lang: config.lang,
          }),
  })
}

/** Plan + research only. Live if keys are set; the replay stream truncated after `spec` otherwise. */
export function startResearch(prompt: string, config: AgentConfig = loadConfig()): AsyncGenerator<RunEvent> {
  if (config.mock || missingLiveKeys(config).length > 0) return truncateAt(replayRun(), 'spec')
  return researchAgent(prompt, {
    config,
    llm: buildLlm(config),
    search: createTavilyClient({ apiKey: config.tavilyApiKey }),
  })
}

/** Verify + repair for given files. Requires live keys; throws in mock mode. */
export function startVerify(files: GeneratedFile[], config: AgentConfig = loadConfig()): AsyncGenerator<RunEvent> {
  if (config.mock || missingLiveKeys(config).length > 0) {
    throw new Error('Verify needs live keys (NEBIUS_API_KEY, NEBIUS_AI_PROJECT). Set PATCHBAY_MOCK=false and provide credentials.')
  }
  return verifyAgent(files, {
    config,
    llm: buildLlm(config),
    sandbox:
      config.runner === 'local'
        ? createLocalRunner()
        : createNebiusSandbox({
            apiKey: config.nebiusApiKey,
            project: config.nebiusProject,
            baseUrl: config.sandboxUrl,
            preparedImage: config.baseImage,
            lang: config.lang,
          }),
  })
}

async function* truncateAt(stream: AsyncGenerator<RunEvent>, lastType: RunEvent['type']): AsyncGenerator<RunEvent> {
  for await (const event of stream) {
    yield event
    if (event.type === lastType) return
  }
}

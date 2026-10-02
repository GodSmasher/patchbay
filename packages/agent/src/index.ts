import { loadConfig, missingLiveKeys, type AgentConfig } from './config'
import { createNebiusClient } from './llm'
import { createLocalRunner } from './local-runner'
import { replayRun } from './replay'
import { researchAgent, runAgent, verifyAgent } from './run'
import { createNebiusSandbox } from './sandbox'
import { createTavilyClient } from './tavily'
import type { GeneratedFile, RunEvent } from './types'

export * from './types'
export { loadConfig, missingLiveKeys } from './config'
export { REPLAY_RUN, replayRun, type RecordedRun } from './replay'
export { runAgent, researchAgent, verifyAgent, makePlan, research, generate, repair, repairParallel, type AgentDeps } from './run'
export { isGreen, parseTestOutput } from './report'

/** Live run when keys are configured and mock mode is off, otherwise the recorded replay. */
export function startRun(prompt: string, config: AgentConfig = loadConfig()): AsyncGenerator<RunEvent> {
  if (config.mock || missingLiveKeys(config).length > 0) return replayRun()
  return runAgent(prompt, {
    config,
    llm: createNebiusClient({ apiKey: config.nebiusApiKey, baseUrl: config.nebiusBaseUrl }),
    search: createTavilyClient({ apiKey: config.tavilyApiKey }),
    sandbox:
      config.runner === 'local'
        ? createLocalRunner()
        : createNebiusSandbox({
            apiKey: config.nebiusApiKey,
            project: config.nebiusProject,
            baseUrl: config.sandboxUrl,
            preparedImage: config.baseImage,
          }),
  })
}

/** Plan + research only. Live if keys are set; the replay stream truncated after `spec` otherwise. */
export function startResearch(prompt: string, config: AgentConfig = loadConfig()): AsyncGenerator<RunEvent> {
  if (config.mock || missingLiveKeys(config).length > 0) return truncateAt(replayRun(), 'spec')
  return researchAgent(prompt, {
    config,
    llm: createNebiusClient({ apiKey: config.nebiusApiKey, baseUrl: config.nebiusBaseUrl }),
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
    llm: createNebiusClient({ apiKey: config.nebiusApiKey, baseUrl: config.nebiusBaseUrl }),
    sandbox:
      config.runner === 'local'
        ? createLocalRunner()
        : createNebiusSandbox({
            apiKey: config.nebiusApiKey,
            project: config.nebiusProject,
            baseUrl: config.sandboxUrl,
            preparedImage: config.baseImage,
          }),
  })
}

async function* truncateAt(stream: AsyncGenerator<RunEvent>, lastType: RunEvent['type']): AsyncGenerator<RunEvent> {
  for await (const event of stream) {
    yield event
    if (event.type === lastType) return
  }
}

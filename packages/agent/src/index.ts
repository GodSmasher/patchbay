import { loadConfig, missingLiveKeys, type AgentConfig } from './config'
import { createNebiusClient } from './llm'
import { replayRun } from './replay'
import { runAgent } from './run'
import { createNebiusSandbox } from './sandbox'
import { createTavilyClient } from './tavily'
import type { RunEvent } from './types'

export * from './types'
export { loadConfig, missingLiveKeys } from './config'
export { REPLAY_RUN, replayRun, type RecordedRun } from './replay'
export { runAgent, type AgentDeps } from './run'
export { isGreen, parseTestOutput } from './report'

/** Live run when keys are configured and mock mode is off, otherwise the recorded replay. */
export function startRun(prompt: string, config: AgentConfig = loadConfig()): AsyncGenerator<RunEvent> {
  if (config.mock || missingLiveKeys(config).length > 0) return replayRun()
  return runAgent(prompt, {
    config,
    llm: createNebiusClient({ apiKey: config.nebiusApiKey, baseUrl: config.nebiusBaseUrl }),
    search: createTavilyClient({ apiKey: config.tavilyApiKey }),
    sandbox: createNebiusSandbox({
      apiKey: config.nebiusApiKey,
      project: config.nebiusProject,
      baseUrl: config.sandboxUrl,
      preparedImage: config.baseImage,
    }),
  })
}

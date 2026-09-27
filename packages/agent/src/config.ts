export interface ModelTier {
  id: string
  /** USD per million tokens, used for the cost readout. */
  inputPrice: number
  outputPrice: number
}

export interface AgentConfig {
  mock: boolean
  nebiusApiKey: string
  nebiusProject: string
  nebiusBaseUrl: string
  sandboxUrl: string
  tavilyApiKey: string
  baseImage: string | undefined
  maxAttempts: number
  models: { fast: ModelTier; mid: ModelTier; strong: ModelTier }
}

type Env = Record<string, string | undefined>

export function loadConfig(env: Env = process.env): AgentConfig {
  return {
    mock: env.PATCHBAY_MOCK !== 'false',
    nebiusApiKey: env.NEBIUS_API_KEY ?? '',
    nebiusProject: env.NEBIUS_AI_PROJECT ?? '',
    nebiusBaseUrl: env.NEBIUS_BASE_URL || 'https://api.tokenfactory.nebius.com/v1',
    sandboxUrl: env.NEBIUS_SANDBOX_URL || 'https://api.tokenfactory.nebius.com/sandboxes/v1',
    tavilyApiKey: env.TAVILY_API_KEY ?? '',
    baseImage: env.PATCHBAY_BASE_IMAGE || undefined,
    maxAttempts: Number(env.PATCHBAY_MAX_ATTEMPTS || 3),
    models: {
      fast: { id: env.PATCHBAY_MODEL_FAST || 'nvidia/Nemotron-3_5-Lightning', inputPrice: 0.06, outputPrice: 0.24 },
      mid: { id: env.PATCHBAY_MODEL_MID || 'nvidia/nemotron-3-super-120b-a12b', inputPrice: 0.3, outputPrice: 0.9 },
      strong: { id: env.PATCHBAY_MODEL_STRONG || 'nvidia/Nemotron-3-Ultra-550b-a55b', inputPrice: 1, outputPrice: 3 },
    },
  }
}

export function missingLiveKeys(config: AgentConfig): string[] {
  const missing: string[] = []
  if (!config.nebiusApiKey) missing.push('NEBIUS_API_KEY')
  if (!config.nebiusProject) missing.push('NEBIUS_AI_PROJECT')
  if (!config.tavilyApiKey) missing.push('TAVILY_API_KEY')
  return missing
}

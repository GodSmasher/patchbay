export interface ModelTier {
  id: string
  /** USD per million tokens, used for the cost readout. */
  inputPrice: number
  outputPrice: number
}

import type { Lang } from './types'

export interface AgentConfig {
  mock: boolean
  /** Target language of the generated connector. Default `ts`; `py` writes Python with pytest. */
  lang: Lang
  /** `nebius` (isolated sandbox, default) or `local` (dev fallback, not isolated). */
  runner: 'nebius' | 'local'
  nebiusApiKey: string
  nebiusProject: string
  nebiusBaseUrl: string
  sandboxUrl: string
  tavilyApiKey: string
  baseImage: string | undefined
  maxAttempts: number
  /** How many repair variants to try in parallel per attempt. 1 = classic sequential repair. */
  parallelRepairs: number
  /**
   * LLM provider identity, chosen by setting PATCHBAY_LLM_PROVIDER. Default `nebius` keeps
   * the Nemotron-specific `chat_template_kwargs: { enable_thinking: false }` field in requests;
   * `openai` / `generic` strip it so any other OpenAI-compatible endpoint (OpenAI, Groq,
   * Together, Fireworks, OpenRouter, self-hosted vLLM) stops rejecting it.
   */
  llmProvider: 'nebius' | 'openai' | 'generic'
  /**
   * `repair` is the model used for the repair/retry step. It defaults to the same model as
   * `strong` (so single-model deployments keep working), but can be overridden independently
   * when the fine-tune was trained on red→green repair pairs — then `strong` stays as
   * Nemotron Ultra for the fresh-generation step, and `repair` points at the fine-tune.
   */
  models: { fast: ModelTier; mid: ModelTier; strong: ModelTier; repair: ModelTier }
  /** Per-tier endpoint override for `strong` (when strong lives on a dedicated endpoint). */
  strongOverride: { baseUrl: string; apiKey: string; provider: 'nebius' | 'openai' | 'generic' } | null
  /** Per-tier endpoint override for `repair`. Same shape; usually points at the fine-tune. */
  repairOverride: { baseUrl: string; apiKey: string; provider: 'nebius' | 'openai' | 'generic' } | null
}

type Env = Record<string, string | undefined>

export function loadConfig(env: Env = process.env): AgentConfig {
  const provider = parseProvider(env.PATCHBAY_LLM_PROVIDER)
  // When pointing at OpenAI (or any other provider) directly, reuse the Nebius env vars so
  // existing deployments don't have to re-wire everything — just override LLM_BASE_URL / etc.
  const apiKey = env.PATCHBAY_LLM_API_KEY || env.NEBIUS_API_KEY || env.OPENAI_API_KEY || ''
  const baseUrl =
    env.PATCHBAY_LLM_BASE_URL ||
    env.NEBIUS_BASE_URL ||
    (provider === 'openai' ? 'https://api.openai.com/v1' : 'https://api.tokenfactory.nebius.com/v1')
  const defaultModels =
    provider === 'openai'
      ? { fast: 'gpt-4o-mini', mid: 'gpt-4o-mini', strong: 'gpt-4o' }
      : { fast: 'nvidia/Nemotron-3_5-Lightning', mid: 'nvidia/nemotron-3-super-120b-a12b', strong: 'nvidia/Nemotron-3-Ultra-550b-a55b' }
  return {
    mock: env.PATCHBAY_MOCK !== 'false',
    lang: parseLang(env.PATCHBAY_LANG),
    runner: env.PATCHBAY_RUNNER === 'local' ? 'local' : 'nebius',
    nebiusApiKey: apiKey,
    nebiusProject: env.NEBIUS_AI_PROJECT ?? '',
    nebiusBaseUrl: baseUrl,
    sandboxUrl: env.NEBIUS_SANDBOX_URL || 'https://api.tokenfactory.nebius.com/sandboxes/v1',
    tavilyApiKey: env.TAVILY_API_KEY ?? '',
    baseImage: env.PATCHBAY_BASE_IMAGE || undefined,
    maxAttempts: Number(env.PATCHBAY_MAX_ATTEMPTS || 4),
    parallelRepairs: clamp(Number(env.PATCHBAY_PARALLEL_REPAIRS || 2), 1, 4),
    llmProvider: provider,
    models: {
      fast: { id: env.PATCHBAY_MODEL_FAST || defaultModels.fast, inputPrice: 0.06, outputPrice: 0.24 },
      mid: { id: env.PATCHBAY_MODEL_MID || defaultModels.mid, inputPrice: 0.3, outputPrice: 0.9 },
      strong: { id: env.PATCHBAY_MODEL_STRONG || defaultModels.strong, inputPrice: 1, outputPrice: 3 },
      repair: { id: env.PATCHBAY_MODEL_REPAIR || env.PATCHBAY_MODEL_STRONG || defaultModels.strong, inputPrice: 1, outputPrice: 3 },
    },
    strongOverride: env.PATCHBAY_STRONG_LLM_BASE_URL
      ? {
          baseUrl: env.PATCHBAY_STRONG_LLM_BASE_URL,
          apiKey: env.PATCHBAY_STRONG_LLM_API_KEY || apiKey,
          provider: parseProvider(env.PATCHBAY_STRONG_LLM_PROVIDER),
        }
      : null,
    repairOverride: env.PATCHBAY_REPAIR_LLM_BASE_URL
      ? {
          baseUrl: env.PATCHBAY_REPAIR_LLM_BASE_URL,
          apiKey: env.PATCHBAY_REPAIR_LLM_API_KEY || apiKey,
          provider: parseProvider(env.PATCHBAY_REPAIR_LLM_PROVIDER),
        }
      : null,
  }
}

function parseProvider(raw: string | undefined): AgentConfig['llmProvider'] {
  if (raw === 'openai' || raw === 'generic') return raw
  return 'nebius'
}

function parseLang(raw: string | undefined): Lang {
  const normalized = (raw ?? '').toLowerCase().trim()
  if (normalized === 'py' || normalized === 'python') return 'py'
  return 'ts'
}

function clamp(n: number, min: number, max: number): number {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : min
}

export function missingLiveKeys(config: AgentConfig): string[] {
  const missing: string[] = []
  if (!config.nebiusApiKey) missing.push('NEBIUS_API_KEY')
  if (config.runner === 'nebius' && !config.nebiusProject) missing.push('NEBIUS_AI_PROJECT')
  if (!config.tavilyApiKey) missing.push('TAVILY_API_KEY')
  return missing
}

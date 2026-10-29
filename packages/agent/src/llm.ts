import type { ModelTier } from './config'
import { stripReasoning } from './parse'
import type { Usage } from './types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  temperature?: number
  /** Includes reasoning tokens when thinking is on, so leave generous headroom. */
  maxTokens?: number
  /**
   * Nemotron reasons before answering by default. Structured steps (plan, spec) turn it off:
   * the answer is immediate and the token budget goes to the JSON, not to deliberation.
   */
  thinking?: boolean
}

export interface LlmClient {
  chat(model: ModelTier, messages: ChatMessage[], options?: ChatOptions): Promise<string>
  usage(): Usage[]
}

interface NebiusChatResponse {
  choices?: { message?: { content?: string | null; reasoning_content?: string | null } }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
  error?: { message?: string }
}

/**
 * OpenAI-compatible chat client. Default endpoint is Nebius Token Factory, but any
 * OpenAI-compatible base URL works (OpenAI itself, Groq, Together, Fireworks, OpenRouter,
 * a self-hosted vLLM, …). `supportsNemotronThinking` controls whether the Nemotron-specific
 * `chat_template_kwargs: { enable_thinking: false }` flag is sent for structured steps —
 * leave it on for Nebius, off for everything else (OpenAI rejects unknown fields).
 */
export function createNebiusClient(opts: {
  apiKey: string
  baseUrl: string
  fetch?: typeof fetch
  retries?: number
  supportsNemotronThinking?: boolean
  /**
   * Per-model overrides. Lets a specific model id (typically the "strong" tier when it's
   * been fine-tuned and self-hosted on a dedicated endpoint) use a different baseUrl /
   * apiKey / nemotron flag than the default. Lookup is by model id, no match → defaults.
   */
  modelOverrides?: Record<string, { baseUrl: string; apiKey: string; supportsNemotronThinking?: boolean; contextWindow?: number }>
}): LlmClient {
  const doFetch = opts.fetch ?? fetch
  const retries = opts.retries ?? 2
  const nemotron = opts.supportsNemotronThinking ?? true
  const overrides = opts.modelOverrides ?? {}
  const ledger = new Map<string, Usage>()

  function approxTokens(messages: ChatMessage[]): number {
    // Rough char/4 heuristic — enough to decide whether to clip max_tokens below the context window.
    let chars = 0
    for (const m of messages) chars += m.content.length + m.role.length + 8
    return Math.ceil(chars / 4)
  }

  async function chat(model: ModelTier, messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const override = overrides[model.id]
    const baseUrl = override?.baseUrl ?? opts.baseUrl
    const apiKey = override?.apiKey ?? opts.apiKey
    const nemotronForCall = override ? (override.supportsNemotronThinking ?? false) : nemotron
    const contextWindow = override?.contextWindow
    let maxTokens = options.maxTokens ?? 4096
    if (contextWindow) {
      // vLLM strictly enforces input_tokens + max_tokens <= context_window. The char/4
      // approximation under-counts (BPE splits tend to be denser) and chat-template
      // overhead eats more tokens on top, so pad with 20% + 2048 absolute headroom.
      const promptTokens = Math.ceil(approxTokens(messages) * 1.2) + 2048
      const budget = contextWindow - promptTokens
      if (budget > 0 && budget < maxTokens) maxTokens = budget
    }
    const body = {
      model: model.id,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: maxTokens,
      ...(nemotronForCall && options.thinking === false ? { chat_template_kwargs: { enable_thinking: false } } : {}),
    }

    let lastError: unknown
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await doFetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = (await res.json().catch(() => ({}))) as NebiusChatResponse
        if (!res.ok) {
          const message = data.error?.message ?? `HTTP ${res.status}`
          if (res.status === 429 || res.status >= 500) throw new RetryableError(message)
          throw new Error(`Nebius ${model.id}: ${message}`)
        }
        record(model, data.usage)
        const content = data.choices?.[0]?.message?.content ?? ''
        return stripReasoning(content)
      } catch (error) {
        lastError = error
        if (!(error instanceof RetryableError) && !isTransientFetchError(error)) break
        if (attempt === retries) break
        await sleep(800 * 2 ** attempt)
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }

  function record(model: ModelTier, usage: NebiusChatResponse['usage']) {
    const current = ledger.get(model.id) ?? { model: model.id, promptTokens: 0, completionTokens: 0, costUsd: 0 }
    current.promptTokens += usage?.prompt_tokens ?? 0
    current.completionTokens += usage?.completion_tokens ?? 0
    current.costUsd =
      (current.promptTokens / 1e6) * model.inputPrice + (current.completionTokens / 1e6) * model.outputPrice
    ledger.set(model.id, current)
  }

  return { chat, usage: () => [...ledger.values()] }
}

class RetryableError extends Error {}

/**
 * Undici (Node's built-in fetch) throws TypeError('fetch failed') with a transient
 * network cause on Vercel serverless more often than you'd like — stale keep-alive
 * sockets, upstream TCP resets, DNS flakes. Treat those as retryable so a single
 * dropped socket doesn't kill the whole run.
 */
function isTransientFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const cause = (error as Error & { cause?: unknown }).cause as { code?: string; name?: string } | undefined
  const code = cause?.code ?? ''
  const name = cause?.name ?? ''
  return (
    error.message === 'fetch failed' ||
    name === 'SocketError' ||
    ['UND_ERR_SOCKET', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'EPIPE'].includes(code)
  )
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

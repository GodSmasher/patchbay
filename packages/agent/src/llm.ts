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

/** OpenAI-compatible client for Nebius Token Factory. */
export function createNebiusClient(opts: {
  apiKey: string
  baseUrl: string
  fetch?: typeof fetch
  retries?: number
}): LlmClient {
  const doFetch = opts.fetch ?? fetch
  const retries = opts.retries ?? 2
  const ledger = new Map<string, Usage>()

  async function chat(model: ModelTier, messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const body = {
      model: model.id,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 4096,
      ...(options.thinking === false ? { chat_template_kwargs: { enable_thinking: false } } : {}),
    }

    let lastError: unknown
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await doFetch(`${opts.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
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
        if (!(error instanceof RetryableError) || attempt === retries) break
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

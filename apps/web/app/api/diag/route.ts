export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Diagnostic endpoint: probes Tavily + Nebius from the Vercel runtime so we can see
 * the actual error that /api/slack/command's research step hides as "fetch failed".
 * Only reports env-var presence (not values) and raw error names/messages.
 */
export async function GET() {
  const result: Record<string, unknown> = {
    env: {
      TAVILY_API_KEY: envStatus('TAVILY_API_KEY'),
      NEBIUS_API_KEY: envStatus('NEBIUS_API_KEY'),
      NEBIUS_AI_PROJECT: envStatus('NEBIUS_AI_PROJECT'),
      PATCHBAY_MOCK: process.env.PATCHBAY_MOCK ?? '(unset)',
    },
    tavily: await probe('tavily', async () => {
      const key = process.env.TAVILY_API_KEY
      if (!key) throw new Error('TAVILY_API_KEY is empty/missing on this runtime')
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test', max_results: 1 }),
      })
      return { status: res.status, ok: res.ok, body: (await res.text()).slice(0, 300) }
    }),
    nebius: await probe('nebius', async () => {
      const res = await fetch('https://api.tokenfactory.nebius.com/v1/models', { method: 'GET' })
      return { status: res.status, ok: res.ok }
    }),
  }
  return Response.json(result)
}

function envStatus(name: string): string {
  const v = process.env[name]
  if (v === undefined) return 'MISSING'
  if (v === '') return 'EMPTY'
  return `present (${v.length} chars, prefix=${v.slice(0, 6)}…, suffix=…${v.slice(-4)})`
}

async function probe(label: string, fn: () => Promise<unknown>): Promise<unknown> {
  const start = Date.now()
  try {
    const data = await fn()
    return { ok: true, ms: Date.now() - start, data }
  } catch (error) {
    const err = error as Error & { cause?: { code?: string; message?: string } }
    return {
      ok: false,
      ms: Date.now() - start,
      name: err.name,
      message: err.message,
      cause: err.cause ? { code: err.cause.code, message: err.cause.message } : undefined,
      stack: err.stack?.split('\n').slice(0, 4).join(' | '),
    }
  }
}

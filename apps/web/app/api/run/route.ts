import { loadConfig, missingLiveKeys, replayRun, startRun, type RunEvent } from '@patchbay-nebius/agent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_PROMPT = 400

/**
 * In-memory rate-limit map. Serverless lambdas don't share memory, so this
 * cap is per-instance, not global — a cold start resets the counter, and
 * concurrent lambdas each enforce their own copy. Good enough for the demo
 * (where we want to protect against one tab hammering the Live path);
 * NOT a hard cost guarantee. Swap for Vercel KV or Upstash if you need that.
 */
const hits = new Map<string, number[]>()

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { prompt?: unknown; replay?: unknown; lang?: unknown }
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, MAX_PROMPT) : ''
  if (prompt.length < 12) {
    return Response.json({ error: 'Describe the integration in one sentence, e.g. "When X happens in A, do Y in B".' }, { status: 400 })
  }
  const lang: 'ts' | 'py' = body.lang === 'py' || body.lang === 'python' ? 'py' : 'ts'

  const baseConfig = loadConfig()
  const config = lang === 'py' ? { ...baseConfig, lang } as typeof baseConfig : baseConfig
  const liveAvailable = !config.mock && missingLiveKeys(config).length === 0
  const wantsReplay = body.replay === true
  // Replay is recorded TypeScript-only. If a user picked Python but has no live, we still
  // play the TS replay rather than erroring out — the UI shows this with a note below.
  const limited = liveAvailable && !wantsReplay && !allow(clientKey(request), Number(process.env.PATCHBAY_MAX_RUNS_PER_HOUR || 6))

  const useReplay = !liveAvailable || wantsReplay || limited
  const events: AsyncGenerator<RunEvent> = useReplay ? replayRun() : startRun(prompt, config)
  const notice = limited
    ? 'Hourly live-run limit reached for this address, showing the recorded run instead.'
    : useReplay && lang === 'py'
      ? 'Python mode needs live keys; showing the recorded TypeScript run instead.'
      : null

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      if (notice) send({ type: 'notice', message: notice })
      try {
        for await (const event of events) send(event)
      } catch (error) {
        send({ type: 'error', message: error instanceof Error ? error.message : String(error) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' },
  })
}

export function GET() {
  const config = loadConfig()
  return Response.json({ live: !config.mock && missingLiveKeys(config).length === 0 })
}

function clientKey(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
}

function allow(key: string, perHour: number): boolean {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 3_600_000)
  if (recent.length >= perHour) return false
  recent.push(now)
  hits.set(key, recent)
  return true
}

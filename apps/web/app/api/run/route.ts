import { loadConfig, missingLiveKeys, replayRun, startRun, type RunEvent } from '@patchbay/agent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_PROMPT = 400
const hits = new Map<string, number[]>()

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { prompt?: unknown; replay?: unknown }
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, MAX_PROMPT) : ''
  if (prompt.length < 12) {
    return Response.json({ error: 'Describe the integration in one sentence, e.g. "When X happens in A, do Y in B".' }, { status: 400 })
  }

  const config = loadConfig()
  const liveAvailable = !config.mock && missingLiveKeys(config).length === 0
  const wantsReplay = body.replay === true
  const limited = liveAvailable && !wantsReplay && !allow(clientKey(request), Number(process.env.PATCHBAY_MAX_RUNS_PER_HOUR || 6))

  const events: AsyncGenerator<RunEvent> = !liveAvailable || wantsReplay || limited ? replayRun() : startRun(prompt, config)
  const notice = limited ? 'Hourly live-run limit reached for this address, showing the recorded run instead.' : null

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

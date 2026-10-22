import type { RunEvent } from '@patchbay-nebius/agent'
import { putShare } from '@/lib/share-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { prompt?: unknown; events?: unknown }
  const prompt = typeof body.prompt === 'string' ? body.prompt.slice(0, 400) : ''
  const events = Array.isArray(body.events) ? (body.events as RunEvent[]) : []
  if (prompt.length < 10 || events.length === 0) {
    return Response.json({ error: 'Need a prompt and at least one run event to share.' }, { status: 400 })
  }
  try {
    const id = putShare({ prompt, createdAt: new Date().toISOString(), events })
    return Response.json({ id, url: `/share/${id}` })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'share failed' }, { status: 400 })
  }
}

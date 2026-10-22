import { createHmac, timingSafeEqual } from 'node:crypto'
import { loadConfig, missingLiveKeys, replayRun, startRun, type RunEvent } from '@patchbay-nebius/agent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_PROMPT = 400

/**
 * Slack slash-command endpoint for /patchbay.
 * Flow:
 *   1. Verify Slack signing-secret header + timestamp (anti-replay).
 *   2. ACK within 3s with "building..." so Slack doesn't time out.
 *   3. Run the full pipeline, stream progress edits back to response_url.
 *
 * Configure the slash command in your Slack app:
 *   Command:        /patchbay
 *   Request URL:    https://<deploy>/api/slack/command
 *   Short desc:     Build a tested TypeScript connector
 *   Usage hint:     [build] "When X in A, do Y in B"
 */
export async function POST(request: Request) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET
  if (!signingSecret) {
    return Response.json({ error: 'Slack is not configured on this deployment.' }, { status: 503 })
  }

  const rawBody = await request.text()
  const timestamp = request.headers.get('x-slack-request-timestamp') ?? ''
  const signature = request.headers.get('x-slack-signature') ?? ''
  if (!verifySignature({ signingSecret, timestamp, signature, rawBody })) {
    return Response.json({ error: 'bad signature' }, { status: 401 })
  }

  const params = new URLSearchParams(rawBody)
  const rawText = params.get('text')?.trim() ?? ''
  const responseUrl = params.get('response_url') ?? ''
  const userName = params.get('user_name') ?? 'someone'
  const prompt = normalisePrompt(rawText).slice(0, MAX_PROMPT)

  if (prompt.length < 12) {
    return slackJson(
      'Describe the integration in one sentence, e.g.\n`/patchbay When a Stripe payment succeeds, add the customer to a Mailchimp audience`',
      { ephemeral: true },
    )
  }

  const config = loadConfig()
  const liveAvailable = !config.mock && missingLiveKeys(config).length === 0
  // PATCHBAY_SLACK_REPLAY=true forces the Slack path to use the recorded replay even when
  // live keys are available. The web demo, MCP server and CLI stay live; Slack trades a
  // little authenticity for the "always-under-10-seconds, never-times-out" guarantee that
  // makes it a safe demo surface. Flip it off to run live again.
  const slackReplay = (process.env.PATCHBAY_SLACK_REPLAY ?? 'true').toLowerCase() === 'true'
  if (!liveAvailable || slackReplay) {
    // Replay is fast (<2s to iterate the recorded events) and inlining it means we
    // don't rely on fire-and-forget surviving Vercel's lambda-kill-on-return.
    const summary = await collectReplaySummary(prompt)
    const note = slackReplay && liveAvailable
      ? `_Replay from the recorded Typeform → Pipedrive run. <${liveLink()}|Open the live demo>._`
      : `_Live mode is off here, replaying the recorded run._`
    return slackJson(`${header(userName, prompt)}\n${note}\n\n${summary}`)
  }

  // Kick the real build off in the background; the ACK below must land in <3s.
  void runAndReport(prompt, responseUrl, header(userName, prompt))

  return slackJson(`${header(userName, prompt)}\n⚡ _Working on it — plan, research, generate, verify. ~30-60s._`)
}


function header(user: string, prompt: string): string {
  return `*patchbay* · requested by @${user}\n> ${prompt}`
}

async function runAndReport(prompt: string, responseUrl: string, head: string): Promise<void> {
  if (!responseUrl) return
  const start = Date.now()
  // Slack has a 300s hard cap. Cap attempts and parallel repairs lower than the CLI
  // defaults so one Slack run doesn't eat all the budget on retries nobody can read.
  const config = { ...loadConfig(), maxAttempts: 2, parallelRepairs: 1 }
  let lastStep = ''
  const lines: string[] = []
  // Vercel kills the function at ~300s and Slack silently never hears from us again.
  // Post an honest handoff message a few seconds BEFORE that, so the user at least
  // knows the run is still going and can watch it on the web demo.
  const HANDOFF_MS = 260_000
  const handoff = setTimeout(() => {
    void postUpdate(responseUrl, `${head}\n\n${lines.join('\n')}\n\n⏳ _Still running past Slack's 300s window. Follow the full stream at ${liveLink()}._`)
  }, HANDOFF_MS)

  try {
    for await (const event of startRun(prompt, config)) {
      const line = formatEvent(event)
      if (!line) continue
      lines.push(line)
      // Debounce step-level updates: push one message per completed step, not per log line.
      if (event.type === 'step' && (event.status === 'done' || event.status === 'error') && event.step !== lastStep) {
        lastStep = event.step
        await postUpdate(responseUrl, `${head}\n\n${lines.join('\n')}`)
      }
    }
    clearTimeout(handoff)
    const seconds = Math.round((Date.now() - start) / 1000)
    await postUpdate(responseUrl, `${head}\n\n${lines.join('\n')}\n\n_Finished in ${seconds}s · ${liveLink()}_`)
  } catch (error) {
    clearTimeout(handoff)
    await postUpdate(responseUrl, `${head}\n\n❌ ${error instanceof Error ? error.message : String(error)}`)
  }
}

function formatEvent(event: RunEvent): string | null {
  switch (event.type) {
    case 'step':
      if (event.status === 'start') return `⏳ ${event.step}…`
      if (event.status === 'done') return `✅ ${event.step}${event.detail ? ` — ${event.detail}` : ''}`
      if (event.status === 'error') return `❌ ${event.step}${event.detail ? ` — ${event.detail}` : ''}`
      return null
    case 'tests': {
      const r = event.report
      const branches = event.branches?.length ? ` (${event.branches.length} parallel branches)` : ''
      return `   attempt ${event.attempt}: ${r.passed}/${r.total} tests, typecheck ${r.typecheckOk ? 'ok' : 'failed'}, contract ${r.contract ?? 'n/a'}${branches}`
    }
    case 'result':
      if (event.ok) return `🏁 *${event.report?.passed}/${event.report?.total} tests after ${event.attempts} attempt${event.attempts > 1 ? 's' : ''}*`
      return `🏁 _Not green after ${event.attempts} attempts (${event.report?.passed}/${event.report?.total}). Last draft returned anyway._`
    case 'usage': {
      const total = event.usage.reduce((s, u) => s + u.costUsd, 0)
      return `💰 ~$${total.toFixed(4)} across ${event.usage.length} model call${event.usage.length === 1 ? '' : 's'}`
    }
    default:
      return null
  }
}

async function postUpdate(responseUrl: string, text: string): Promise<void> {
  try {
    await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response_type: 'in_channel', replace_original: true, text }),
    })
  } catch {
    // Slack will show the earlier message; nothing to do here.
  }
}

async function collectReplaySummary(_prompt: string): Promise<string> {
  // pace=0 skips the "pretend-live" delays replayRun uses on the web demo; we want
  // the full summary assembled inside Slack's 3s ACK budget.
  const lines: string[] = []
  for await (const event of replayRun(undefined, 0)) {
    const line = formatEvent(event)
    if (line) lines.push(line)
  }
  return lines.join('\n')
}

function liveLink(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'https://patchbay-nebius.vercel.app'
}

function slackJson(text: string, opts: { ephemeral?: boolean } = {}): Response {
  return Response.json({
    response_type: opts.ephemeral ? 'ephemeral' : 'in_channel',
    text,
  })
}

function normalisePrompt(text: string): string {
  // Allow "/patchbay build ..." as well as "/patchbay ..."
  const withoutBuild = text.replace(/^build\s+/i, '').trim()
  return withoutBuild.replace(/^["'`]|["'`]$/g, '').trim()
}

/**
 * HMAC-SHA256 over "v0:{timestamp}:{rawBody}" with the signing secret, compared timing-safe.
 * Rejects anything older than 5 minutes to block replays.
 */
function verifySignature(args: { signingSecret: string; timestamp: string; signature: string; rawBody: string }): boolean {
  const { signingSecret, timestamp, signature, rawBody } = args
  if (!timestamp || !signature) return false
  const nowSec = Math.floor(Date.now() / 1000)
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > 60 * 5) return false
  const base = `v0:${timestamp}:${rawBody}`
  const expected = 'v0=' + createHmac('sha256', signingSecret).update(base).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

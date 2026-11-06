import { NextResponse } from 'next/server'
import { createHmac } from 'node:crypto'
import { waitUntil } from '@vercel/functions'
import { saveLead } from '@/lib/lead-store'
import { sendTallyWelcomeMail } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/tally-webhook
 *
 * Receives Tally form submissions for the "patchbay hosted scans — early
 * access" survey. Verifies HMAC signature (if TALLY_SIGNING_SECRET is set),
 * extracts email + useCase + price answer, stores the lead, and sends a
 * tally-specific welcome mail.
 *
 * Tally signs the raw body with the signing secret you set in the webhook
 * config using HMAC-SHA256, base64 encoded, sent in the `tally-signature`
 * header. Docs: https://tally.so/help/webhooks
 */

interface TallyOption {
  id: string
  text: string
}

interface TallyField {
  key: string
  label: string
  type: string
  value: unknown
  options?: TallyOption[]
}

interface TallyPayload {
  eventId?: string
  eventType?: string
  formId?: string
  data?: {
    fields?: TallyField[]
  }
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.TALLY_SIGNING_SECRET
  if (!secret) return true // no secret configured → accept (dev / early setup)
  if (!signature) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('base64')
  return expected === signature
}

function fieldValue(fields: TallyField[], labelMatch: RegExp): string | undefined {
  const f = fields.find((x) => labelMatch.test(x.label))
  if (!f) return undefined
  const v = f.value

  if (typeof v === 'string') return v.trim() || undefined

  if (Array.isArray(v) && v.length > 0) {
    // Multiple choice / dropdown: value is an array of option IDs.
    // Resolve to human-readable text via the field's options list.
    if (f.options && f.options.length > 0 && typeof v[0] === 'string') {
      const texts = (v as string[])
        .map((id) => f.options!.find((o) => o.id === id)?.text)
        .filter((t): t is string => Boolean(t))
      if (texts.length > 0) return texts.join(', ')
    }
    // Some Tally payloads already embed {text} or {label} in the value array
    const first = v[0] as { label?: string; text?: string } | string
    if (typeof first === 'string') return first.trim() || undefined
    if (first && typeof first === 'object') {
      if (typeof first.text === 'string') return first.text.trim() || undefined
      if (typeof first.label === 'string') return first.label.trim() || undefined
    }
  }
  return undefined
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text()
  const sig = request.headers.get('tally-signature')
  if (!verifySignature(rawBody, sig)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  let payload: TallyPayload
  try {
    payload = JSON.parse(rawBody) as TallyPayload
  } catch {
    return NextResponse.json({ error: 'body must be JSON' }, { status: 400 })
  }

  if (payload.eventType !== 'FORM_RESPONSE') {
    return NextResponse.json({ ok: true, ignored: payload.eventType ?? 'unknown' })
  }

  const fields = payload.data?.fields ?? []
  const email = fieldValue(fields, /^email$/i)
  if (!email) {
    return NextResponse.json({ error: 'no email field found' }, { status: 400 })
  }

  const useCase = fieldValue(fields, /use.*hosted.*scans|hosted.*scans.*for/i)
  const priceAnswer = fieldValue(fields, /would.*you.*pay|pay.*for.*this/i)

  const saved = await saveLead({
    email,
    target: 'tally:hosted-scans-early-access',
    reportId: '',
    grade: '?',
    score: 0,
    source: 'tally',
    capturedAt: new Date().toISOString(),
    useCase,
    priceAnswer,
  })

  if (saved.isNew && !saved.skipped) {
    waitUntil(
      sendTallyWelcomeMail({ email, useCase, priceAnswer }).then((res) => {
        if (!res.ok) console.error('tally welcome mail failed:', res.error)
        else console.log('tally welcome mail sent to', email)
      }),
    )
  } else {
    console.log('tally repeat (no mail):', email, 'skipped:', saved.skipped ?? 'duplicate')
  }

  return NextResponse.json({ ok: true, isNew: saved.isNew })
}

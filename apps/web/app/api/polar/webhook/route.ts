// Polar.sh webhook handler — week-1 scaffolding stub.
// Listens for subscription.created, subscription.updated,
// subscription.canceled. Writes to public.subscriptions via the Supabase
// service-role client. Signature verification uses the POLAR_WEBHOOK_SECRET
// env var (set after Polar project creation).
//
// Week-1: structure + signature verification + no-op logging.
// Week-2: actually mirror subscription state into public.subscriptions.
import { NextResponse, type NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { serviceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type PolarEvent = {
  type: string
  data?: Record<string, unknown>
}

function verifySignature(rawBody: string, signatureHeader: string | null, secret: string | undefined): boolean {
  if (!signatureHeader || !secret) return false
  // Polar sends an HMAC-SHA256 hex digest in the X-Polar-Signature header (per
  // their current docs). Compare in constant time.
  try {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
    const a = Buffer.from(signatureHeader, 'utf8')
    const b = Buffer.from(expected, 'utf8')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.POLAR_WEBHOOK_SECRET
  const raw = await request.text()
  const sig = request.headers.get('x-polar-signature')

  if (!secret) {
    // Scaffolding posture: 503 until the env var is set in production.
    // Local dev + CI builds don't fail; the handler just signals not-ready.
    console.warn('[polar-webhook] POLAR_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 })
  }
  if (!verifySignature(raw, sig, secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  let event: PolarEvent
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  // Minimum viable persistence — log every event; mirror subscription-shape
  // events into public.subscriptions in week-2. For now, just acknowledge
  // so Polar doesn't retry.
  console.log('[polar-webhook] received', event.type)

  switch (event.type) {
    case 'subscription.created':
    case 'subscription.updated':
    case 'subscription.canceled':
    case 'subscription.active':
    case 'subscription.revoked': {
      // Week-2: upsert into public.subscriptions via serviceClient()
      // using the payload fields.
      // Example sketch:
      //   const { data, error } = await serviceClient()
      //     .from('subscriptions')
      //     .upsert({ polar_subscription_id: ..., status: ..., plan: ... });
      // Not wired in week-1 to avoid silent partial writes against an
      // incomplete schema. The service client import stays referenced so
      // tree-shaking keeps it + the service-key env assertion runs once
      // at module load in production builds.
      void serviceClient
      break
    }
    default:
      // Unknown event type is fine — Polar may add new event types.
      break
  }

  return NextResponse.json({ received: true })
}

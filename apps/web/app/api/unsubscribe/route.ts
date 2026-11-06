import { NextResponse } from 'next/server'
import { markUnsubscribed, verifyUnsubscribeToken } from '@/lib/lead-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/unsubscribe?email=you@x.com&token=<hmac>
 *
 * Verifies the HMAC token, marks the email as unsubscribed, and redirects
 * to /unsubscribed. No DB lookup, no login — the HMAC in the link IS the
 * authorisation. Same URL may be hit multiple times (idempotent).
 */
export async function GET(request: Request): Promise<Response> {
  const u = new URL(request.url)
  const email = (u.searchParams.get('email') ?? '').trim()
  const token = (u.searchParams.get('token') ?? '').trim()

  if (!email || !token) {
    return NextResponse.redirect(new URL('/unsubscribed?error=missing', request.url))
  }
  if (!verifyUnsubscribeToken(email, token)) {
    return NextResponse.redirect(new URL('/unsubscribed?error=invalid', request.url))
  }
  await markUnsubscribed(email)
  return NextResponse.redirect(new URL('/unsubscribed?ok=1', request.url))
}

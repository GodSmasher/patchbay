import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Demo OAuth /token endpoint. Not authenticated, hands back a fake
 * bearer on any POST. Exists so the discovery URL set is complete
 * and future checks that probe the token endpoint have something
 * to talk to.
 */
export async function POST(): Promise<Response> {
  return NextResponse.json({
    access_token: 'demo-fake-token-' + Date.now(),
    token_type: 'bearer',
    expires_in: 3600,
    scope: 'read write admin',
  }, { headers: { 'cache-control': 'no-store' } })
}

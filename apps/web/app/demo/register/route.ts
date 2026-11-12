import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Fake Dynamic Client Registration (RFC 7591) endpoint. Accepts any
 * registration body and returns a client_id. The headless OAuth probe
 * in patchbay audit needs this endpoint to run the PKCE / implicit /
 * redirect battery against /authorize — without a DCR step the probe
 * short-circuits with "no-endpoint".
 *
 * Trade-off: advertising a registration_endpoint silences AUTH-005
 * (no client-registration mechanism). We take that loss to unlock
 * four more findings (PKCE-001/002, IMPLICIT-001, REDIRECT-002).
 */
export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {}
  const clientId = 'demo-' + Math.random().toString(36).slice(2, 10)
  return NextResponse.json({
    client_id: clientId,
    client_secret: undefined,
    client_name: body.client_name ?? 'demo',
    redirect_uris: body.redirect_uris ?? [],
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code'],
    response_types: ['code'],
    application_type: 'native',
  }, { status: 201, headers: { 'cache-control': 'no-store' } })
}

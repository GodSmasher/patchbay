import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * OAuth Authorization Server Metadata for the patchbay demo MCP server.
 *
 * INTENTIONALLY VULNERABLE — this endpoint exists so that `patchbay audit`
 * users can see what real findings look like against a live target. Every
 * omission and bad default below trips at least one check in audit-core:
 *
 *   - `code_challenge_methods_supported` omits S256     → AUTH-003 (high)
 *   - `code_challenge_methods_supported` includes plain → PKCE-002 (high, opt-in)
 *   - `response_types_supported` includes "token"       → IMPLICIT-001 (critical, opt-in)
 *   - `authorization_response_iss_parameter_supported` false → ISS-001 (low)
 *   - `registration_endpoint` present but unauthenticated → wires DCR for the headless probe
 *   - no `dpop_signing_alg_values_supported`            → part of posture
 *
 * The matching /authorize endpoint deliberately accepts crafted requests
 * that trigger PKCE-001 (no code_challenge) and REDIRECT-002 (unregistered
 * redirect_uri).
 */
export async function GET(req: Request): Promise<Response> {
  const base = new URL(req.url).origin + '/demo'
  return NextResponse.json({
    issuer: base,
    authorization_endpoint: base + '/authorize',
    token_endpoint: base + '/token',
    registration_endpoint: base + '/register',
    response_types_supported: ['code', 'token'],
    grant_types_supported: ['authorization_code', 'implicit'],
    code_challenge_methods_supported: ['plain'],
    scopes_supported: ['read', 'write', 'admin'],
    token_endpoint_auth_methods_supported: ['none'],
    authorization_response_iss_parameter_supported: false,
  }, { headers: { 'cache-control': 'no-store' } })
}

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Demo OAuth /authorize endpoint. Intentionally bad so patchbay's
 * Headless OAuth Conformance Battery (opt-in probes) finds something.
 *
 * Each crafted request this returns a redirect for maps to a check:
 *
 *   - response_type=code without code_challenge      → PKCE-001 (critical)
 *   - response_type=code with code_challenge_method=plain → PKCE-002 (high)
 *   - response_type=token                            → IMPLICIT-001 (critical)
 *   - redirect_uri not matching any registered one   → REDIRECT-002 (critical)
 *
 * A real AS would reject every one of these with an OAuth error
 * (invalid_request, unsupported_response_type, invalid_redirect_uri).
 * We issue a 302 with a fake authorization code or token so the probe
 * sees "accepted".
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const p = url.searchParams
  const redirect = p.get('redirect_uri') || 'https://example.com/callback'
  const state = p.get('state') || ''
  const responseType = p.get('response_type') || 'code'

  const target = new URL(redirect)
  if (responseType === 'token') {
    // IMPLICIT-001: issue a fake bearer token in the fragment
    target.hash = new URLSearchParams({
      access_token: 'demo-fake-implicit-token-' + Date.now(),
      token_type: 'bearer',
      expires_in: '3600',
      state,
    }).toString()
  } else {
    // PKCE-001 (no code_challenge) / PKCE-002 (plain) / REDIRECT-002
    // all land here — we hand back a code regardless.
    target.searchParams.set('code', 'demo-fake-code-' + Date.now())
    if (state) target.searchParams.set('state', state)
  }
  return NextResponse.redirect(target.toString(), { status: 302 })
}

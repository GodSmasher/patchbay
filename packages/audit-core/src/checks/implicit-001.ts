import type { Check, Finding } from '../types'

/**
 * IMPLICIT-001: authorization server supports the implicit grant.
 *
 * OAuth 2.1 removes the implicit grant (`response_type=token`). The
 * pattern leaked access tokens via the URL fragment and browser history,
 * had no way to bind the token to a sender, and offered no refresh.
 * Removed in OAuth 2.1 draft-ietf-oauth-v2-1 Section 10, inherited by
 * the MCP authorization spec revision 2026-07-28.
 *
 * The headless OAuth probe sends an /authorize request with
 * `response_type=token`. If the server issues an access token (or a
 * fragment access_token), IMPLICIT-001 fires critical.
 */
export const implicit001: Check = {
  id: 'IMPLICIT-001',
  severity: 'critical',
  title: 'Authorization server supports the implicit grant',
  run: (snapshot): Finding[] => {
    const r = snapshot.remote
    const hp = r?.headlessOauth
    if (!r || !hp || !hp.attempted || !hp.implicit) return []
    const p = hp.implicit

    if (p.outcome === 'accepted') {
      return [
        {
          id: 'IMPLICIT-001',
          severity: 'critical',
          confidence: 'high',
          title: 'Implicit grant (response_type=token) still enabled',
          evidence: `${hp.authorizationEndpoint} responded to response_type=token with ${p.reason ?? 'a success redirect'} (HTTP ${p.httpStatus}). OAuth 2.1 removes the implicit grant; the MCP authorization spec revision 2026-07-28 inherits that. Access tokens delivered in the URL fragment leak into browser history and referer headers.`,
          fix: 'Reject /authorize requests whose response_type is not `code`. Return a 302 redirect with error=unsupported_response_type to the registered redirect_uri. Clients that still rely on the implicit grant should migrate to authorization code + PKCE.',
          docsUrl: 'https://patchbay-mcp.dev/docs/implicit-001',
          autofixTemplate: 'oauth21',
        },
      ]
    }

    if (p.outcome === 'inconclusive') {
      return [
        {
          id: 'IMPLICIT-001',
          severity: 'info',
          confidence: 'low',
          title: 'Implicit-grant probe inconclusive',
          evidence: `Implicit-grant /authorize probe against ${hp.authorizationEndpoint} returned ${p.httpStatus ?? 'no response'}${p.reason ? ` (${p.reason})` : ''}. Cannot tell whether the server would issue an access token on response_type=token.`,
          fix: 'Retry when the server is reachable, or verify by hand that the authorization endpoint rejects response_type=token.',
          docsUrl: 'https://patchbay-mcp.dev/docs/implicit-001',
        },
      ]
    }

    return []
  },
}

import type { Check, Finding } from '../types'

/**
 * PKCE-001: authorization server issues codes without PKCE.
 *
 * OAuth 2.1 Section 7.5.1 requires PKCE (RFC 7636) for ALL clients using
 * the authorization code flow, including confidential clients. The MCP
 * authorization spec revision 2026-07-28 inherits this: every MCP server
 * MUST require code_challenge on /authorize and reject requests that
 * omit it.
 *
 * The headless OAuth probe (opt-in via --probe-headless-oauth) registers
 * a throw-away client via DCR, then sends an /authorize request with a
 * valid redirect and NO code_challenge. If the server issues an
 * authorization code anyway, PKCE is not enforced and this check fires
 * critical.
 */
export const pkce001: Check = {
  id: 'PKCE-001',
  severity: 'critical',
  title: 'Authorization server issues codes without PKCE',
  run: (snapshot): Finding[] => {
    const r = snapshot.remote
    const hp = r?.headlessOauth
    if (!r || !hp || !hp.attempted || !hp.pkceMissing) return []
    const p = hp.pkceMissing

    if (p.outcome === 'accepted') {
      return [
        {
          id: 'PKCE-001',
          severity: 'critical',
          confidence: 'high',
          title: 'Authorization code issued without PKCE',
          evidence: `${hp.authorizationEndpoint} issued a redirect with an authorization code for a request that had NO code_challenge parameter (HTTP ${p.httpStatus}). OAuth 2.1 Section 7.5.1 requires PKCE on every authorization code flow; the MCP authorization spec revision 2026-07-28 makes this mandatory for MCP servers. Without PKCE, a stolen authorization code can be redeemed by any party that intercepts it.`,
          fix: 'Reject any /authorize request that lacks a `code_challenge` parameter. Return a 302 redirect with error=invalid_request to the registered redirect_uri, per OAuth 2.1 Section 7.5.1. Do not accept missing PKCE for confidential clients either — OAuth 2.1 removed that exception.',
          docsUrl: 'https://patchbay-mcp.dev/docs/pkce-001',
          autofixTemplate: 'oauth21',
        },
      ]
    }

    if (p.outcome === 'inconclusive') {
      return [
        {
          id: 'PKCE-001',
          severity: 'info',
          confidence: 'low',
          title: 'PKCE enforcement probe inconclusive',
          evidence: `No-PKCE /authorize probe against ${hp.authorizationEndpoint} returned ${p.httpStatus ?? 'no response'}${p.reason ? ` (${p.reason})` : ''}. Cannot tell whether the server would issue a code without PKCE after user consent.`,
          fix: 'Retry when the server is reachable, or verify by hand that the authorization endpoint rejects requests without code_challenge.',
          docsUrl: 'https://patchbay-mcp.dev/docs/pkce-001',
        },
      ]
    }

    return []
  },
}

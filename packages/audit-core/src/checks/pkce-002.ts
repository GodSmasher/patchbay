import type { Check, Finding } from '../types'

/**
 * PKCE-002: authorization server accepts plain PKCE.
 *
 * OAuth 2.1 Section 7.5.2 removes the `plain` code_challenge_method and
 * requires `S256`. Accepting `plain` means the code_challenge and code
 * verifier are identical, so anyone who intercepts the authorization
 * request also has the verifier and PKCE adds zero protection.
 *
 * The headless OAuth probe sends an /authorize request with a valid
 * code_challenge value but `code_challenge_method=plain`. If the server
 * issues a code, PKCE-002 fires high.
 */
export const pkce002: Check = {
  id: 'PKCE-002',
  severity: 'high',
  title: 'Authorization server accepts plain PKCE',
  run: (snapshot): Finding[] => {
    const r = snapshot.remote
    const hp = r?.headlessOauth
    if (!r || !hp || !hp.attempted || !hp.pkcePlain) return []
    const p = hp.pkcePlain

    if (p.outcome === 'accepted') {
      return [
        {
          id: 'PKCE-002',
          severity: 'high',
          confidence: 'high',
          title: 'Authorization server accepts plain PKCE',
          evidence: `${hp.authorizationEndpoint} issued an authorization code for a request with code_challenge_method=plain (HTTP ${p.httpStatus}). OAuth 2.1 Section 7.5.2 removed the plain method; the server must require S256. With plain, challenge and verifier are identical, so intercepting the authorization request also reveals the verifier.`,
          fix: 'Reject any /authorize request whose code_challenge_method is not `S256`. Return a 302 redirect with error=invalid_request. The removal of `plain` is explicit in OAuth 2.1 and has been RECOMMENDED since RFC 7636.',
          docsUrl: 'https://patchbay-mcp.dev/docs/pkce-002',
          autofixTemplate: 'oauth21',
        },
      ]
    }

    if (p.outcome === 'inconclusive') {
      return [
        {
          id: 'PKCE-002',
          severity: 'info',
          confidence: 'low',
          title: 'Plain-PKCE probe inconclusive',
          evidence: `Plain-PKCE /authorize probe against ${hp.authorizationEndpoint} returned ${p.httpStatus ?? 'no response'}${p.reason ? ` (${p.reason})` : ''}. Cannot tell whether the server would issue a code with code_challenge_method=plain.`,
          fix: 'Retry when the server is reachable, or verify by hand that the authorization endpoint rejects code_challenge_method=plain.',
          docsUrl: 'https://patchbay-mcp.dev/docs/pkce-002',
        },
      ]
    }

    return []
  },
}

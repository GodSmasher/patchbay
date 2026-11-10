import type { Check, Finding } from '../types'

/**
 * AUTH-007: wrong HTTP status for an invalid bearer token.
 *
 * MCP authorization spec revision 2026-07-28: "Invalid or expired tokens
 * MUST receive a HTTP 401 response." The passive dummy-bearer probe that
 * already runs for AUTH-002 captures the exact status code the server
 * returned when it rejected our junk token. AUTH-007 fires medium when
 * that status is not 401.
 *
 * Skips when:
 *  - the dummy bearer was ACCEPTED (AUTH-002 handles that critical case),
 *  - no status was captured (auth not required, or probe inconclusive),
 *  - the status IS 401 (correct behaviour).
 *
 * Fires medium otherwise. 403 is the most likely wrong value and tells
 * a client "forbidden for this scope" when the actual problem is "token
 * invalid"; MCP clients that discriminate on this status will not retry
 * with a fresh token.
 */
export const auth007: Check = {
  id: 'AUTH-007',
  severity: 'medium',
  title: 'Invalid bearer token returns wrong HTTP status',
  run: (snapshot): Finding[] => {
    const r = snapshot.remote
    if (!r || !r.authRequired) return []
    if (r.acceptedAuthHeader === 'bearer') return [] // AUTH-002 land
    const status = r.invalidTokenStatus
    if (typeof status !== 'number') return []
    if (status === 401) return []

    const www = r.invalidTokenWwwAuthenticate
    const wwwNote = www ? ` WWW-Authenticate: ${www}` : ' No WWW-Authenticate header on the response.'

    return [
      {
        id: 'AUTH-007',
        severity: 'medium',
        confidence: 'high',
        title: `Invalid bearer token returned HTTP ${status} instead of 401`,
        evidence: `${r.url} returned HTTP ${status} to a tools/list request carrying a bogus bearer token. Per MCP authorization spec revision 2026-07-28 ("Invalid or expired tokens MUST receive a HTTP 401 response") the correct status is 401 with a WWW-Authenticate header pointing at the authorization server.${wwwNote}`,
        fix: 'Return HTTP 401 with a WWW-Authenticate header on every request that carries an invalid or expired bearer token. Reserve 403 for authenticated requests that lack the required scope (use WWW-Authenticate error="insufficient_scope" there).',
        docsUrl: 'https://patchbay-mcp.dev/docs/auth-007',
        autofixTemplate: 'oauth21',
      },
    ]
  },
}

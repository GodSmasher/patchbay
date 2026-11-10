import type { Check, Finding } from '../types'

/**
 * REDIRECT-002: authorization server accepts unregistered redirect_uri.
 *
 * OAuth 2.1 Section 2.3.1 requires exact-match comparison of redirect_uri
 * against the set registered with the client. A server that accepts a
 * redirect_uri the client never registered turns itself into an open
 * redirector and lets an attacker exfiltrate authorization codes to any
 * host they control.
 *
 * The headless OAuth probe registers a client via DCR with
 * redirect_uri=http://127.0.0.1:33419/callback, then sends /authorize
 * with redirect_uri=https://attacker.example.com/callback. If the
 * server redirects to the attacker host (or issues a code), REDIRECT-002
 * fires critical.
 */
export const redirect002: Check = {
  id: 'REDIRECT-002',
  severity: 'critical',
  title: 'Authorization server accepts unregistered redirect_uri',
  run: (snapshot): Finding[] => {
    const r = snapshot.remote
    const hp = r?.headlessOauth
    if (!r || !hp || !hp.attempted || !hp.redirectMismatch) return []
    const p = hp.redirectMismatch

    if (p.outcome === 'accepted') {
      return [
        {
          id: 'REDIRECT-002',
          severity: 'critical',
          confidence: 'high',
          title: 'Authorization code delivered to unregistered redirect_uri',
          evidence: `${hp.authorizationEndpoint} issued a redirect for redirect_uri=https://attacker.example.com/callback although the probe client was registered with redirect_uri=http://127.0.0.1:33419/callback (HTTP ${p.httpStatus}). OAuth 2.1 Section 2.3.1 requires exact-match comparison of redirect_uri against the registered set. Accepting an unregistered redirect turns this authorization server into an open redirector for code exfiltration.`,
          fix: 'Validate redirect_uri with an exact-string comparison (including scheme, host, port, path, and trailing slash) against the client\'s registered redirect_uris. Reject with error=invalid_request when no entry matches. Do not perform a substring, prefix, or host-only comparison.',
          docsUrl: 'https://patchbay-mcp.dev/docs/redirect-002',
          autofixTemplate: 'oauth21',
        },
      ]
    }

    if (p.outcome === 'inconclusive') {
      return [
        {
          id: 'REDIRECT-002',
          severity: 'info',
          confidence: 'low',
          title: 'Redirect-URI-mismatch probe inconclusive',
          evidence: `Redirect-URI-mismatch /authorize probe against ${hp.authorizationEndpoint} returned ${p.httpStatus ?? 'no response'}${p.reason ? ` (${p.reason})` : ''}. Cannot tell whether the server enforces exact-match redirect_uri comparison.`,
          fix: 'Retry when the server is reachable, or verify by hand that the authorization endpoint rejects unregistered redirect_uri values.',
          docsUrl: 'https://patchbay-mcp.dev/docs/redirect-002',
        },
      ]
    }

    return []
  },
}

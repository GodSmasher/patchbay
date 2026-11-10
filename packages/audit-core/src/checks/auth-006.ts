import type { Check, Finding } from '../types'

export const auth006: Check = {
  id: 'AUTH-006',
  severity: 'high',
  title: 'Authorization server rejects loopback redirect URIs',
  run: (snapshot): Finding[] => {
    const r = snapshot.remote
    if (!r || !r.dcrLoopback || !r.dcrLoopback.attempted) return []
    const p = r.dcrLoopback

    if (p.outcome === 'rejected') {
      const status = p.httpStatus ?? 400
      return [
        {
          id: 'AUTH-006',
          severity: 'high',
          confidence: 'high',
          title: 'DCR rejects RFC 8252 loopback redirect URIs',
          evidence: `${r.url}'s registration_endpoint rejected "http://127.0.0.1:PORT/callback" and "http://localhost:PORT/callback" with HTTP ${status}. Native and CLI MCP clients that follow RFC 8252 Section 7.3 cannot complete the authorization code flow against this server.`,
          fix: 'Accept loopback IP redirect URIs ("http://127.0.0.1:PORT/callback" and "http://localhost:PORT/callback") in Dynamic Client Registration. Per RFC 8252 Section 7.3 the authorization server MUST allow any port on loopback redirect URIs, to accommodate clients that bind to an ephemeral port at request time. Reserved for loopback only; still reject arbitrary http:// hosts.',
          docsUrl: 'https://patchbay-mcp.dev/docs/auth-006',
          autofixTemplate: 'oauth21',
        },
      ]
    }

    if (p.outcome === 'inconclusive') {
      return [
        {
          id: 'AUTH-006',
          severity: 'info',
          confidence: 'low',
          title: 'DCR loopback probe inconclusive',
          evidence: `DCR loopback probe against ${r.url} returned ${p.httpStatus ?? 'no response'}${p.reason ? ` (${p.reason})` : ''}. Cannot tell whether the server accepts loopback redirect URIs per RFC 8252 Section 7.3.`,
          fix: 'Retry the probe when the server is reachable, or inspect the registration endpoint manually.',
          docsUrl: 'https://patchbay-mcp.dev/docs/auth-006',
        },
      ]
    }

    // outcome: 'accepted' (check passed) or 'no-endpoint' (AUTH-005 territory) — no finding.
    return []
  },
}

import type { Check, Finding } from '../types'

export const auth006: Check = {
  id: 'AUTH-006',
  severity: 'high',
  title: 'Authorization server rejects loopback redirect URIs',
  run: (snapshot): Finding[] => {
    const r = snapshot.remote
    if (!r || !r.dcrLoopback || !r.dcrLoopback.attempted) return []
    if (r.dcrLoopback.outcome !== 'rejected') return []
    const status = r.dcrLoopback.httpStatus ?? 400
    return [
      {
        id: 'AUTH-006',
        severity: 'high',
        confidence: 'high',
        title: 'DCR rejects RFC 8252 loopback redirect URIs',
        evidence: `${r.url}'s registration_endpoint rejected "http://127.0.0.1:PORT/callback" and "http://localhost:PORT/callback" with HTTP ${status}. Native and CLI MCP clients that follow RFC 8252 Section 7.3 cannot complete the authorization code flow against this server.`,
        fix: 'Accept loopback IP redirect URIs ("http://127.0.0.1:PORT/callback" and "http://localhost:PORT/callback") in Dynamic Client Registration and treat any port number as valid per RFC 8252 Section 7.3. Reserved for native and CLI clients only; still reject arbitrary http:// hosts.',
        docsUrl: 'https://patchbay-mcp.dev/docs/auth-006',
        autofixTemplate: 'oauth21',
      },
    ]
  },
}

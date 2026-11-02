import type { Check, Finding } from '../types'

export const redirect001: Check = {
  id: 'REDIRECT-001',
  severity: 'medium',
  title: 'Redirect URI validation inconsistent for localhost / 127.0.0.1',
  run: (snapshot): Finding[] => {
    const r = snapshot.remote
    if (!r || !r.redirectLocalhostInconsistent) return []
    return [
      {
        id: 'REDIRECT-001',
        severity: 'medium',
        confidence: 'medium',
        title: 'Token endpoint treats localhost and 127.0.0.1 differently',
        evidence: `${r.url} token endpoint responded with different status codes for redirect_uri=http://localhost/cb vs http://127.0.0.1/cb. Clients that pick either hit interop breaks.`,
        fix: 'Treat loopback literals (localhost, 127.0.0.1, [::1]) as equivalent per RFC 8252 §7.3 when validating redirect_uri.',
        docsUrl: 'https://patchbay-mcp.dev/docs/redirect-001',
      },
    ]
  },
}

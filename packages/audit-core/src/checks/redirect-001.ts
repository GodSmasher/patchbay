import type { Check, CheckOutput } from '../types'

/**
 * Methodology metadata — read by scripts/generate-methodology-matrix.mjs
 * at build time to regenerate the check-to-source table on /methodology.
 * Keep in sync with any change to this check or its severity rationale.
 */
export const METADATA = {
  id: 'REDIRECT-001',
  category: 'OAuth / Native',
  primarySource: 'RFC 8252 §8.3 loopback IP literal equivalence',
  confidence: 'HIGH',
  published: true,
} as const

export const redirect001: Check = {
  id: 'REDIRECT-001',
  severity: 'medium',
  title: 'Redirect URI validation inconsistent for localhost / 127.0.0.1',
  run: (snapshot): CheckOutput[] => {
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

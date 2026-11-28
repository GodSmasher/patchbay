import type { Check, CheckOutput } from '../types'

/**
 * Methodology metadata — read by scripts/generate-methodology-matrix.mjs
 * at build time to regenerate the check-to-source table on /methodology.
 * Keep in sync with any change to this check or its severity rationale.
 */
export const METADATA = {
  id: 'TRANSPORT-001',
  category: 'Transport',
  primarySource: 'OWASP Secure Headers Project + patchbay HTTPS-required policy',
  confidence: 'HIGH',
  published: true,
} as const

export const transport001: Check = {
  id: 'TRANSPORT-001',
  severity: 'high',
  title: 'Remote server reachable over plain HTTP',
  run: (snapshot): CheckOutput[] => {
    const r = snapshot.remote
    if (!r) return []
    if (r.usesTls) return []
    if (/^http:\/\/(localhost|127\.0\.0\.1|\[?::1\]?)([:/]|$)/i.test(r.url)) return []
    return [
      {
        id: 'TRANSPORT-001',
        severity: 'high',
        confidence: 'high',
        title: 'Server reachable over plain HTTP',
        evidence: `${r.url} is served without TLS. Bearer tokens traverse the wire in cleartext.`,
        fix: 'Serve the MCP endpoint over HTTPS only. Redirect or reject plain HTTP.',
        docsUrl: 'https://patchbay-mcp.dev/docs/transport-001',
      },
    ]
  },
}

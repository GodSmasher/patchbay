import type { Check, CheckOutput } from '../types'

/**
 * Methodology metadata — read by scripts/generate-methodology-matrix.mjs
 * at build time to regenerate the check-to-source table on /methodology.
 * Keep in sync with any change to this check or its severity rationale.
 */
export const METADATA = {
  id: 'AUTH-002',
  category: 'OAuth',
  primarySource: 'OAuth 2.1 §5.2 Protected Resource behaviour',
  confidence: 'HIGH',
  published: true,
} as const

export const auth002: Check = {
  id: 'AUTH-002',
  severity: 'critical',
  title: 'Static API key accepted, no OAuth discovery',
  run: (snapshot): CheckOutput[] => {
    const r = snapshot.remote
    if (!r || !r.reachable) return []
    if (!r.authRequired) return []
    if (r.acceptedAuthHeader !== 'api-key' && r.acceptedAuthHeader !== 'bearer') return []
    if (r.oauthProtectedResource || r.oauthAuthServer) return []
    return [
      {
        id: 'AUTH-002',
        severity: 'critical',
        confidence: 'high',
        title: 'Static credential accepted, no OAuth 2.1 discovery served',
        evidence: `Server at ${r.url} accepts ${r.acceptedAuthHeader} credentials but serves no /.well-known/oauth-protected-resource or /.well-known/oauth-authorization-server metadata.`,
        fix: 'Replace static credentials with OAuth 2.1. Publish discovery metadata so clients can negotiate PKCE, scopes and resource indicators.',
        docsUrl: 'https://patchbay-mcp.dev/docs/auth-002',
        autofixTemplate: 'oauth21',
      },
    ]
  },
}

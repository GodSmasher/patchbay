import type { Check, Finding } from '../types'

export const auth002: Check = {
  id: 'AUTH-002',
  severity: 'critical',
  title: 'Static API key accepted, no OAuth discovery',
  run: (snapshot): Finding[] => {
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
        docsUrl: 'https://patchbay.dev/docs/auth-002',
        autofixTemplate: 'oauth21',
      },
    ]
  },
}

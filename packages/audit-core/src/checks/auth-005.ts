import type { Check, Finding } from '../types'

export const auth005: Check = {
  id: 'AUTH-005',
  severity: 'high',
  title: 'Dynamic Client Registration unsupported',
  run: (snapshot): Finding[] => {
    const r = snapshot.remote
    if (!r || !r.oauthAuthServer) return []
    const meta = r.oauthAuthServer
    const reg = meta.registration_endpoint
    if (typeof reg === 'string' && reg.length > 0) return []
    return [
      {
        id: 'AUTH-005',
        severity: 'high',
        confidence: 'high',
        title: 'OAuth 2.1 advertised without Dynamic Client Registration',
        evidence: `${r.url} serves OAuth metadata but no "registration_endpoint". MCP clients cannot self-register and must be onboarded out of band.`,
        fix: 'Implement RFC 7591 Dynamic Client Registration or document a client registration flow. Serve a "registration_endpoint" in /.well-known/oauth-authorization-server.',
        docsUrl: 'https://patchbay.dev/docs/auth-005',
        autofixTemplate: 'oauth21',
      },
    ]
  },
}

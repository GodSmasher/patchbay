import type { Check, Finding } from '../types'

export const auth004: Check = {
  id: 'AUTH-004',
  severity: 'high',
  title: 'No resource indicator support (RFC 8707)',
  run: (snapshot): Finding[] => {
    const r = snapshot.remote
    if (!r || !r.oauthAuthServer) return []
    const meta = r.oauthAuthServer
    const flag = meta.resource_indicators_supported
    if (flag === true) return []
    return [
      {
        id: 'AUTH-004',
        severity: 'high',
        confidence: 'medium',
        title: 'Tokens not bound to this resource server (RFC 8707)',
        evidence: `${r.url} advertises no "resource_indicators_supported": true in OAuth metadata. Clients cannot bind tokens to this server; tokens issued for other audiences can be replayed.`,
        fix: 'Support the `resource` parameter on authorization + token requests (RFC 8707) and reject tokens whose audience is not this server.',
        docsUrl: 'https://patchbay.dev/docs/auth-004',
        autofixTemplate: 'oauth21',
      },
    ]
  },
}

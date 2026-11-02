import type { Check, Finding } from '../types'

export const auth003: Check = {
  id: 'AUTH-003',
  severity: 'high',
  title: 'PKCE S256 not required',
  run: (snapshot): Finding[] => {
    const r = snapshot.remote
    if (!r || !r.oauthAuthServer) return []
    const meta = r.oauthAuthServer
    const methods = meta.code_challenge_methods_supported
    const list = Array.isArray(methods) ? methods.filter((m): m is string => typeof m === 'string') : []
    if (list.includes('S256')) return []
    return [
      {
        id: 'AUTH-003',
        severity: 'high',
        confidence: 'high',
        title: 'PKCE S256 not advertised in OAuth metadata',
        evidence: `code_challenge_methods_supported = ${list.length ? JSON.stringify(list) : '(missing)'} at ${r.url}. OAuth 2.1 requires PKCE with S256.`,
        fix: 'Advertise PKCE in /.well-known/oauth-authorization-server with "code_challenge_methods_supported": ["S256"] and enforce S256 server-side.',
        docsUrl: 'https://patchbay.dev/docs/auth-003',
        autofixTemplate: 'oauth21',
      },
    ]
  },
}

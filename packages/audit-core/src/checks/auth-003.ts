import type { Check, Finding } from '../types'

/**
 * AUTH-003: PKCE S256 not advertised in authorization-server metadata.
 *
 * Per MCP authorization spec revision 2026-07-28 security-considerations:
 * "If code_challenge_methods_supported is absent, the authorization server
 * does not support PKCE and MCP clients MUST refuse to proceed." Absence of
 * the field is therefore a hard login-block for spec-compliant MCP clients,
 * not a metadata-only annoyance.
 */
export const auth003: Check = {
  id: 'AUTH-003',
  severity: 'high',
  title: 'PKCE S256 not advertised in OAuth metadata',
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
        evidence: `code_challenge_methods_supported = ${list.length ? JSON.stringify(list) : '(missing)'} at ${r.url}. Per MCP authorization spec revision 2026-07-28 security considerations, when this field does not include "S256" the authorization server is treated as not supporting PKCE and spec-compliant MCP clients MUST refuse to proceed. The server may still enforce S256 at runtime for non-MCP clients, but the MCP flow is blocked before login.`,
        fix: 'Advertise PKCE in /.well-known/oauth-authorization-server with "code_challenge_methods_supported": ["S256"] and enforce S256 server-side on the token endpoint.',
        docsUrl: 'https://patchbay-mcp.dev/docs/auth-003',
        autofixTemplate: 'oauth21',
      },
    ]
  },
}

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
        severity: 'medium',
        confidence: 'medium',
        title: 'Resource indicators not advertised (RFC 8707)',
        evidence: `${r.url} advertises no "resource_indicators_supported": true in OAuth metadata. Clients cannot discover whether tokens are audience-bound; server may still enforce audience at runtime — this is a metadata completeness finding, not a confirmed vulnerability.`,
        fix: 'Support the `resource` parameter on authorization + token requests (RFC 8707), reject tokens whose audience is not this server, and advertise the capability in metadata.',
        docsUrl: 'https://patchbay-mcp.dev/docs/auth-004',
        autofixTemplate: 'oauth21',
      },
    ]
  },
}

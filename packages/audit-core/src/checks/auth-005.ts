import type { Check, Finding } from '../types'

/**
 * AUTH-005: No client-registration mechanism advertised.
 *
 * MCP authorization spec revision 2026-07-28 lets servers advertise any one
 * of three registration mechanisms:
 *  1. Client ID Metadata Documents (SHOULD, primary option in the current
 *     spec). Signalled by `client_id_metadata_document_supported: true` in
 *     the authorisation-server metadata.
 *  2. Pre-registration (out of band, not signalled in metadata).
 *  3. Dynamic Client Registration via `registration_endpoint` (MAY,
 *     deprecated in 2026-07-28 but still spec-conform for backwards
 *     compatibility).
 *
 * A server that advertises neither CIMD nor DCR in its metadata forces
 * every new MCP client to go through out-of-band pre-registration. That
 * is spec-permitted but hostile to clients the operator does not already
 * know about. Finding fires high in that case.
 *
 * A server that advertises DCR only (no CIMD) is still spec-conform but
 * on the deprecated path. Finding fires at info severity ("DCR is
 * deprecated per MCP 2026-07-28, consider adding Client ID Metadata
 * Documents"). Info means no grade hit.
 *
 * A server that advertises CIMD passes (whether or not DCR is also
 * present).
 */
export const auth005: Check = {
  id: 'AUTH-005',
  severity: 'high',
  title: 'No client-registration mechanism advertised',
  run: (snapshot): Finding[] => {
    const r = snapshot.remote
    if (!r || !r.oauthAuthServer) return []
    const meta = r.oauthAuthServer
    const regEndpoint = typeof meta.registration_endpoint === 'string' && meta.registration_endpoint.length > 0
    const cimdSupported = meta.client_id_metadata_document_supported === true

    if (cimdSupported) return []

    if (regEndpoint) {
      return [
        {
          id: 'AUTH-005',
          severity: 'info',
          confidence: 'high',
          title: 'Dynamic Client Registration used but deprecated',
          evidence: `${r.url} advertises a "registration_endpoint" (RFC 7591 Dynamic Client Registration) but no "client_id_metadata_document_supported". DCR is deprecated in MCP authorization spec revision 2026-07-28 and retained for backwards compatibility only.`,
          fix: 'Add support for OAuth Client ID Metadata Documents (the current MCP spec primary registration mechanism) and advertise it by setting "client_id_metadata_document_supported": true in /.well-known/oauth-authorization-server. Existing DCR endpoint can stay for backwards compatibility.',
          docsUrl: 'https://patchbay-mcp.dev/docs/auth-005',
          autofixTemplate: 'oauth21',
        },
      ]
    }

    return [
      {
        id: 'AUTH-005',
        severity: 'high',
        confidence: 'high',
        title: 'OAuth advertised without any client-registration mechanism',
        evidence: `${r.url} serves OAuth metadata but advertises neither "client_id_metadata_document_supported" nor "registration_endpoint". New MCP clients cannot obtain a client_id without out-of-band pre-registration, which does not scale.`,
        fix: 'Support OAuth Client ID Metadata Documents (MCP authorization spec revision 2026-07-28 primary option) and advertise it with "client_id_metadata_document_supported": true in /.well-known/oauth-authorization-server. Alternatively keep RFC 7591 Dynamic Client Registration and serve a "registration_endpoint", though DCR is deprecated in the current spec.',
        docsUrl: 'https://patchbay-mcp.dev/docs/auth-005',
        autofixTemplate: 'oauth21',
      },
    ]
  },
}

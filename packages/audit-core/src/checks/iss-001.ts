import type { Check, Finding } from '../types'

/**
 * ISS-001: authorization server does not advertise RFC 9207 iss parameter.
 *
 * MCP authorization spec revision 2026-07-28: "MCP authorization servers
 * SHOULD include the `iss` parameter in authorization responses, including
 * error responses" and "MCP clients MUST apply the validation in RFC 9207
 * Section 2.4 before transmitting the authorization code."
 *
 * An AS that intends to send the iss parameter MUST advertise it by
 * setting `authorization_response_iss_parameter_supported: true` in its
 * metadata. Absence of the flag means clients cannot know to look for the
 * parameter, which disables the RFC 9207 mix-up-attack mitigation.
 *
 * The spec explicitly says a future revision is expected to upgrade the
 * server side to MUST, so this check is low severity today and will
 * likely rise to medium or high.
 */
export const iss001: Check = {
  id: 'ISS-001',
  severity: 'low',
  title: 'RFC 9207 iss parameter not advertised in OAuth metadata',
  run: (snapshot): Finding[] => {
    const r = snapshot.remote
    if (!r || !r.oauthAuthServer) return []
    const meta = r.oauthAuthServer
    if (meta.authorization_response_iss_parameter_supported === true) return []
    return [
      {
        id: 'ISS-001',
        severity: 'low',
        confidence: 'high',
        title: 'RFC 9207 iss parameter not advertised in OAuth metadata',
        evidence: `${r.url}'s authorization-server metadata does not set "authorization_response_iss_parameter_supported": true. MCP spec revision 2026-07-28 SHOULD-requires MCP authorization servers to send the iss parameter in authorization responses; without the metadata flag, clients cannot know to validate it per RFC 9207 Section 2.4.`,
        fix: 'Set "authorization_response_iss_parameter_supported": true in /.well-known/oauth-authorization-server and include the iss parameter in every authorization response (including error responses).',
        docsUrl: 'https://patchbay-mcp.dev/docs/iss-001',
        autofixTemplate: 'oauth21',
      },
    ]
  },
}

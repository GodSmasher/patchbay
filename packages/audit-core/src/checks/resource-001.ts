import type { Check, Finding } from '../types'

/**
 * RESOURCE-001: Protected Resource Metadata (RFC 9728) missing or malformed.
 *
 * MCP authorization spec mandates this since revision 2025-06-18 and keeps
 * it mandatory in 2026-07-28: "MCP servers MUST implement the OAuth 2.0
 * Protected Resource Metadata (RFC 9728) specification" and "The metadata
 * document MUST include the `authorization_servers` field containing at
 * least one authorization server."
 *
 * Without PRM a client cannot discover which authorization servers issue
 * tokens for this resource, so it cannot begin the OAuth flow at all.
 *
 * Fires only on servers that actually use OAuth. A server that is
 * unreachable or requires no auth is reported elsewhere (AUTH-001,
 * PROBE-001); adding RESOURCE-001 there would be noise.
 */
export const resource001: Check = {
  id: 'RESOURCE-001',
  severity: 'high',
  title: 'Protected Resource Metadata (RFC 9728) missing',
  run: (snapshot): Finding[] => {
    const r = snapshot.remote
    if (!r) return []

    // Only evaluate on servers that use OAuth. "Uses OAuth" means either
    // the AS metadata was served, or we observed the server requiring auth.
    const usesOauth = Boolean(r.oauthAuthServer) || r.authRequired === true
    if (!usesOauth) return []

    const prm = r.oauthProtectedResource

    if (!prm || typeof prm !== 'object') {
      return [
        {
          id: 'RESOURCE-001',
          severity: 'high',
          confidence: 'high',
          title: 'No /.well-known/oauth-protected-resource document served',
          evidence: `${r.url} uses OAuth (auth required or authorization-server metadata advertised) but serves no Protected Resource Metadata document at /.well-known/oauth-protected-resource. MCP authorization spec revision 2025-06-18 (retained in 2026-07-28) makes RFC 9728 mandatory for MCP servers. Clients cannot discover which authorization servers issue tokens for this resource.`,
          fix: 'Serve /.well-known/oauth-protected-resource as JSON per RFC 9728. The document MUST include an "authorization_servers" array with at least one authorization server issuer URL. The "resource" field SHOULD contain the canonical URL of this MCP endpoint.',
          docsUrl: 'https://patchbay-mcp.dev/docs/resource-001',
          autofixTemplate: 'oauth21',
        },
      ]
    }

    const authServers = (prm as Record<string, unknown>).authorization_servers
    const hasValidAsArray = Array.isArray(authServers)
      && authServers.length > 0
      && authServers.every((s) => typeof s === 'string' && s.length > 0)

    if (!hasValidAsArray) {
      return [
        {
          id: 'RESOURCE-001',
          severity: 'high',
          confidence: 'high',
          title: 'Protected Resource Metadata missing authorization_servers',
          evidence: `${r.url} serves /.well-known/oauth-protected-resource but the document does not include a non-empty "authorization_servers" array of strings. Per RFC 9728 and MCP authorization spec revision 2025-06-18, this field MUST be present with at least one authorization server issuer URL.`,
          fix: 'Add an "authorization_servers" field to /.well-known/oauth-protected-resource as a JSON array of at least one issuer URL (the same issuer you advertise in /.well-known/oauth-authorization-server).',
          docsUrl: 'https://patchbay-mcp.dev/docs/resource-001',
          autofixTemplate: 'oauth21',
        },
      ]
    }

    return []
  },
}

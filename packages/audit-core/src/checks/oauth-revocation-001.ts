import type { Check, Finding } from '../types'

/**
 * OAUTH-REVOCATION-001: AS metadata advertises refresh tokens but no
 * revocation endpoint.
 *
 * RFC 7009 defines a `revocation_endpoint` so a client that discovers
 * its refresh token was leaked can tell the AS to invalidate it. MCP
 * authorization spec revision 2026-07-28 keeps this optional, but a
 * server that mints long-lived refresh tokens AND has no way for a
 * caller to revoke them effectively lets any leaked token live until
 * its expiry window ends. Common in Auth0/Clerk/WorkOS templates where
 * the operator never wired the revocation route.
 *
 * Heuristic: `grant_types_supported` includes `refresh_token` or the AS
 * documents `refresh_token_expires_in` / `refresh_token_lifetime`, AND
 * `revocation_endpoint` is missing from the metadata.
 *
 * Medium severity, high confidence (metadata is self-reported — if the
 * server does revoke tokens it SHOULD advertise the endpoint).
 */
export const oauthRevocation001: Check = {
  id: 'OAUTH-REVOCATION-001',
  severity: 'medium',
  title: 'AS metadata missing revocation_endpoint on server that mints refresh tokens',
  run: (snapshot): Finding[] => {
    const as = snapshot.remote?.oauthAuthServer
    if (!as || typeof as !== 'object') return []

    const metadata = as as Record<string, unknown>
    const grantTypes = metadata.grant_types_supported
    const supportsRefresh = Array.isArray(grantTypes) && grantTypes.includes('refresh_token')
    const refreshLifetime = 'refresh_token_expires_in' in metadata || 'refresh_token_lifetime' in metadata

    if (!supportsRefresh && !refreshLifetime) return []
    if (typeof metadata.revocation_endpoint === 'string' && metadata.revocation_endpoint.length > 0) return []

    return [{
      id: 'OAUTH-REVOCATION-001',
      severity: 'medium',
      confidence: 'high',
      title: 'OAuth server mints refresh tokens but exposes no revocation endpoint',
      evidence: 'The AS metadata at /.well-known/oauth-authorization-server ' +
        (supportsRefresh ? 'lists `refresh_token` in grant_types_supported' : 'advertises refresh-token lifetime fields') +
        ', but no `revocation_endpoint` is published. Per RFC 7009 the revocation endpoint is how a client tells the AS that a refresh or access token was leaked; without it a compromised token lives until it expires.',
      fix: 'Implement RFC 7009 token revocation and advertise the endpoint as `revocation_endpoint` in /.well-known/oauth-authorization-server. Most OAuth hosts (Auth0, Clerk, WorkOS, Keycloak) ship this out of the box — the fix is usually a configuration toggle plus the metadata update. If you deliberately do not revoke tokens (short-lived, one-shot sessions), remove `refresh_token` from grant_types_supported so clients do not store a token they cannot cancel.',
      docsUrl: 'https://patchbay-mcp.dev/docs/oauth-revocation-001',
    }]
  },
}

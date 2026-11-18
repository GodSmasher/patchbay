import type { Check, CheckOutput } from '../types'

/**
 * IDENTITY-001: authorization server does not advertise agent-identity
 * propagation (RFC 8693 OAuth 2.0 Token Exchange).
 *
 * The problem Christophe Aboulicam (STOA) flagged publicly: an MCP
 * server used by an AI agent that is itself used by many end-users has
 * no way to identify WHICH user is behind a given tools/call unless the
 * agent can mint a token scoped to that user. OBO ("on-behalf-of") via
 * RFC 8693 token exchange is the standard mechanism: the agent presents
 * its own subject token plus a user assertion and gets back an access
 * token whose `sub` identifies the end user.
 *
 * Without it, every tools/call carries only the agent's identity. Audit
 * trails on the downstream system cannot attribute actions, per-user
 * rate limits cannot be applied, and multi-tenant isolation collapses to
 * "the agent has access to everything, we trust it to self-police".
 *
 * Metadata signal (RFC 8414 §2):
 *   `grant_types_supported` SHOULD include
 *   `urn:ietf:params:oauth:grant-type:token-exchange` when the AS
 *   supports OBO. Absence is not proof the AS cannot do OBO, but it is
 *   the only machine-readable signal clients have; a client that cannot
 *   discover OBO support will not attempt it.
 *
 * Severity: medium today. Rises to high for multi-tenant MCP servers
 * once we have a signal for multi-tenancy in the snapshot.
 *
 * Verification: source-confirmed (static read of AS metadata).
 */
const TOKEN_EXCHANGE_GRANT = 'urn:ietf:params:oauth:grant-type:token-exchange'

export const identity001: Check = {
  id: 'IDENTITY-001',
  severity: 'medium',
  title: 'Authorization server does not advertise agent-identity propagation (RFC 8693 token exchange)',
  run: (snapshot): CheckOutput[] => {
    const r = snapshot.remote
    if (!r || !r.oauthAuthServer) return []
    const meta = r.oauthAuthServer
    const grants = meta.grant_types_supported
    // When the field is entirely absent, RFC 8414 says the default is
    // ["authorization_code", "implicit"] — neither includes token-exchange,
    // so the finding still fires.
    const supportsTokenExchange = Array.isArray(grants) && grants.includes(TOKEN_EXCHANGE_GRANT)
    if (supportsTokenExchange) return []
    const listed = Array.isArray(grants) ? grants.join(', ') : '(field absent; RFC 8414 default is "authorization_code, implicit")'
    return [
      {
        id: 'IDENTITY-001',
        severity: 'medium',
        confidence: 'high',
        title: 'Agent-identity propagation not advertised: AS does not support RFC 8693 token exchange',
        evidence: `${r.url}'s authorization-server metadata does not list "${TOKEN_EXCHANGE_GRANT}" in grant_types_supported. Observed grant_types_supported: ${listed}. Without OBO/token-exchange, every tools/call from an AI agent carries only the agent's identity; the downstream MCP server cannot attribute actions to the end user, audit trails lose causality, and multi-tenant isolation becomes trust-based rather than token-based.`,
        fix: `Add "${TOKEN_EXCHANGE_GRANT}" to grant_types_supported in /.well-known/oauth-authorization-server and implement RFC 8693 at the token endpoint. Accept the agent's own access token plus a `
          + 'subject_token asserting the end-user identity, and return an access token whose `sub` identifies the end user.',
        docsUrl: 'https://patchbay-mcp.dev/docs/identity-001',
      },
    ]
  },
}

import type { Check, CheckOutput } from '../types'

/**
 * IDENTITY-002: authorization server advertises RFC 8693 token exchange
 * (good — IDENTITY-001 passes) but the token endpoint accepts
 * unauthenticated clients. Anyone who can reach the token endpoint can
 * mint an access token for any `sub` they assert in the subject token.
 *
 * The companion failure mode to IDENTITY-001. If an AS ships
 * token-exchange as its agent-identity story but leaves
 * token_endpoint_auth_methods_supported at ["none"] (or omits the field
 * and relies on the RFC 8414 default of "client_secret_basic" without
 * actually requiring auth), the OBO story is theatre: there is no
 * cryptographic binding between the exchanging client and the user
 * identity it is minting a token for.
 *
 * Severity: high. IDENTITY-001 is medium because the MISSING feature
 * only loses attribution; IDENTITY-002 is the stronger failure where the
 * feature is PRESENT but unauthenticated, so any party can forge a token
 * for any end user identity the AS is willing to issue.
 *
 * Verification: source-confirmed (static read of two AS metadata fields).
 */
const TOKEN_EXCHANGE_GRANT = 'urn:ietf:params:oauth:grant-type:token-exchange'

export const identity002: Check = {
  id: 'IDENTITY-002',
  severity: 'high',
  title: 'Token exchange advertised but token endpoint accepts unauthenticated clients',
  run: (snapshot): CheckOutput[] => {
    const r = snapshot.remote
    if (!r || !r.oauthAuthServer) return []
    const meta = r.oauthAuthServer
    const grants = meta.grant_types_supported
    if (!Array.isArray(grants) || !grants.includes(TOKEN_EXCHANGE_GRANT)) return []
    const methods = meta.token_endpoint_auth_methods_supported
    // RFC 8414 §2: when the field is omitted the default is
    // ["client_secret_basic"], which IS authenticated. Only fire when the
    // field is PRESENT and its only option is "none".
    if (!Array.isArray(methods)) return []
    const onlyNone = methods.length > 0 && methods.every((m) => m === 'none')
    if (!onlyNone) return []
    const issuer = typeof meta.issuer === 'string' ? meta.issuer : r.url
    return [
      {
        id: 'IDENTITY-002',
        severity: 'high',
        confidence: 'high',
        title: 'Token exchange advertised but token endpoint accepts unauthenticated clients',
        evidence: `${issuer} advertises "${TOKEN_EXCHANGE_GRANT}" in grant_types_supported, but token_endpoint_auth_methods_supported is ["none"]. Any client that reaches the token endpoint can perform a token exchange and assert an arbitrary subject identity in the subject_token; there is no cryptographic binding between the agent performing the exchange and the end-user identity it mints a token for. The OBO story works only if the AS can tell which agent is asking.`,
        fix: 'Require client authentication on the token endpoint for the token-exchange grant. Set token_endpoint_auth_methods_supported to one of ["client_secret_basic", "client_secret_post", "private_key_jwt", "tls_client_auth"] and enforce it. For public MCP clients that cannot keep a secret, use `tls_client_auth` with per-agent mTLS certificates or `private_key_jwt` with a per-agent key — never `none` for a grant that mints tokens on behalf of a third-party user identity.',
        docsUrl: 'https://patchbay-mcp.dev/docs/identity-002',
      },
    ]
  },
}

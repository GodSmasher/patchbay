import type { Check, CheckOutput } from '../types'

/**
 * UPSTREAM-IDENTITY-BYPASS-001: the server honors a client-supplied
 * identity header instead of enforcing its own upstream credential.
 *
 * Pattern first observed at scale in IBM ContextForge: CVE-2026-110278
 * and CVE-2026-110279 (CVSS 9.8 critical, both). The gateway was built
 * to proxy requests to a backend MCP server with the gateway's own
 * credentials — but when the client sent an `X-Upstream-User` header,
 * the gateway forwarded that header as the identity to the backend
 * instead of using the configured upstream credential. The client set
 * `X-Upstream-User: admin` and the backend trusted it.
 *
 * Patchbay probes any auth-required server by sending `tools/list` with
 * ONLY a forged identity header — no `Authorization: Bearer` — and
 * records the response. A server that normally requires a bearer but
 * accepts the forged header has the bug.
 *
 *   critical — accepted: server returned 200 to tools/list with only a
 *              forged identity header. Cross-tenant access path.
 *   silent — rejected (401/403): correct behavior.
 *   silent — notApplicable: server did not require auth in the first
 *            place; the forged header could not distinguish a bug from
 *            the public-by-design posture.
 */
/**
 * Methodology metadata — read by scripts/generate-methodology-matrix.mjs
 * at build time to regenerate the check-to-source table on /methodology.
 * Keep in sync with any change to this check or its severity rationale.
 */
export const METADATA = {
  id: 'UPSTREAM-IDENTITY-BYPASS-001',
  category: 'OAuth',
  primarySource: 'OAuth 2.1 §5.2 + patchbay client-supplied-identity-header attack-pattern',
  confidence: 'HIGH',
  published: true,
} as const

export const upstreamIdentityBypass001: Check = {
  id: 'UPSTREAM-IDENTITY-BYPASS-001',
  severity: 'critical',
  title: 'Server accepts client-supplied identity header without a real bearer',
  run: (snapshot): CheckOutput[] => {
    const r = snapshot.remote
    if (!r?.upstreamIdentityBypass?.attempted) return []
    const p = r.upstreamIdentityBypass
    if (p.outcome !== 'accepted') return []
    return [
      {
        id: 'UPSTREAM-IDENTITY-BYPASS-001',
        severity: 'critical',
        confidence: 'high',
        title: 'Server honors a client-supplied identity header without a real bearer',
        evidence:
          `${r.url} normally requires bearer authentication (${r.invalidTokenStatus === 401 ? 'returns 401 on missing bearer' : 'authRequired=true'}), `
          + `but accepted a tools/list request bearing only a forged \`${p.forgedHeader ?? 'X-Upstream-User'}: admin\` header and no Authorization. `
          + `Response: HTTP ${p.httpStatus ?? '2xx'}. `
          + 'Related to CVE-2026-110278 and CVE-2026-110279 (IBM ContextForge, CVSS 9.8): the server is routing on client-supplied identity instead of its own upstream credential. Any caller who guesses a valid upstream username can impersonate that account.',
        fix:
          'Never accept X-Upstream-User / X-Forwarded-User / X-Remote-User / X-User-Id / X-Authenticated-User as authoritative from the client. '
          + 'Either strip these headers at the ingress edge, or explicitly ignore them in the auth layer. '
          + 'Identity MUST come from a verified bearer, mTLS client cert, or an upstream proxy credential that the client cannot influence. '
          + 'If an upstream proxy legitimately injects these headers, pin the trusted proxy by IP + strip the headers on all other paths.',
        docsUrl: 'https://patchbay-mcp.dev/docs/upstream-identity-bypass-001',
      },
    ]
  },
}

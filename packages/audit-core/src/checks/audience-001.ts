import type { Check, Finding } from '../types'

/**
 * AUDIENCE-001: the server accepted a bearer token that was minted for a
 * different resource on the same authorisation server.
 *
 * RFC 8707 Section 2 covers how clients request audience-bound tokens.
 * RFC 9068 Section 4 (JWT Profile for OAuth 2.0 Access Tokens) requires
 * resource servers to reject any JWT whose `aud` does not contain their
 * resource identifier. MCP authorization spec revision 2025-06-18 makes
 * both mandatory for MCP servers. If a server accepts tokens whose `aud`
 * is a sibling resource at the same AS, any sibling service can replay
 * its tokens against this one. This cannot be caught by discovery
 * metadata (AUTH-004) alone, because a server can advertise
 * resource_indicators_supported without actually enforcing it at runtime.
 *
 * Idea credit: @Bloqarl on r/mcp. See issue #3.
 *
 * Only fires when the user supplied --probe-audience=<token> (or
 * PATCHBAY_PROBE_AUDIENCE_TOKEN env var). Without a probe token the
 * audit cannot test this behaviour and the check stays silent.
 */
export const audience001: Check = {
  id: 'AUDIENCE-001',
  severity: 'critical',
  title: 'Server accepts cross-audience bearer tokens',
  run: (snapshot): Finding[] => {
    const r = snapshot.remote
    if (!r || !r.audienceProbe || !r.audienceProbe.attempted) return []

    const p = r.audienceProbe

    if (p.outcome === 'rejected') return []

    if (p.outcome === 'accepted') {
      return [
        {
          id: 'AUDIENCE-001',
          severity: 'critical',
          confidence: 'high',
          title: 'Server accepts cross-audience bearer tokens',
          evidence: `tools/list was accepted at ${r.url} using a bearer token minted for a different resource on the same authorisation server (HTTP ${p.httpStatus}). Per RFC 9068 Section 4 and MCP authorization spec revision 2025-06-18, the server must validate the \`aud\` claim and reject tokens whose audience does not name its own resource identifier.`,
          fix: 'Validate the `aud` claim on every incoming bearer token. The expected audience is this MCP server\'s resource identifier (the one you advertise in /.well-known/oauth-protected-resource as `resource`). Reject with 401 any token whose `aud` does not match.',
          docsUrl: 'https://patchbay-mcp.dev/docs/audience-001',
        },
      ]
    }

    return [
      {
        id: 'AUDIENCE-001',
        severity: 'info',
        confidence: 'low',
        title: 'Cross-audience token probe inconclusive',
        evidence: `tools/list with the probe audience token returned ${p.httpStatus ?? 'no response'}${p.reason ? ` (${p.reason})` : ''}. Cannot tell whether the server enforces audience validation.`,
        fix: 'Retry the probe when the server is reachable, or use a different probe token.',
        docsUrl: 'https://patchbay-mcp.dev/docs/audience-001',
      },
    ]
  },
}

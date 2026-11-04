import type { Check, Finding } from '../types'

/**
 * AUDIENCE-001: the server accepted a bearer token that was minted for a
 * different resource on the same authorisation server.
 *
 * RFC 8707 Section 2 and OAuth 2.1 Section 5.6.3 require resource servers
 * to validate the `aud` claim on incoming tokens. If an MCP server accepts
 * tokens whose `aud` is a sibling resource at the same AS, any sibling
 * service can replay its tokens against this one. This is a "paper check"
 * that discovery metadata (AUTH-005) alone cannot catch, because a server
 * can advertise resource_indicators_supported without actually enforcing it.
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
          evidence: `tools/list was accepted at ${r.url} using a bearer token minted for a different resource on the same authorisation server (HTTP ${p.httpStatus}). Per RFC 8707 Section 2 and OAuth 2.1 Section 5.6.3, the server must validate the \`aud\` claim and reject tokens not minted for its own resource identifier.`,
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

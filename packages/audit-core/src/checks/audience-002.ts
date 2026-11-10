import type { Check, Finding } from '../types'

/**
 * AUDIENCE-002: server accepts a bearer token whose JWT payload has no
 * `aud` claim at all.
 *
 * AUDIENCE-001 catches the "no aud validation at all" and
 * "accepts wrong aud" cases. It does NOT catch a third failure mode,
 * raised by @Bloqarl on r/mcp as a follow-up: servers whose defensive
 * validation is written as
 *
 *   if (aud && aud !== me) reject
 *
 * A token with no `aud` claim makes the first condition false and skips
 * the reject. Those servers pass AUDIENCE-001 (they do reject tokens
 * with a wrong aud) while still accepting a token that names no audience.
 *
 * Per RFC 9068 Section 4, the resource server MUST reject any JWT whose
 * `aud` does not contain its identifier, and "not containing" covers
 * "not present."
 *
 * Opt-in active probe. Needs a validly signed bearer token for the same
 * authorization server whose JWT payload is missing the aud claim.
 * Without the probe token the audit cannot test this behaviour and the
 * check stays silent. See Issue #5.
 */
export const audience002: Check = {
  id: 'AUDIENCE-002',
  severity: 'critical',
  title: 'Server accepts bearer tokens with no audience claim',
  run: (snapshot): Finding[] => {
    const r = snapshot.remote
    if (!r || !r.missingAudProbe || !r.missingAudProbe.attempted) return []
    const p = r.missingAudProbe

    if (p.outcome === 'rejected') return []

    if (p.outcome === 'accepted') {
      return [
        {
          id: 'AUDIENCE-002',
          severity: 'critical',
          confidence: 'high',
          title: 'Server accepts bearer tokens with no audience claim',
          evidence: `tools/list was accepted at ${r.url} using a bearer token whose JWT payload has no \`aud\` claim at all (HTTP ${p.httpStatus}). Per RFC 9068 Section 4 the resource server MUST reject any JWT whose \`aud\` does not contain its identifier, and "not containing" includes "not present." A defensive check written as \`if (aud && aud !== me) reject\` has this early-exit bug.`,
          fix: 'Rewrite audience validation so a missing claim is a reject: `if (aud !== me) reject`, or for array audiences `if (!Array.isArray(aud) || !aud.includes(me)) reject`. Never fall back to accepting tokens that have no `aud` at all.',
          docsUrl: 'https://patchbay-mcp.dev/docs/audience-002',
        },
      ]
    }

    return [
      {
        id: 'AUDIENCE-002',
        severity: 'info',
        confidence: 'low',
        title: 'Missing-audience probe inconclusive',
        evidence: `tools/list with the missing-aud probe token returned ${p.httpStatus ?? 'no response'}${p.reason ? ` (${p.reason})` : ''}. Cannot tell whether the server enforces audience-claim presence.`,
        fix: 'Retry the probe when the server is reachable, or use a different probe token whose JWT payload is empty of `aud`.',
        docsUrl: 'https://patchbay-mcp.dev/docs/audience-002',
      },
    ]
  },
}

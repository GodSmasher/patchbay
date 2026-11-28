import type { Check, CheckOutput } from '../types'

/**
 * SESSION-BINDING-001: server-issued session IDs are reusable across
 * initialization contexts, or have low entropy.
 *
 * MCP's streamable-http transport uses an `Mcp-Session-Id` header to
 * route follow-up requests to a server-side session state. The transport
 * does not define how that ID must be bound: it is the server's job to
 * ensure each session ID is tied to the principal that created it
 * (bearer token, client credential, or the client-generated nonce from
 * initialize) and cannot be replayed from a different auth context.
 *
 * CVE-2026-52869 (MCP Python SDK) was exactly this gap: the SDK routed
 * on session ID alone and did not re-verify the caller's bearer. Any
 * principal who learned the ID could walk into the session.
 *
 * Patchbay probes two independent `initialize` calls from the same
 * source and inspects the returned `Mcp-Session-Id` headers. The check
 * fires on:
 *
 *   high — sameSession: both calls returned IDENTICAL session IDs.
 *          Either the server is reusing one global session, or it is
 *          deriving the ID from something the caller controls, not
 *          from the init context. Either way session isolation is
 *          broken.
 *
 *   medium — lowEntropy: both IDs are distinct but at least one is
 *            shorter than 128 bits of equivalent randomness (< 22
 *            base64-safe characters). Guessable session IDs convert a
 *            missing-auth bug into a session-hijack vector.
 *
 * Does not fire if the server does not use session IDs (`noSession`) —
 * other checks (AUTH-001, RESOURCE-001) cover that posture.
 */
/**
 * Methodology metadata — read by scripts/generate-methodology-matrix.mjs
 * at build time to regenerate the check-to-source table on /methodology.
 * Keep in sync with any change to this check or its severity rationale.
 */
export const METADATA = {
  id: 'SESSION-BINDING-001',
  category: 'Session',
  primarySource: 'OAuth 2.1 session fixation + patchbay deployment-mistake catalogue',
  confidence: 'MEDIUM',
  published: true,
} as const

export const sessionBinding001: Check = {
  id: 'SESSION-BINDING-001',
  severity: 'high',
  title: 'MCP session ID is reused or has low entropy',
  run: (snapshot): CheckOutput[] => {
    const r = snapshot.remote
    if (!r?.sessionBinding?.attempted) return []
    const p = r.sessionBinding
    if (p.outcome === 'sameSession') {
      return [
        {
          id: 'SESSION-BINDING-001',
          severity: 'high',
          confidence: 'high',
          title: 'Server reuses the same MCP session ID across initialize calls',
          evidence:
            `${r.url} returned the same \`Mcp-Session-Id\` (${p.firstSessionId ?? '?'}) on two independent initialize calls. `
            + 'Either the server exposes one shared session to every caller or the ID is derived from something the caller controls. '
            + 'Related to CVE-2026-52869 (MCP Python SDK session confusion): a session ID that is not bound to the init context lets any principal who learns it walk into the session.',
          fix:
            'Generate a fresh, cryptographically-random session ID per initialize call. Bind the session ID to the principal that created it (bearer token, client credential, or a fresh nonce from the init request). Reject any request whose `Mcp-Session-Id` was not issued to the presenting principal.',
          docsUrl: 'https://patchbay-mcp.dev/docs/session-binding-001',
        },
      ]
    }
    if (p.outcome === 'lowEntropy') {
      return [
        {
          id: 'SESSION-BINDING-001',
          severity: 'medium',
          confidence: 'medium',
          title: 'MCP session ID is shorter than 128 bits of equivalent entropy',
          evidence:
            `${r.url} returned distinct session IDs on two initialize calls, but at least one is below 22 base64-safe characters (~128 bits). `
            + `Observed: ${p.firstSessionId ?? '?'} / ${p.secondSessionId ?? '?'}. `
            + 'A guessable session ID turns a missing-auth gap elsewhere into a session-hijack path. The MCP transport spec does not mandate a specific length; 128 bits is the floor.',
          fix:
            'Use at least 16 bytes of cryptographic randomness (encoded as 22+ base64 / 32+ hex chars) for every `Mcp-Session-Id`. Node `crypto.randomUUID()` is fine; a 10-char alphanumeric is not.',
          docsUrl: 'https://patchbay-mcp.dev/docs/session-binding-001',
        },
      ]
    }
    return []
  },
}

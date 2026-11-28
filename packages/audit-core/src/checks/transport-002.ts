import type { Check, CheckOutput } from '../types'

/**
 * Methodology metadata — read by scripts/generate-methodology-matrix.mjs
 * at build time to regenerate the check-to-source table on /methodology.
 * Keep in sync with any change to this check or its severity rationale.
 */
export const METADATA = {
  id: 'TRANSPORT-002',
  category: 'Transport',
  primarySource: 'Fetch CORS semantics + patchbay foreign-origin heuristic',
  confidence: 'MEDIUM',
  published: true,
} as const

export const transport002: Check = {
  id: 'TRANSPORT-002',
  severity: 'medium',
  title: 'Missing Origin validation',
  run: (snapshot): CheckOutput[] => {
    const r = snapshot.remote
    if (!r || !r.reachable) return []
    if (r.originValidation !== 'permissive') return []
    return [
      {
        id: 'TRANSPORT-002',
        severity: 'low',
        confidence: 'medium',
        title: 'Server does not reject spoofed Origin header',
        evidence: `${r.url} answered a tools/list call with Origin: https://attacker.example without rejecting it. Only relevant for servers intended to accept browser clients; server-to-server MCP endpoints do not need Origin validation.`,
        fix: 'If this endpoint can be called from browser clients (Streamable HTTP in a webapp), validate the Origin header against an allowlist. Otherwise ignore this finding.',
        docsUrl: 'https://patchbay-mcp.dev/docs/transport-002',
      },
    ]
  },
}

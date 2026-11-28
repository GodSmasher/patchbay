import type { Check, CheckOutput } from '../types'

/**
 * Methodology metadata — read by scripts/generate-methodology-matrix.mjs
 * at build time to regenerate the check-to-source table on /methodology.
 * Keep in sync with any change to this check or its severity rationale.
 */
export const METADATA = {
  id: 'SCOPE-001',
  category: 'OAuth',
  primarySource: 'OAuth 2.1 §3.3 + least-privilege scope recommendation',
  confidence: 'MEDIUM',
  published: true,
} as const

export const scope001: Check = {
  id: 'SCOPE-001',
  severity: 'high',
  title: 'No per-tool scopes',
  run: (snapshot): CheckOutput[] => {
    const r = snapshot.remote
    const d = snapshot.directory
    if (d?.scopeManifest) {
      const unique = new Set<string>()
      for (const scopes of Object.values(d.scopeManifest)) for (const s of scopes) unique.add(s)
      const toolCount = Object.keys(d.scopeManifest).length
      if (toolCount >= 2 && unique.size <= 1) {
        return [finding(`${toolCount} tools share a single scope in scopes.json (${[...unique].join(', ') || 'none'}).`)]
      }
      return []
    }
    if (r && r.tools.length >= 2) {
      const hasOAuthContext = Boolean(r.oauthAuthServer || r.oauthProtectedResource)
      if (!hasOAuthContext) return []
      const anyScope = r.tools.some((t) => Array.isArray(t.scopes) && t.scopes.length > 0)
      if (!anyScope) return [finding(`${r.tools.length} tools listed via tools/list on an OAuth-protected server, none declare scopes.`)]
      const first = JSON.stringify((r.tools[0]?.scopes ?? []).slice().sort())
      const allSame = r.tools.every((t) => JSON.stringify((t.scopes ?? []).slice().sort()) === first)
      if (allSame) return [finding(`All ${r.tools.length} tools share the same scope set ${first}.`)]
    }
    return []
  },
}

function finding(evidence: string): CheckOutput {
  return {
    id: 'SCOPE-001',
    severity: 'high',
    confidence: 'high',
    title: 'No per-tool scopes declared',
    evidence,
    fix: 'Give every tool its own OAuth scope (`tool:name:action`). Reject tool calls whose token lacks the required scope.',
    docsUrl: 'https://patchbay-mcp.dev/docs/scope-001',
    autofixTemplate: 'scopes',
  }
}

import type { Check, Finding } from '../types'
import { hasWriteTools } from './tool-shapes'

export const auth001: Check = {
  id: 'AUTH-001',
  severity: 'critical',
  title: 'No authentication required',
  run: (snapshot): Finding[] => {
    const r = snapshot.remote
    if (!r || !r.reachable) return []
    if (!r.toolsListOk) return []
    if (r.authRequired) return []

    if (r.publicByDesign) {
      return [
        {
          id: 'AUTH-001',
          severity: 'info',
          confidence: 'high',
          title: 'Public, documented no-auth pattern',
          evidence: `tools/list returned ${r.tools.length} tool(s) without credentials at ${r.url}. The server publishes /.well-known/ai-catalog.json declaring this is intentional (${r.publicByDesignEvidence ?? 'no-auth posture'}). No fix needed.`,
          fix: 'If this server mutates state on behalf of the caller rather than the end-user (e.g. a broker that signs on behalf of a wallet), the ai-catalog declaration is misleading; serve OAuth 2.1 instead.',
          docsUrl: 'https://patchbay-mcp.dev/docs/auth-001',
        },
      ]
    }

    // Hosts whose auth model is transport-layer IAM, not MCP bearer tokens.
    // tools/list is public discovery; tools/call always requires credentials via
    // the hosting platform's own auth layer (Google SA, AWS SigV4, Azure AAD).
    // Reporting AUTH-001 critical here is a false positive the scanner cannot
    // tell apart without attempting a mutating call, which we refuse to do.
    const iamHostPatterns: Array<{ pattern: RegExp; platform: string }> = [
      { pattern: /\.googleapis\.com$/, platform: 'Google Cloud IAM' },
      { pattern: /\.amazonaws\.com$|\.api\.aws$/, platform: 'AWS SigV4' },
      { pattern: /\.azure\.com$|\.azure-api\.net$/, platform: 'Azure AAD' },
    ]
    let iamPlatform: string | null = null
    try {
      const host = new URL(r.url).hostname
      for (const { pattern, platform } of iamHostPatterns) {
        if (pattern.test(host)) { iamPlatform = platform; break }
      }
    } catch {}
    if (iamPlatform) {
      return [
        {
          id: 'AUTH-001',
          severity: 'info',
          confidence: 'medium',
          title: `Platform-IAM-protected (${iamPlatform})`,
          evidence: `tools/list returned ${r.tools.length} tool(s) without MCP-level credentials at ${r.url}. Host matches ${iamPlatform} pattern: the authentication layer is enforced by the hosting platform (service accounts, signed requests, or managed identities), not by MCP bearer tokens. tools/list is discovery; tools/call requires platform credentials.`,
          fix: 'No action needed if the host truly enforces IAM on tools/call. patchbay does not attempt mutating calls to verify, so this is downgraded to info rather than critical.',
          docsUrl: 'https://patchbay-mcp.dev/docs/auth-001',
        },
      ]
    }

    const writes = hasWriteTools(r.tools)
    if (!writes) {
      return [
        {
          id: 'AUTH-001',
          severity: 'info',
          confidence: 'medium',
          title: 'Public read-only server (no auth)',
          evidence: `tools/list returned ${r.tools.length} tool(s) without credentials at ${r.url}. All tool names look read-only (get/list/search/...). This is a documented pattern for public data servers, not necessarily a vulnerability.`,
          fix: 'If this server is intended to be public and read-only, no action needed. If any tool mutates state, add OAuth 2.1.',
          docsUrl: 'https://patchbay-mcp.dev/docs/auth-001',
        },
      ]
    }

    const writeTools = r.tools.filter((t) => hasWriteTools([t])).map((t) => t.name).slice(0, 5)
    return [
      {
        id: 'AUTH-001',
        severity: 'critical',
        confidence: 'high',
        title: 'No authentication required (server has write tools)',
        evidence: `tools/list returned ${r.tools.length} tool(s) without credentials at ${r.url}. Mutating tool(s) detected: ${writeTools.join(', ')}${r.tools.length > 5 ? ', …' : ''}.`,
        fix: 'Require OAuth 2.1 bearer tokens. Serve /.well-known/oauth-protected-resource and reject unauthenticated requests on initialize and tools/* endpoints.',
        docsUrl: 'https://patchbay-mcp.dev/docs/auth-001',
        autofixTemplate: 'oauth21',
      },
    ]
  },
}

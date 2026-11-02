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
          docsUrl: 'https://patchbay.dev/docs/auth-001',
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
        docsUrl: 'https://patchbay.dev/docs/auth-001',
        autofixTemplate: 'oauth21',
      },
    ]
  },
}

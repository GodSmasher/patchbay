import type { Check, Finding } from '../types'

export const auth001: Check = {
  id: 'AUTH-001',
  severity: 'critical',
  title: 'No authentication required',
  run: (snapshot): Finding[] => {
    const r = snapshot.remote
    if (!r || !r.reachable) return []
    if (!r.toolsListOk) return []
    if (r.authRequired) return []
    return [
      {
        id: 'AUTH-001',
        severity: 'critical',
        confidence: 'high',
        title: 'No authentication required',
        evidence: `tools/list returned ${r.tools.length} tool(s) without credentials at ${r.url}.`,
        fix: 'Require OAuth 2.1 bearer tokens. Serve /.well-known/oauth-protected-resource and reject unauthenticated requests on initialize and tools/* endpoints.',
        docsUrl: 'https://patchbay.dev/docs/auth-001',
        autofixTemplate: 'oauth21',
      },
    ]
  },
}

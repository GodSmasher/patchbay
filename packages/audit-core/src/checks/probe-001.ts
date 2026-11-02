import type { Check, Finding } from '../types'

export const probe001: Check = {
  id: 'PROBE-001',
  severity: 'info',
  title: 'Probe inconclusive',
  run: (snapshot): Finding[] => {
    const r = snapshot.remote
    if (!r) return []
    if (!r.reachable) {
      return [finding(`Server did not respond to any request. ${r.rawErrors.length} error(s) captured.`, r.rawErrors)]
    }
    const anySignal = r.initializeOk || r.toolsListOk || r.oauthAuthServer || r.oauthProtectedResource || (r.acceptedAuthHeader && r.acceptedAuthHeader !== 'none')
    if (anySignal) return []
    if (r.authRequired) {
      return [{
        id: 'PROBE-001',
        severity: 'info',
        confidence: 'high',
        title: 'Auth-walled server — not audited',
        evidence: `${r.url} requires authentication before any MCP endpoint responds. patchbay has no credentials, so auth posture beyond "auth is enforced" cannot be judged. This is the expected state for a correctly configured OAuth 2.1 server.`,
        fix: 'No action needed if the server is intentionally gated. To audit deeper, pass credentials via (not yet implemented) --auth flag.',
        docsUrl: 'https://patchbay-mcp.dev/docs/probe-001',
      }]
    }
    return [finding(
      `Server at ${r.url} responded but no MCP initialize, no tools/list and no /.well-known/oauth-* metadata succeeded. The probe cannot judge auth posture. "0 findings" below does NOT mean clean.`,
      r.rawErrors,
    )]
  },
}

function finding(evidence: string, rawErrors: string[]): Finding {
  const errSuffix = rawErrors.length > 0 ? ` First error: ${rawErrors[0]}` : ''
  return {
    id: 'PROBE-001',
    severity: 'info',
    confidence: 'high',
    title: 'Probe inconclusive — cannot judge auth posture',
    evidence: evidence + errSuffix,
    fix: 'Check the URL. The server may use a different transport (SSE / Streamable HTTP GET), require auth before any endpoint responds, or sit behind a path like /sse or /messages. Re-run with --json to inspect the raw snapshot.',
    docsUrl: 'https://patchbay-mcp.dev/docs/probe-001',
  }
}

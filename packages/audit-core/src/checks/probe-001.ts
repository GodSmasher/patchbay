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
    const anySignal = r.initializeOk || r.toolsListOk || r.oauthAuthServer || r.oauthProtectedResource
    if (anySignal) return []
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
    docsUrl: 'https://patchbay.dev/docs/probe-001',
  }
}

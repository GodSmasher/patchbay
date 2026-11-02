import type { Check, Finding } from '../types'

export const transport001: Check = {
  id: 'TRANSPORT-001',
  severity: 'high',
  title: 'Remote server reachable over plain HTTP',
  run: (snapshot): Finding[] => {
    const r = snapshot.remote
    if (!r) return []
    if (r.usesTls) return []
    if (/^http:\/\/(localhost|127\.0\.0\.1|\[?::1\]?)([:/]|$)/i.test(r.url)) return []
    return [
      {
        id: 'TRANSPORT-001',
        severity: 'high',
        confidence: 'high',
        title: 'Server reachable over plain HTTP',
        evidence: `${r.url} is served without TLS. Bearer tokens traverse the wire in cleartext.`,
        fix: 'Serve the MCP endpoint over HTTPS only. Redirect or reject plain HTTP.',
        docsUrl: 'https://patchbay-mcp.dev/docs/transport-001',
      },
    ]
  },
}

import type { Check, Finding } from '../types'

export const transport002: Check = {
  id: 'TRANSPORT-002',
  severity: 'medium',
  title: 'Missing Origin validation',
  run: (snapshot): Finding[] => {
    const r = snapshot.remote
    if (!r || !r.reachable) return []
    if (r.originValidation !== 'permissive') return []
    return [
      {
        id: 'TRANSPORT-002',
        severity: 'medium',
        confidence: 'medium',
        title: 'Server accepts spoofed Origin header',
        evidence: `${r.url} answered a tools/list call with Origin: https://attacker.example as if it came from an allowed origin. Local MCP servers are vulnerable to DNS rebinding when they accept arbitrary origins.`,
        fix: 'Validate the Origin header against an allowlist on Streamable HTTP endpoints. Reject requests whose Origin is unknown.',
        docsUrl: 'https://patchbay.dev/docs/transport-002',
      },
    ]
  },
}

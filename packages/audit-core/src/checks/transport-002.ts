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
        severity: 'low',
        confidence: 'medium',
        title: 'Server does not reject spoofed Origin header',
        evidence: `${r.url} answered a tools/list call with Origin: https://attacker.example without rejecting it. Only relevant for servers intended to accept browser clients; server-to-server MCP endpoints do not need Origin validation.`,
        fix: 'If this endpoint can be called from browser clients (Streamable HTTP in a webapp), validate the Origin header against an allowlist. Otherwise ignore this finding.',
        docsUrl: 'https://patchbay.dev/docs/transport-002',
      },
    ]
  },
}

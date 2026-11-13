import type { Check, Finding } from '../types'

/**
 * DEPRECATED-001: server still negotiates capabilities that were marked
 * deprecated in MCP 2026-07-28.
 *
 * Specifically: `logging` (server emits logs into the client's context,
 * same injection surface as a poisoned resource) and `roots` (client
 * exposes filesystem roots to the server). Both are scheduled for
 * earliest removal 2027-07-28. A server still advertising them is a
 * leading indicator that it has not kept up with the spec in roughly
 * the last 4 months; such servers tend to lag on other hardening work
 * too. Info severity on its own, but flagged so operators can plan the
 * migration before the removal window.
 */
export const deprecated001: Check = {
  id: 'DEPRECATED-001',
  severity: 'low',
  title: 'Server advertises deprecated MCP capabilities',
  run: (snapshot): Finding[] => {
    const caps = snapshot.remote?.advertisedCapabilities
    if (!caps || typeof caps !== 'object') return []

    const deprecatedCaps = ['logging', 'roots']
      .filter((c) => c in (caps as Record<string, unknown>))
    if (deprecatedCaps.length === 0) return []

    return [{
      id: 'DEPRECATED-001',
      severity: 'low',
      confidence: 'high',
      title: 'Server advertises ' + deprecatedCaps.length + ' deprecated capabilit' + (deprecatedCaps.length === 1 ? 'y' : 'ies'),
      evidence: 'The server advertises deprecated capabilities: ' + deprecatedCaps.map((c) => '`' + c + '`').join(', ') + '. Per MCP 2026-07-28 these are scheduled for earliest removal on 2027-07-28. `logging` lets the server stream arbitrary text into the client\'s context (same injection surface as POISONING-002); `roots` has the client expose filesystem roots to the server. Operators that still negotiate these tend to lag on other hardening work too.',
      fix: 'Remove the deprecated capability from the server\'s advertised set if it is unused (common SDK-template leftover). Plan a replacement before the removal window: structured progress / result messages instead of `logging`; explicit resource URIs instead of `roots`.',
      docsUrl: 'https://patchbay-mcp.dev/docs/deprecated-001',
    }]
  },
}

import type { Check, CheckOutput } from '../types'

/**
 * SAMPLING-001: server advertises the `sampling` capability, which lets
 * the server request LLM completions from the client's model.
 *
 * In MCP 2026-07-28 the sampling capability is scheduled for removal
 * on or after 2027-07-28. Even while it lives, the attack surface is
 * notable: the server inserts prompts into the client's model without
 * any boundary between user-originated and server-originated prompts,
 * which is a direct prompt-injection pathway and a quota-exfiltration
 * surface (the client pays for completions the server demanded).
 *
 * Severity medium with info downgrade when the server is on the
 * deprecated train but not actively using sampling for anything
 * sensitive. Real-world: most MCPs that advertise sampling do so
 * because an SDK template left it on, not because they need it.
 */
/**
 * Methodology metadata — read by scripts/generate-methodology-matrix.mjs
 * at build time to regenerate the check-to-source table on /methodology.
 * Keep in sync with any change to this check or its severity rationale.
 */
export const METADATA = {
  id: 'SAMPLING-001',
  category: 'MCP',
  primarySource: 'MCP spec §sampling capability deprecation notice',
  confidence: 'HIGH',
  published: true,
} as const

export const sampling001: Check = {
  id: 'SAMPLING-001',
  severity: 'medium',
  title: 'Server advertises deprecated sampling capability',
  run: (snapshot): CheckOutput[] => {
    const caps = snapshot.remote?.advertisedCapabilities
    if (!caps || typeof caps !== 'object') return []
    if (!('sampling' in caps)) return []
    return [{
      id: 'SAMPLING-001',
      severity: 'medium',
      confidence: 'high',
      title: 'Server advertises the deprecated sampling capability',
      evidence: 'The server\'s initialize response advertises the `sampling` capability. Per MCP 2026-07-28 sampling is deprecated and scheduled for earliest removal 2027-07-28. While it is still in use, server-originated completions reach the client\'s model with no boundary against user-originated prompts, giving the server a direct prompt-injection pathway and the ability to run completions on the client\'s quota.',
      fix: 'Remove `sampling` from the server capabilities if the server does not actually use it (common SDK-template leftover). If the server genuinely needs to delegate completions to the client, document the exact use case, enforce human-in-the-loop on every sampling request client-side, and plan a migration off sampling before the 2027-07-28 removal window.',
      docsUrl: 'https://patchbay-mcp.dev/docs/sampling-001',
    }]
  },
}

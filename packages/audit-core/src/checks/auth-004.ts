import type { Check, Finding } from '../types'

/**
 * AUTH-004 (RETIRED in audit-core 0.3.4, 2026-11-10).
 *
 * Previously checked the authorization-server metadata for a
 * `resource_indicators_supported: true` flag. After verification against
 * RFC 8707, RFC 9728, the IANA OAuth Authorization Server Metadata
 * registry, and MCP authorization spec revision 2026-07-28, no spec or
 * RFC defines a `resource_indicators_supported` metadata field.
 *
 * The MCP 2026-07-28 spec explicitly says clients "MUST send [the
 * resource] parameter regardless of whether authorization servers
 * support it," which means absence of such a flag conveys nothing about
 * server behaviour, and its presence would convey nothing standardised
 * either.
 *
 * AUDIENCE-001 (opt-in active probe) remains the authoritative check
 * for whether a server actually validates the `aud` claim.
 *
 * The ID is retained so already-stored reports keep resolving, but the
 * check now returns no findings.
 */
export const auth004: Check = {
  id: 'AUTH-004',
  severity: 'info',
  title: 'Resource indicators metadata flag (retired)',
  run: (): Finding[] => [],
}

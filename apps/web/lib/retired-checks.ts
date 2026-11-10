import type { AuditReport, Finding, Severity } from '@patchbay-nebius/audit-core'

/**
 * Check IDs that used to fire but have been retired. Stored reports still
 * contain their findings; when we re-render those reports we strip the
 * retired findings so the displayed score, grade and finding list reflect
 * the current check set.
 *
 * Add an entry here when a check is retired in audit-core. Do NOT remove
 * entries, because old reports in Vercel KV may still reference the ID.
 */
export const RETIRED_CHECKS: ReadonlySet<string> = new Set([
  'AUTH-004', // retired in audit-core 0.3.4 (2026-11-10): the
              // resource_indicators_supported metadata flag it checked
              // is not defined by any RFC or MCP spec revision.
])

/**
 * Return a view of the report with retired findings stripped and the
 * summary recomputed. Does not mutate the input. Safe to call on a report
 * that has no retired findings (returns the same shape).
 */
export function applyRetirements(report: AuditReport): AuditReport {
  const liveFindings = report.findings.filter((f) => !RETIRED_CHECKS.has(f.id))
  if (liveFindings.length === report.findings.length) return report

  const summary: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  for (const f of liveFindings) summary[f.severity]++

  return { ...report, findings: liveFindings, summary }
}

export type { AuditReport, Finding }

import { ALL_CHECKS } from './checks'
import { probeDirectory } from './probe/directory'
import { probeRemote } from './probe/remote'
import type { AuditReport, Check, Finding, Severity, TargetSnapshot } from './types'

export type { AuditReport, Check, Finding, Severity, TargetSnapshot } from './types'
export { ALL_CHECKS } from './checks'
export { probeRemote, probeDirectory } from './probe'
export { renderTerminal, renderJson, renderSarif, renderMarkdown } from './report'

export interface AuditOptions {
  checks?: Check[]
  timeoutMs?: number
  /**
   * Bearer token for auth-walled servers. When set, the remote probe sends
   * `Authorization: Bearer <token>` on every request, so the audit can walk
   * past the auth gate (Linear, Notion, Supabase, Sentry, your own
   * OAuth-protected MCP) instead of reporting "auth-walled, not audited".
   * Ignored for directory targets.
   */
  authToken?: string
}

export async function auditTarget(target: string, opts: AuditOptions = {}): Promise<AuditReport> {
  const start = Date.now()
  const snapshot = await resolveTarget(target, opts)
  return runChecks(snapshot, opts.checks ?? ALL_CHECKS, start)
}

export function auditSnapshot(snapshot: TargetSnapshot, checks: Check[] = ALL_CHECKS): AuditReport {
  return runChecks(snapshot, checks, Date.now())
}

async function resolveTarget(target: string, opts: AuditOptions): Promise<TargetSnapshot> {
  if (/^https?:\/\//i.test(target)) return probeRemote(target, { timeoutMs: opts.timeoutMs, authToken: opts.authToken })
  return probeDirectory(target)
}

function runChecks(snapshot: TargetSnapshot, checks: Check[], start: number): AuditReport {
  const findings: Finding[] = []
  for (const c of checks) {
    try { findings.push(...c.run(snapshot)) }
    catch (e) {
      findings.push({
        id: c.id,
        severity: 'info',
        confidence: 'low',
        title: `Check ${c.id} crashed`,
        evidence: (e as Error).message,
        fix: 'Report this to patchbay.',
        docsUrl: 'https://patchbay-mcp.dev/docs/check-crashed',
      })
    }
  }
  findings.sort((a, b) => sevRank(a.severity) - sevRank(b.severity))
  const summary: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  for (const f of findings) summary[f.severity]++
  return {
    target: snapshot.target,
    kind: snapshot.kind,
    findings,
    summary,
    durationMs: Date.now() - start,
    capturedAt: snapshot.capturedAt,
    snapshot,
  }
}

function sevRank(s: Severity): number {
  return { critical: 0, high: 1, medium: 2, low: 3, info: 4 }[s]
}

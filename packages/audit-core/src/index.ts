import { ALL_CHECKS } from './checks'
import { probeDirectory } from './probe/directory'
import { probeRemote } from './probe/remote'
import { probeStdio } from './probe/stdio'
import type { AuditReport, Check, Finding, Severity, TargetSnapshot } from './types'

export type {
  AuditReport, AudienceProbeResult, Check, Finding, Severity, StdioProbe, TargetSnapshot,
  ManifestDelta, ManifestDeltaItem, ManifestDeltaKind, ManifestEntry, ToolDescriptor,
} from './types'
export { ALL_CHECKS } from './checks'
export { probeRemote, probeDirectory, probeStdio, parseCommand } from './probe'
export { renderTerminal, renderJson, renderSarif, renderMarkdown } from './report'
export {
  canonicalise, canonicaliseTools, hashManifest, diffManifest,
  serverIdFromUrl, serverIdFromStdio,
} from './lib/manifest'
export {
  fileManifestStore, memoryManifestStore, defaultManifestDir, makeEntry,
  type ManifestStore,
} from './lib/manifest-store'
export { score, letterGrade, gradeColor, WEIGHTS, type LetterGrade } from './lib/score'

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
  /**
   * When true, overwrite the pinned manifest with the current scan instead
   * of running MANIFEST-001's diff. Use after a legitimate server update.
   */
  trustCurrentManifest?: boolean
  /**
   * Bearer token minted for a DIFFERENT resource on the same AS. Used by
   * AUDIENCE-001 to verify cross-audience rejection per RFC 8707. Ignored
   * for directory targets.
   */
  probeAudienceToken?: string
  /**
   * Bearer token whose JWT payload contains NO `aud` claim at all. Used
   * by AUDIENCE-002 to catch the early-exit validation bug
   * `if (aud && aud !== me) reject`. Ignored for directory targets.
   */
  probeMissingAudToken?: string
  /**
   * When true, AUTH-006 actively registers a throw-away client against the
   * authorisation server's registration_endpoint with loopback redirect
   * URIs to verify RFC 8252 Section 7.3 compliance. Off by default because
   * it writes to the AS.
   */
  probeDcrLoopback?: boolean
  /**
   * When true, opts into the headless OAuth 2.1 conformance battery
   * (PKCE-001, PKCE-002, IMPLICIT-001, REDIRECT-002). Registers a
   * throw-away client via DCR, then sends four crafted /authorize
   * requests and records how the server responded. Off by default
   * because it writes to the AS and fires GET requests at /authorize.
   */
  probeHeadlessOauth?: boolean
  /**
   * When true, the probe calls tools/call on tools whose annotations
   * and schema signal "safe to call without arguments" and scans the
   * result content for POISONING-003 patterns. Off by default because
   * invocation has side effects even on "safe" tools.
   */
  probeToolCalls?: boolean
  /**
   * When set, `target` is treated as a shell command to spawn as an MCP
   * server over stdio, not as a URL or directory. Enables MANIFEST-001
   * for Claude Desktop-style MCP servers.
   */
  stdio?: boolean
  /**
   * Public-metadata-only mode. Skips every probe that would require an
   * authenticated tools/list response — we never touch tools/list at all,
   * and we skip anything that needs tool-level evidence (POISONING-001,
   * SCOPE-001/002, AUTH-001 downgrade logic). Reads only the RFC 9728 PRM
   * and RFC 8414 AS metadata documents, plus response headers. Intended
   * for the leaderboard crawler against login-walled servers where we do
   * not want to send any request a spec-compliant unauthenticated client
   * would not already make.
   */
  metadataOnly?: boolean
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
  if (opts.stdio) {
    return probeStdio(target, {
      timeoutMs: opts.timeoutMs,
      trustCurrentManifest: opts.trustCurrentManifest,
    })
  }
  if (/^https?:\/\//i.test(target)) {
    return probeRemote(target, {
      timeoutMs: opts.timeoutMs,
      authToken: opts.authToken,
      trustCurrentManifest: opts.trustCurrentManifest,
      probeAudienceToken: opts.probeAudienceToken,
      probeMissingAudToken: opts.probeMissingAudToken,
      probeDcrLoopback: opts.probeDcrLoopback,
      probeHeadlessOauth: opts.probeHeadlessOauth,
      probeToolCalls: opts.probeToolCalls,
      metadataOnly: opts.metadataOnly,
    })
  }
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

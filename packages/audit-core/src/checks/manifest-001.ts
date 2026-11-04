import type { Check, Finding, ManifestDelta, ManifestDeltaItem, Severity, ToolDescriptor } from '../types'
import { hasWriteTools } from './tool-shapes'

/**
 * MANIFEST-001: the tool manifest for this server changed since last run.
 *
 * Run-after-approve attack surface: a server the user already approved
 * quietly adds a write tool, or an existing read tool gains a
 * `command` / `path` param, or a description starts telling the model
 * what to do. All of these are harder to notice than a brand-new server
 * showing up, and all of them are caught by hashing the tool set on
 * first-approve and diffing on subsequent runs.
 *
 * Idea credit: @WallaceGrommet on r/ClaudeAI.
 *
 * Severity grid (highest tier wins per run):
 *   new write-shaped tool                            critical
 *   existing read tool gains write-shaped param      critical
 *   existing tool description changes                medium
 *   existing tool inputSchema changes (structure)    low
 *   new read tool                                    low
 *   tool removed                                     info
 */
export const manifest001: Check = {
  id: 'MANIFEST-001',
  severity: 'medium',
  title: 'Tool manifest changed since last run',
  run: (snapshot): Finding[] => {
    const r = snapshot.remote
    if (!r || !r.manifestDelta || r.manifestDelta.changes.length === 0) return []

    const delta = r.manifestDelta
    const severity = highestSeverity(delta, r.tools)
    const evidence = renderEvidence(delta)
    const fix = renderFix(delta, severity)

    return [
      {
        id: 'MANIFEST-001',
        severity,
        confidence: 'high',
        title: titleFor(severity, delta),
        evidence,
        fix,
        docsUrl: 'https://patchbay-mcp.dev/docs/manifest-001',
      },
    ]
  },
}

function highestSeverity(delta: ManifestDelta, currentTools: ToolDescriptor[]): Severity {
  let sev: Severity = 'info'
  for (const c of delta.changes) {
    const kind = classifyChange(c, currentTools)
    if (sevRank(kind) < sevRank(sev)) sev = kind
  }
  return sev
}

function classifyChange(change: ManifestDeltaItem, currentTools: ToolDescriptor[]): Severity {
  if (change.kind === 'tool-added') {
    const tool = currentTools.find((t) => t.name === change.toolName)
    return tool && hasWriteTools([tool]) ? 'critical' : 'low'
  }
  if (change.kind === 'tool-removed') return 'info'
  if (change.kind === 'description-changed') return 'medium'
  if (change.kind === 'input-schema-changed') {
    if (change.detail && change.detail.startsWith('new params:')) {
      const params = change.detail.replace('new params:', '').trim().split(/,\s*/)
      if (params.some(isWriteParam)) return 'critical'
    }
    return 'low'
  }
  return 'info'
}

const WRITE_PARAM_TOKENS = /^(command|cmd|path|filepath|script|exec|execute|eval|code|shell|query|sql|url|endpoint|redirect|destination|target|output|outfile|action)$/i

function isWriteParam(param: string): boolean {
  return WRITE_PARAM_TOKENS.test(param.trim())
}

function titleFor(severity: Severity, delta: ManifestDelta): string {
  const n = delta.changes.length
  if (severity === 'critical') return `Tool manifest changed, ${n} delta(s), at least one high-risk`
  if (severity === 'medium') return `Tool manifest changed, ${n} delta(s), includes description change`
  return `Tool manifest changed, ${n} delta(s)`
}

function renderEvidence(delta: ManifestDelta): string {
  const lines: string[] = []
  lines.push(`Pinned on ${delta.firstSeen}. Current hash differs:`)
  lines.push(`  pinned:  ${delta.pinnedHash}`)
  lines.push(`  current: ${delta.currentHash}`)
  lines.push('')
  lines.push('Changes:')
  for (const c of delta.changes) {
    const detail = c.detail ? ` (${c.detail})` : ''
    lines.push(`  - ${c.kind}: ${c.toolName}${detail}`)
  }
  return lines.join('\n')
}

function renderFix(delta: ManifestDelta, severity: Severity): string {
  const base = `Review the delta above. If every change is expected (you updated the server on purpose), re-pin the manifest with:
  patchbay audit <this-url> --trust

If a change is unexpected, do NOT re-pin. The server may have been updated silently. Check the server's release notes or, for a self-hosted server, its deployment log.`
  if (severity === 'critical') {
    return `This is a critical delta: either a new write-shaped tool appeared, or an existing read tool gained a write-shaped parameter (command, path, exec, etc). ${base}`
  }
  return base
}

function sevRank(s: Severity): number {
  return { critical: 0, high: 1, medium: 2, low: 3, info: 4 }[s]
}

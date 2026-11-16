import type { AuditReport, Finding, FindingVerification, Severity } from '../types'

const CSI = '\x1b['
const RESET = `${CSI}0m`
const DIM = `${CSI}2m`
const COLOR: Record<Severity, string> = {
  critical: `${CSI}31;1m`,
  high: `${CSI}31m`,
  medium: `${CSI}33m`,
  low: `${CSI}2m`,
  info: `${CSI}2m`,
}
const MARK: Record<Severity, string> = {
  critical: 'x',
  high: 'x',
  medium: '!',
  low: '-',
  info: '-',
}
const VERIFICATION_BADGE: Record<FindingVerification, string> = {
  'source-confirmed': '[source-confirmed]',
  'runtime-verified': '[runtime-verified]',
  'potential-fp':     '[potential-fp]    ',
}

export interface TerminalReportOptions {
  color?: boolean
  showCta?: boolean
  ctaUrl?: string
}

export function renderTerminal(report: AuditReport, opts: TerminalReportOptions = {}): string {
  const color = opts.color ?? true
  const paint = (sev: Severity, s: string) => (color ? `${COLOR[sev]}${s}${RESET}` : s)
  const lines: string[] = []

  lines.push('')
  lines.push(`patchbay audit  ·  ${report.target}`)
  lines.push('')

  if (report.findings.length === 0) {
    lines.push('  0 findings.')
  } else {
    for (const f of report.findings) {
      const badge = VERIFICATION_BADGE[f.verification]
      const head = `  ${MARK[f.severity]} ${f.id.padEnd(10)} ${f.severity.padEnd(9)} ${badge} ${f.title}`
      lines.push(paint(f.severity, head))
      for (const l of wrap(f.evidence, 72)) lines.push(`      ${l}`)
      if (f.affectedComponents.length > 0) {
        lines.push(color ? `${DIM}      affected: ${f.affectedComponents.join(', ')}${RESET}` : `      affected: ${f.affectedComponents.join(', ')}`)
      }
      for (const l of wrap(`reproduction: ${f.reproductionSteps}`, 72)) {
        lines.push(color ? `${DIM}      ${l}${RESET}` : `      ${l}`)
      }
      for (const l of wrap(`remediation: ${f.remediation}`, 72)) lines.push(`      ${l}`)
      lines.push(`      → ${f.docsUrl}`)
      lines.push('')
    }
  }

  const parts: string[] = []
  for (const s of ['critical', 'high', 'medium', 'low', 'info'] as const) {
    const n = report.summary[s]
    if (n > 0) parts.push(`${n} ${s}`)
  }
  const summary = parts.length === 0 ? 'all clean' : parts.join(' · ')
  lines.push(`  ${summary}  (${report.findings.length} findings, ${(report.durationMs / 1000).toFixed(1)}s)`)
  lines.push('')

  if (opts.showCta !== false) {
    const url = opts.ctaUrl ?? 'https://patchbay-mcp.dev/fix'
    if (report.findings.length > 0) {
      lines.push('  Want patchbay to generate the fix?')
      lines.push(`  → npx patchbay fix --with-auth   (coming)`)
      lines.push(`  → ${url}`)
    } else {
      lines.push('  Want it to stay that way?')
      lines.push(`  → ${url}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function wrap(s: string, w: number): string[] {
  const words = s.split(/\s+/)
  const out: string[] = []
  let cur = ''
  for (const word of words) {
    if ((cur + ' ' + word).trim().length > w) {
      if (cur) out.push(cur)
      cur = word
    } else {
      cur = (cur ? cur + ' ' : '') + word
    }
  }
  if (cur) out.push(cur)
  return out
}

export function renderJson(report: AuditReport): string {
  return JSON.stringify(report, null, 2)
}

export function renderSarif(report: AuditReport): string {
  const results = report.findings.map((f: Finding) => ({
    ruleId: f.id,
    level: sarifLevel(f.severity),
    message: { text: `${f.title}: ${f.evidence}` },
    locations: [{ physicalLocation: { artifactLocation: { uri: report.target } } }],
    // Finding Schema v2 fields surfaced to SARIF consumers. verification
    // tells an importer whether the finding was reproduced at runtime vs
    // statically inferred, which matters when a security team routes
    // remediation. The other three are plain-text so any SARIF viewer
    // can show them without custom property handling.
    properties: {
      verification: f.verification,
      affectedComponents: f.affectedComponents,
      reproductionSteps: f.reproductionSteps,
      remediation: f.remediation,
      confidence: f.confidence,
    },
  }))
  const rules = unique(report.findings, (f) => f.id).map((f) => ({
    id: f.id,
    name: f.id,
    shortDescription: { text: f.title },
    fullDescription: { text: f.remediation },
    helpUri: f.docsUrl,
    defaultConfiguration: { level: sarifLevel(f.severity) },
  }))
  const sarif = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [{ tool: { driver: { name: 'patchbay-audit', version: '0.1.0', informationUri: 'https://patchbay-mcp.dev', rules } }, results }],
  }
  return JSON.stringify(sarif, null, 2)
}

function sarifLevel(s: Severity): 'error' | 'warning' | 'note' {
  if (s === 'critical' || s === 'high') return 'error'
  if (s === 'medium') return 'warning'
  return 'note'
}

function unique<T>(xs: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const x of xs) {
    const k = key(x)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(x)
  }
  return out
}

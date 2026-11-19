/**
 * Pre-scan pipeline for cold-mail outreach.
 *
 * Input: scratchpad/cold-mail-targets-us-startups-v2.md
 *   A pipe-delimited table with header row:
 *     Company | Domain | MCP-URL | Contact
 *
 * Output per target: scratchpad/tier5-prescans/<company-slug>.md
 *   - Whether MCP endpoint was discoverable
 *   - Top finding (highest severity) with:
 *       - one-line title
 *       - a short evidence excerpt
 *       - the public /docs link for the check id
 *       - a ready-to-paste "mail snippet" paragraph
 *   - Audit summary (counts by severity)
 *   - Full SARIF cached next to the .md for reference
 *
 * False-positive gate: every finding we reference in a mail-ready snippet
 * must carry verification === "source-confirmed". Runtime-verified ones
 * stay in the full report but are NOT promoted to the top-line
 * recommendation — the point of the gate is that Sarah can trust the
 * exact sentence we put in front of the prospect without re-verifying.
 *
 * Usage:
 *   npx tsx scripts/prescan-cold-mail.ts [--only=<slug>] [--dry-run]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditTarget, renderSarif, ALL_CHECKS } from '../packages/audit-core/src/index'
import type { Finding, AuditReport } from '../packages/audit-core/src/types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TARGETS_FILE = join(ROOT, 'scratchpad', 'cold-mail-targets-us-startups-v2.md')
const OUT_DIR = join(ROOT, 'scratchpad', 'tier5-prescans')

interface Target {
  company: string
  slug: string
  domain: string
  mcpUrl: string | null
  contactName: string | null
  contactEmail: string | null
  contactTitle: string | null
}

const SEVERITY_ORDER: Record<Finding['severity'], number> = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4,
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function parseTargets(src: string): Target[] {
  const lines = src.split(/\r?\n/).filter((l) => l.trim().length > 0 && !l.startsWith('#'))
  const rows: Target[] = []
  for (const line of lines) {
    if (!line.includes('|')) continue
    const cells = line.split('|').map((c) => c.trim())
    // skip header, separator, and prose rows
    if (cells[0]?.toLowerCase() === 'company') continue
    if (cells.every((c) => /^-+$/.test(c) || c === '')) continue
    if (cells[0]?.toLowerCase().startsWith('format:')) continue
    const dom = cells[1]
    if (!dom || !/^[a-z0-9]/i.test(dom) || dom.toLowerCase() === 'domain') continue
    if (cells.length < 2) continue
    const [company, domain, mcpUrl, contact] = cells
    if (!company || !domain) continue
    const contactParts = contact ? contact.split(/\s*,\s*/) : []
    const email = contactParts.find((p) => p.includes('@')) ?? null
    const name = contactParts.find((p) => !p.includes('@') && !/^(cto|ceo|founder|engineer|vp|head)/i.test(p)) ?? null
    const title = contactParts.find((p) => /^(cto|ceo|founder|engineer|vp|head|director)/i.test(p)) ?? null
    rows.push({
      company,
      slug: slugify(company),
      domain,
      mcpUrl: mcpUrl && mcpUrl !== '-' ? mcpUrl : null,
      contactName: name,
      contactEmail: email,
      contactTitle: title,
    })
  }
  return rows
}

function pickTopFinding(findings: Finding[]): Finding | null {
  const gated = findings.filter((f) => f.verification === 'source-confirmed')
  if (gated.length === 0) return null
  gated.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  return gated[0] ?? null
}

function renderMailSnippet(target: Target, top: Finding): string {
  const name = target.contactName ? target.contactName.split(/\s+/)[0] : 'there'
  const titleSent = top.title.endsWith('.') ? top.title : top.title + '.'
  return `Hi ${name},\n\n`
    + `I ran patchbay against ${target.domain} and the top finding was: ${titleSent} `
    + `Severity ${top.severity} (${top.verification}, confidence ${top.confidence}).\n\n`
    + `Short version: ${top.evidence.split('. ')[0]}.\n\n`
    + `Full write-up with the spec reference and the one-line fix: ${top.docsUrl}\n\n`
    + `Happy to walk the engineer who owns this through the fix on a 15-min call — no slides, just the config diff. Would Thursday work?`
}

function renderReport(target: Target, report: AuditReport | null, top: Finding | null, error: string | null): string {
  const lines: string[] = []
  lines.push(`# ${target.company} — pre-scan`)
  lines.push('')
  lines.push(`- Domain: \`${target.domain}\``)
  lines.push(`- MCP URL probed: ${target.mcpUrl ?? '(none provided)'}`)
  if (target.contactName || target.contactEmail) {
    lines.push(`- Contact: ${target.contactName ?? '(no name)'} <${target.contactEmail ?? '-'}>${target.contactTitle ? ` · ${target.contactTitle}` : ''}`)
  }
  lines.push(`- Scanned at: ${new Date().toISOString()}`)
  lines.push('')
  if (error) {
    lines.push(`## Status: scan failed`)
    lines.push('')
    lines.push('```')
    lines.push(error)
    lines.push('```')
    lines.push('')
    lines.push('> No mail-ready snippet; cannot cite a finding we did not observe.')
    return lines.join('\n')
  }
  if (!report) {
    lines.push(`## Status: no MCP endpoint discoverable`)
    lines.push('')
    lines.push('> Fall back to a generic intro mail — do not cite a scan result.')
    return lines.join('\n')
  }
  const s = report.summary
  lines.push(`## Audit summary`)
  lines.push('')
  lines.push(`\`${s.critical} critical · ${s.high} high · ${s.medium} medium · ${s.low} low · ${s.info} info\` (${report.findings.length} findings, ${report.durationMs}ms)`)
  lines.push('')
  if (top) {
    lines.push(`## Top finding (source-confirmed, mail-ready)`)
    lines.push('')
    lines.push(`### ${top.id} — ${top.title}`)
    lines.push('')
    lines.push(`**Severity:** ${top.severity} · **Confidence:** ${top.confidence} · **Verification:** ${top.verification}`)
    lines.push('')
    lines.push(`**Evidence:** ${top.evidence}`)
    lines.push('')
    lines.push(`**Docs:** ${top.docsUrl}`)
    lines.push('')
    lines.push(`### Mail snippet (paste ready)`)
    lines.push('')
    lines.push('```')
    lines.push(renderMailSnippet(target, top))
    lines.push('```')
    lines.push('')
  } else {
    lines.push(`## No source-confirmed finding`)
    lines.push('')
    lines.push(`> ${report.findings.length} total findings but none in the source-confirmed tier. Do not promote a runtime-verified finding to the cold mail without manual review.`)
    lines.push('')
  }
  lines.push(`## All findings`)
  lines.push('')
  for (const f of report.findings) {
    lines.push(`- **${f.id}** [${f.severity}/${f.verification}] ${f.title}`)
  }
  return lines.join('\n') + '\n'
}

/**
 * Discover a likely MCP endpoint for a domain. Tries the three patterns
 * we see most often in the wild, with a short timeout each:
 *   - https://<domain>/mcp           (streamable-http at the root)
 *   - https://mcp.<domain>/          (dedicated subdomain)
 *   - https://<domain>/.well-known/oauth-protected-resource
 *     (PRM pointer at root; if present the resource field names the MCP URL)
 */
async function discoverMcpUrl(domain: string): Promise<string | null> {
  const bases = [`https://${domain}`, `https://mcp.${domain}`]
  const controller = AbortSignal.timeout(3000)
  for (const base of bases) {
    try {
      const r = await fetch(`${base}/.well-known/oauth-protected-resource`, { signal: controller })
      if (r.ok) {
        const j = await r.json().catch(() => null) as { resource?: string } | null
        if (j?.resource) return j.resource
        return `${base}/mcp`
      }
    } catch { /* keep trying */ }
    try {
      const r = await fetch(`${base}/mcp`, { signal: controller, method: 'HEAD' })
      // Any response (even 401) means something is there.
      if (r.status < 500) return `${base}/mcp`
    } catch { /* keep trying */ }
  }
  return null
}

async function scanOne(target: Target): Promise<void> {
  console.log(`[${target.slug}] scan ${target.mcpUrl ?? '(discovering…)'}`)
  const outMd = join(OUT_DIR, `${target.slug}.md`)
  const outSarif = join(OUT_DIR, `${target.slug}.sarif.json`)
  if (!target.mcpUrl) {
    const discovered = await discoverMcpUrl(target.domain)
    if (!discovered) {
      writeFileSync(outMd, renderReport(target, null, null, null), 'utf8')
      return
    }
    console.log(`  ↳ discovered ${discovered}`)
    target.mcpUrl = discovered
  }
  try {
    const report = await auditTarget(target.mcpUrl, { timeoutMs: 8000 })
    const top = pickTopFinding(report.findings)
    writeFileSync(outMd, renderReport(target, report, top, null), 'utf8')
    writeFileSync(outSarif, renderSarif(report), 'utf8')
    console.log(`  → ${report.findings.length} findings, top: ${top?.id ?? '(no source-confirmed)'}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    writeFileSync(outMd, renderReport(target, null, null, msg), 'utf8')
    console.log(`  → FAIL ${msg}`)
  }
}

async function main() {
  if (!existsSync(TARGETS_FILE)) {
    console.error(`missing targets file: ${TARGETS_FILE}`)
    console.error(`Expected pipe-delimited rows: Company | Domain | MCP-URL | Contact`)
    process.exit(2)
  }
  mkdirSync(OUT_DIR, { recursive: true })
  const onlySlug = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length)
  const dryRun = process.argv.includes('--dry-run')
  const src = readFileSync(TARGETS_FILE, 'utf8')
  const all = parseTargets(src)
  const targets = onlySlug ? all.filter((t) => t.slug === onlySlug) : all
  console.log(`checks loaded: ${ALL_CHECKS.length}`)
  console.log(`targets: ${targets.length}${onlySlug ? ` (filtered by --only=${onlySlug})` : ''}`)
  if (dryRun) {
    for (const t of targets) console.log(`  ${t.slug}  ${t.domain}  ${t.mcpUrl ?? '(no mcp)'}  ${t.contactEmail ?? '(no contact)'}`)
    return
  }
  for (const t of targets) await scanOne(t)
  console.log(`\nWrote ${targets.length} pre-scan reports to ${OUT_DIR}`)
}

main().catch((e) => { console.error(e); process.exit(1) })

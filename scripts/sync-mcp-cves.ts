#!/usr/bin/env node
/**
 * Pull the MCP CVE index from github.com/mcp-security-project/mcp-cve-project
 * and write a normalised JSON to bench/cve/external-cves.json so the
 * leaderboard can cross-link each scan to known MCP CVEs.
 *
 * The upstream repo stores one markdown file per CVE under cves/, plus a
 * README with summary tables that map each CVE to the OWASP MCP Top 10
 * 2025 categories (MCP01-MCP10). We parse the README tables because they
 * carry the OWASP mapping without us having to re-derive it from each
 * per-CVE file, and we keep the deep link to the upstream md for details.
 *
 * Usage:
 *   npx tsx scripts/sync-mcp-cves.ts
 *   npx tsx scripts/sync-mcp-cves.ts --out=bench/cve/external-cves.json
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const README_URL = 'https://raw.githubusercontent.com/mcp-security-project/mcp-cve-project/main/README.md'
const USER_AGENT = 'patchbay-crawler/0.9.0 (+https://patchbay-mcp.dev/about-crawler)'

export type OwaspMcpCategory =
  | 'MCP01' | 'MCP02' | 'MCP03' | 'MCP04' | 'MCP05'
  | 'MCP06' | 'MCP07' | 'MCP08' | 'MCP09' | 'MCP10'

export interface ExternalCve {
  id: string
  date: string
  owaspCategory?: OwaspMcpCategory
  owaspLabel?: string
  affectedProduct: string
  upstreamUrl: string
}

const OWASP_LABELS: Record<OwaspMcpCategory, string> = {
  MCP01: 'Token Mismanagement & Secret Exposure',
  MCP02: 'Privilege Escalation via Scope Creep',
  MCP03: 'Tool Poisoning',
  MCP04: 'Software Supply Chain Attacks & Dependency Tampering',
  MCP05: 'Command Injection & Execution',
  MCP06: 'Prompt Injection via Contextual Payloads',
  MCP07: 'Insufficient Authentication & Authorization',
  MCP08: 'Lack of Audit and Telemetry',
  MCP09: 'Shadow MCP Servers',
  MCP10: 'Context Injection & Over-Sharing',
}

function stripMarkdownLink(s: string): string {
  // "[CVE-2026-102610](cves/CVE-2026-102610.md)" → "CVE-2026-102610"
  const m = s.match(/\[([^\]]+)\]\(([^)]+)\)/)
  return m ? m[1]! : s
}

function cveUpstreamUrl(href: string): string {
  // "cves/CVE-2026-102610.md" → "https://github.com/.../blob/main/cves/CVE-2026-102610.md"
  return 'https://github.com/mcp-security-project/mcp-cve-project/blob/main/' + href.replace(/^\/+/, '')
}

async function fetchReadme(): Promise<string> {
  const r = await fetch(README_URL, { headers: { 'user-agent': USER_AGENT, accept: 'text/plain' } })
  if (!r.ok) throw new Error('README fetch failed: HTTP ' + r.status)
  return await r.text()
}

function parseReadme(md: string): ExternalCve[] {
  const out: ExternalCve[] = []
  const lines = md.split('\n')
  for (const line of lines) {
    // Match table rows: | N | 2026-11-06 | [CVE-ID](cves/...md) | MCPNN — ... | product ... |
    // The table uses non-breaking hyphens in dates. Normalise first.
    const normalised = line.replace(/‑/g, '-').replace(/–/g, '-').replace(/—/g, '-')
    const parts = normalised.split('|').map((p) => p.trim())
    if (parts.length < 6) continue
    const [, , dateCell, idCell, owaspCell, productCell] = parts
    if (!dateCell || !/^\d{4}-\d{2}-\d{2}$/.test(dateCell)) continue
    if (!idCell || !idCell.startsWith('[')) continue

    const linkMatch = idCell.match(/\[([^\]]+)\]\(([^)]+)\)/)
    if (!linkMatch) continue
    const id = linkMatch[1]!
    const href = linkMatch[2]!

    // OWASP cell typically "MCP07 — Insufficient Authentication & Authorization"
    let owaspCategory: OwaspMcpCategory | undefined
    let owaspLabel: string | undefined
    const owaspMatch = (owaspCell ?? '').match(/\b(MCP0[1-9]|MCP10)\b/)
    if (owaspMatch) {
      owaspCategory = owaspMatch[1] as OwaspMcpCategory
      owaspLabel = OWASP_LABELS[owaspCategory]
    }

    out.push({
      id,
      date: dateCell,
      owaspCategory,
      owaspLabel,
      affectedProduct: (productCell ?? '').slice(0, 300),
      upstreamUrl: cveUpstreamUrl(href),
    })
  }
  return out
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const outFlag = argv.find((a) => a.startsWith('--out='))
  const out = outFlag ? outFlag.split('=')[1]! : 'bench/cve/external-cves.json'

  process.stderr.write('fetching ' + README_URL + '\n')
  const md = await fetchReadme()
  const cves = parseReadme(md)

  const byOwasp: Record<string, number> = {}
  for (const c of cves) {
    const k = c.owaspCategory ?? '(unmapped)'
    byOwasp[k] = (byOwasp[k] ?? 0) + 1
  }

  const payload = {
    source: 'github.com/mcp-security-project/mcp-cve-project',
    fetchedAt: new Date().toISOString(),
    count: cves.length,
    byOwaspCategory: byOwasp,
    cves,
  }

  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(payload, null, 2), 'utf8')
  process.stderr.write('wrote ' + cves.length + ' CVEs to ' + out + '\n')
  for (const [k, v] of Object.entries(byOwasp).sort((a, b) => b[1] - a[1])) {
    process.stderr.write('  ' + k.padEnd(15) + ' ' + v + '\n')
  }
}

main().catch((e) => { console.error(e); process.exit(1) })

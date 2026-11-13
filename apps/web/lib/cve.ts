import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export type CveSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type CveStatus = 'open' | 'fixed' | 'withdrawn'
export type CveDisclosureState = 'embargoed' | 'public'

export interface CveEntry {
  id: string
  published: string
  lastModified: string
  findingId: string
  severity: CveSeverity
  status: CveStatus
  disclosureState: CveDisclosureState
  embargoUntil?: string
  title: string
  summary?: string
  description?: string
  impact?: string
  fix?: string
  genericFix?: string
  severityRationale?: string
  serverName?: string
  repositoryUrl?: string
  affectedVersions?: string
  evidence?: string
  references?: string[]
  credit?: { discovered?: string; reportedBy?: string; reported?: string }
  embargoedFields?: string[]
}

const CVE_DIR = join(process.cwd(), 'data', 'cve')

export function loadAllCves(): CveEntry[] {
  try {
    const files = readdirSync(CVE_DIR).filter((f) => /^CVE-PATCHBAY-\d{4}-\d{4,}\.json$/.test(f))
    return files
      .map((f) => {
        try { return JSON.parse(readFileSync(join(CVE_DIR, f), 'utf8')) as CveEntry } catch { return null }
      })
      .filter((x): x is CveEntry => Boolean(x))
      .sort((a, b) => b.id.localeCompare(a.id))
  } catch { return [] }
}

export function loadCve(id: string): CveEntry | null {
  try { return JSON.parse(readFileSync(join(CVE_DIR, id + '.json'), 'utf8')) as CveEntry } catch { return null }
}

/**
 * Compute what the public leaderboard / CVE pages should show for a given
 * entry. Hides the fields the CVE author marked as embargoed while the
 * embargo is active. After the embargo lifts (embargoUntil < now) or the
 * disclosure state flips to 'public', all fields are shown.
 */
export function viewForPublic(entry: CveEntry): CveEntry {
  const now = new Date().toISOString()
  const embargoActive = entry.disclosureState === 'embargoed' && (!entry.embargoUntil || entry.embargoUntil > now)
  if (!embargoActive) return entry
  const copy: CveEntry = { ...entry }
  const fields = new Set(entry.embargoedFields ?? [])
  for (const f of fields) (copy as unknown as Record<string, unknown>)[f] = undefined
  return copy
}

export function isEmbargoActive(entry: CveEntry): boolean {
  const now = new Date().toISOString()
  return entry.disclosureState === 'embargoed' && (!entry.embargoUntil || entry.embargoUntil > now)
}

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

export interface ExternalCveIndex {
  source: string
  fetchedAt: string
  count: number
  byOwaspCategory: Record<string, number>
  cves: ExternalCve[]
}

const EXTERNAL_CVE_FILE = join(process.cwd(), 'data', 'cve', 'external-cves.json')

export function loadExternalCves(): ExternalCveIndex | null {
  try { return JSON.parse(readFileSync(EXTERNAL_CVE_FILE, 'utf8')) as ExternalCveIndex } catch { return null }
}

export const OWASP_LABELS: Record<OwaspMcpCategory, string> = {
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

const CHECK_MAPPING_FILE = join(process.cwd(), 'data', 'check-owasp-mapping.json')

export interface CheckOwaspMapping {
  owaspMcpTop10: string
  source: string
  checks: Record<string, { owaspCategory: OwaspMcpCategory | null; label?: string; note?: string }>
}

export function loadCheckOwaspMapping(): CheckOwaspMapping | null {
  try { return JSON.parse(readFileSync(CHECK_MAPPING_FILE, 'utf8')) as CheckOwaspMapping } catch { return null }
}

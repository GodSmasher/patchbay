import type { Metadata } from 'next'
import Link from 'next/link'
import { loadAllCves, viewForPublic, isEmbargoActive, loadExternalCves, loadCheckOwaspMapping, OWASP_LABELS, type CveSeverity, type OwaspMcpCategory } from '@/lib/cve'

export const runtime = 'nodejs'
export const revalidate = 300

const TITLE = 'Patchbay CVE database for MCP servers'
const DESCRIPTION =
  'Known vulnerabilities in public MCP servers, catalogued by patchbay. Each patchbay-assigned CVE-PATCHBAY-YYYY-NNNN links back to the audit-core check that caught it. We also cross-reference 802+ public CVEs from the mcp-security-project index, all mapped to OWASP MCP Top 10 (2025).'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/cve' },
  robots: { index: true, follow: true },
}

const SEV_COLOR: Record<CveSeverity, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#6b7280',
  info: '#6b7280',
}

export default function CveIndexPage() {
  const all = loadAllCves().map(viewForPublic)
  const openCount = all.filter((e) => e.status === 'open').length
  const embargoed = all.filter((e) => isEmbargoActive(e)).length
  const external = loadExternalCves()
  const mapping = loadCheckOwaspMapping()

  const owaspTotals: Partial<Record<OwaspMcpCategory, number>> = external?.byOwaspCategory ?? {}
  const checksByCategory: Partial<Record<OwaspMcpCategory, string[]>> = {}
  if (mapping) {
    for (const [checkId, info] of Object.entries(mapping.checks)) {
      if (!info.owaspCategory) continue
      const cat = info.owaspCategory
      ;(checksByCategory[cat] ||= []).push(checkId)
    }
  }

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'ui-sans-serif, system-ui, sans-serif', lineHeight: 1.55 }}>
      <nav style={{ marginBottom: '1.5rem' }}>
        <Link href="/" style={{ color: '#6366f1' }}>← patchbay</Link>
      </nav>

      <h1 style={{ fontSize: '2rem', margin: '0 0 0.25rem' }}>Patchbay CVE database</h1>
      <p style={{ color: '#6b7280', margin: '0 0 1rem' }}>
        {all.length} published advisor{all.length === 1 ? 'y' : 'ies'} covering public MCP server vulnerabilities · {openCount} open · {embargoed} under coordinated-disclosure embargo.
      </p>

      <section style={{ padding: '1rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: '1.5rem' }}>
        <strong>What this is.</strong> A catalogue of concrete findings against specific MCP servers (or server versions), with a stable identifier you can cite. The <code>CVE-PATCHBAY-YYYY-NNNN</code> scheme is patchbay-assigned and separate from MITRE CVE — we fill the gap until MCP servers are routinely assigned CVEs through standard channels. Advisories move through <em>embargoed</em> (operator notified, 90 days to fix) → <em>open</em> (details published) → <em>fixed</em> (operator confirmed rotation / patch). Advisories that turn out to be false positives after verification are marked <em>withdrawn</em> and kept in the index so the retraction is also citable.
      </section>

      {all.length === 0 ? (
        <p>No advisories published yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '0.5rem 0.25rem' }}>ID</th>
              <th style={{ padding: '0.5rem 0.25rem' }}>Severity</th>
              <th style={{ padding: '0.5rem 0.25rem' }}>Finding</th>
              <th style={{ padding: '0.5rem 0.25rem' }}>Title</th>
              <th style={{ padding: '0.5rem 0.25rem' }}>Status</th>
              <th style={{ padding: '0.5rem 0.25rem' }}>Published</th>
            </tr>
          </thead>
          <tbody>
            {all.map((e) => (
              <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '0.5rem 0.25rem', fontFamily: 'monospace' }}>
                  <Link href={`/cve/${e.id}`} style={{ color: '#111827', textDecoration: 'none', fontWeight: 500 }}>{e.id}</Link>
                </td>
                <td style={{ padding: '0.5rem 0.25rem' }}>
                  <span style={{ display: 'inline-block', padding: '0.1rem 0.4rem', borderRadius: 4, background: SEV_COLOR[e.severity], color: 'white', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>{e.severity}</span>
                </td>
                <td style={{ padding: '0.5rem 0.25rem', fontFamily: 'monospace' }}>
                  <Link href={`/docs/${e.findingId.toLowerCase()}`} style={{ color: '#6366f1' }}>{e.findingId}</Link>
                </td>
                <td style={{ padding: '0.5rem 0.25rem' }}>
                  <Link href={`/cve/${e.id}`} style={{ color: e.status === 'withdrawn' ? '#9ca3af' : '#111827', textDecoration: e.status === 'withdrawn' ? 'line-through' : 'none' }}>{e.title}</Link>
                  {isEmbargoActive(e) && (
                    <> · <span style={{ color: '#a16207', fontSize: '0.8rem' }}>embargoed until {e.embargoUntil?.slice(0, 10)}</span></>
                  )}
                  {e.status === 'withdrawn' && (
                    <> · <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>withdrawn {e.withdrawnAt?.slice(0, 10)} — false positive</span></>
                  )}
                </td>
                <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.85rem', color: e.status === 'withdrawn' ? '#9ca3af' : '#6b7280' }}>{e.status}</td>
                <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.85rem', color: '#6b7280' }}>{e.published.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section style={{ marginTop: '2.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>OWASP MCP Top 10 (2025) overlay</h2>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: 0 }}>
          How patchbay&apos;s checks and the public MCP CVE index break down across the ten OWASP MCP risk categories. <a href="https://owasp.org/www-project-mcp-top-10/" target="_blank" rel="noopener noreferrer">OWASP MCP Top 10</a> · CVE index: <a href="https://github.com/mcp-security-project/mcp-cve-project" target="_blank" rel="noopener noreferrer">mcp-security-project/mcp-cve-project</a> ({external?.count ?? 0} CVEs indexed, last synced {external ? external.fetchedAt.slice(0, 10) : '—'}).
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem', marginTop: '0.75rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '0.5rem 0.25rem' }}>Category</th>
              <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>Public CVEs</th>
              <th style={{ padding: '0.5rem 0.25rem' }}>Patchbay checks</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(OWASP_LABELS) as OwaspMcpCategory[]).map((cat) => (
              <tr key={cat} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '0.5rem 0.25rem', fontFamily: 'monospace', fontWeight: 600 }}>
                  {cat}
                  <div style={{ color: '#6b7280', fontSize: '0.8rem', fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontWeight: 400 }}>{OWASP_LABELS[cat]}</div>
                </td>
                <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{owaspTotals[cat] ?? 0}</td>
                <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.85rem' }}>
                  {(checksByCategory[cat] ?? []).length
                    ? (checksByCategory[cat] ?? []).map((c, i) => (
                        <span key={c}>
                          <Link href={`/docs/${c.toLowerCase()}`} style={{ color: '#6366f1', fontFamily: 'monospace' }}>{c}</Link>{i < (checksByCategory[cat] ?? []).length - 1 ? ', ' : ''}
                        </span>
                      ))
                    : <span style={{ color: '#9ca3af' }}>— (not yet covered)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: '2rem', padding: '1rem', background: '#f9fafb', borderRadius: 8, fontSize: '0.9rem', color: '#4b5563' }}>
        <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Reporting a finding</h2>
        <p>Found something on a public MCP server? Email <a href="mailto:security@patchbay-mcp.dev">security@patchbay-mcp.dev</a>. We will coordinate disclosure, assign a <code>CVE-PATCHBAY</code> identifier, and help you contact the operator. Include URL, finding category and evidence. We do not pay bounties, but we credit discoverers in the advisory.</p>
      </section>
    </main>
  )
}

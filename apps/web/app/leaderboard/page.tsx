import type { Metadata } from 'next'
import Link from 'next/link'
import { loadLeaderboardSnapshot, type LeaderboardEntry, type LeaderboardGrade, type LeaderboardScanSource } from '@/lib/leaderboard-store'

export const runtime = 'nodejs'
export const revalidate = 60

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://patchbay-mcp.dev'
const TITLE = 'MCP Server Security Leaderboard · patchbay'
const DESCRIPTION =
  'Letter grades for public MCP servers based on OAuth 2.1 conformance, transport-security headers and manifest-drift signals. Updated weekly from a passive patchbay audit sweep.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/leaderboard' },
  openGraph: {
    type: 'website',
    url: SITE_URL + '/leaderboard',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: '/leaderboard/opengraph-image', width: 1200, height: 630, alt: 'patchbay MCP leaderboard' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [SITE_URL + '/leaderboard/opengraph-image'],
  },
}

const GRADE_COLOR: Record<LeaderboardGrade, string> = {
  A: '#22c55e',
  B: '#84cc16',
  C: '#eab308',
  D: '#f97316',
  F: '#ef4444',
}

function gradeCounts(entries: LeaderboardEntry[]): Record<LeaderboardGrade, number> {
  const out: Record<LeaderboardGrade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 }
  for (const e of entries) if (e.reachable) out[e.grade] += 1
  return out
}

const COVERAGE_LABEL: Record<LeaderboardScanSource, { icon: string; text: string; title: string }> = {
  'live-metadata+source': { icon: '✅', text: 'full', title: 'Live metadata probe plus static source audit of the linked repo' },
  'live-metadata': { icon: '🔍', text: 'metadata', title: 'Live metadata only — repo not available or clone failed' },
  'source': { icon: '📦', text: 'source', title: 'Static source audit only — the live URL was unreachable' },
  'authenticated': { icon: '🔑', text: 'auth', title: 'Scanned with a user-submitted bearer token' },
  'operator-verified': { icon: '👤', text: 'operator', title: 'Submitted by the server operator (verified ownership)' },
  'unreachable': { icon: '🚨', text: 'unreachable', title: 'Not reachable during the last scan' },
}

function CoverageBadge({ entry }: { entry: LeaderboardEntry }) {
  const s = entry.scanSource
  if (!s) return <span style={{ color: '#9ca3af' }}>—</span>
  const l = COVERAGE_LABEL[s]
  return (
    <span title={l.title} style={{ color: '#4b5563' }}>
      <span style={{ marginRight: '0.3rem' }}>{l.icon}</span>{l.text}
    </span>
  )
}

export default async function LeaderboardPage() {
  const snapshot = await loadLeaderboardSnapshot()
  if (!snapshot) {
    return (
      <main style={{ maxWidth: 820, margin: '0 auto', padding: '2rem 1rem' }}>
        <h1>MCP Security Leaderboard</h1>
        <p>No snapshot uploaded yet. Run <code>scripts/leaderboard-upload.ts</code> against a sweep JSON to populate.</p>
      </main>
    )
  }

  const reachable = snapshot.entries.filter((e) => e.reachable)
  const unreachable = snapshot.entries.filter((e) => !e.reachable)
  const counts = gradeCounts(snapshot.entries)
  const capturedDate = snapshot.capturedAt.slice(0, 10)

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'patchbay MCP Security Leaderboard',
    numberOfItems: reachable.length,
    itemListElement: reachable.slice(0, 50).map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/leaderboard/${e.slug}`,
      name: e.host,
    })),
  }

  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <nav style={{ marginBottom: '1.5rem' }}>
        <Link href="/" style={{ color: '#6366f1' }}>← patchbay</Link>
      </nav>
      <h1 style={{ fontSize: '2rem', margin: '0 0 0.25rem' }}>MCP Server Security Leaderboard</h1>
      <p style={{ color: '#6b7280', margin: '0 0 1rem' }}>
        {reachable.length} of {snapshot.cohortSize} public MCP servers audited on {capturedDate}. Passive checks only (OAuth metadata, response headers, manifest drift). No tool calls, no OAuth flows against third-party servers.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {(['A', 'B', 'C', 'D', 'F'] as const).map((g) => (
          <div key={g} style={{
            padding: '0.5rem 0.75rem',
            borderRadius: 6,
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            <span style={{
              display: 'inline-block', width: 22, height: 22, borderRadius: 4,
              background: GRADE_COLOR[g], color: 'white', textAlign: 'center',
              fontWeight: 700, fontSize: '0.85rem', lineHeight: '22px',
            }}>{g}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{counts[g]}</span>
          </div>
        ))}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '0.5rem 0.25rem' }}>#</th>
            <th style={{ padding: '0.5rem 0.25rem' }}>Host</th>
            <th style={{ padding: '0.5rem 0.25rem' }}>Grade</th>
            <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>Score</th>
            <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>Findings</th>
            <th style={{ padding: '0.5rem 0.25rem' }}>Coverage</th>
          </tr>
        </thead>
        <tbody>
          {reachable.map((e, i) => {
            const totalFindings = e.findings.critical + e.findings.high + e.findings.medium + e.findings.low
            return (
              <tr key={e.slug} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '0.5rem 0.25rem', color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</td>
                <td style={{ padding: '0.5rem 0.25rem' }}>
                  <Link href={`/leaderboard/${e.slug}`} style={{ color: '#111827', textDecoration: 'none', fontWeight: 500 }}>
                    {e.host}
                  </Link>
                </td>
                <td style={{ padding: '0.5rem 0.25rem' }}>
                  <span style={{
                    display: 'inline-block', minWidth: 24, padding: '0.1rem 0.4rem', borderRadius: 4,
                    background: GRADE_COLOR[e.grade], color: 'white', textAlign: 'center',
                    fontWeight: 700, fontSize: '0.85rem',
                  }}>{e.grade}</span>
                </td>
                <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{e.score}</td>
                <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{totalFindings}</td>
                <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.8rem' }}>
                  <CoverageBadge entry={e} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {unreachable.length > 0 && (
        <details style={{ marginTop: '2rem', color: '#6b7280' }}>
          <summary>{unreachable.length} host(s) unreachable on {capturedDate} — not scored</summary>
          <ul style={{ fontSize: '0.85rem' }}>
            {unreachable.map((e) => <li key={e.slug}>{e.host}</li>)}
          </ul>
        </details>
      )}

      <section style={{ marginTop: '2rem', padding: '1rem', background: '#f9fafb', borderRadius: 8, fontSize: '0.9rem' }}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Methodology</h2>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#4b5563' }}>
          <li>Hosts: every server in the <a href="https://registry.modelcontextprotocol.io" target="_blank" rel="noopener noreferrer">official MCP Registry</a>, plus submitted entries.</li>
          <li>Each host is scanned in two tiers: live metadata (public well-known OAuth documents + response headers, nothing authenticated) and static source (shallow-cloned from <code>repository.url</code> when available).</li>
          <li>Never authenticates against a third-party host. See <Link href="/about-crawler">about the crawler</Link> for guard-rails and opt-out.</li>
          <li>Coverage badges: <strong>🔍 metadata</strong> live probe only · <strong>📦 source</strong> repo-only audit · <strong>✅ full</strong> both tiers merged · <strong>👤 operator</strong> operator-verified Tier C.</li>
          <li>Checks: see the <Link href="/docs">docs</Link>. Grade = 100 − Σ(finding × severity weight).</li>
          <li>Frequency: full rescan weekly. API at <code>/api/leaderboard</code>.</li>
        </ul>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />
    </main>
  )
}

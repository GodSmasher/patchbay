import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  loadLeaderboardEntry,
  loadLeaderboardSnapshot,
  type LeaderboardGrade,
  type LeaderboardVerification,
} from '@/lib/leaderboard-store'

const VERIFICATION_LABEL: Record<LeaderboardVerification, string> = {
  'source-confirmed': 'source-confirmed',
  'runtime-verified': 'runtime-verified',
  'potential-fp': 'potential-fp',
}
const VERIFICATION_STYLE: Record<LeaderboardVerification, { fg: string; bg: string; title: string }> = {
  'source-confirmed': {
    fg: '#047857', bg: '#d1fae5',
    title: 'patchbay saw the code path in source. Safe to cite in cold-mail outreach.',
  },
  'runtime-verified': {
    fg: '#4338ca', bg: '#e0e7ff',
    title: 'patchbay reproduced the issue live against the endpoint.',
  },
  'potential-fp': {
    fg: '#9ca3af', bg: '#f3f4f6',
    title: 'Pattern matched but not confirmed. Manual verification required before public claim.',
  },
}

function VerificationBadge({ v }: { v?: LeaderboardVerification }) {
  if (!v) return <span style={{ color: '#9ca3af', fontSize: '0.75rem', fontStyle: 'italic' }}>pending rescan</span>
  const s = VERIFICATION_STYLE[v]
  return (
    <span
      title={s.title}
      style={{
        display: 'inline-block', padding: '0.05rem 0.4rem', borderRadius: 4,
        fontSize: '0.7rem', fontWeight: 500, color: s.fg, background: s.bg,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {VERIFICATION_LABEL[v]}
    </span>
  )
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#6366f1', info: '#6b7280',
}

export const runtime = 'nodejs'
export const revalidate = 300

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://patchbay-mcp.dev'

const GRADE_COLOR: Record<LeaderboardGrade, string> = {
  A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', F: '#ef4444',
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const snapshot = await loadLeaderboardSnapshot()
  if (!snapshot) return []
  return snapshot.entries.map((e) => ({ slug: e.slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const entry = await loadLeaderboardEntry(params.slug)
  if (!entry) return { title: 'Host not on the leaderboard · patchbay', robots: { index: false, follow: true } }
  const title = `${entry.host}: MCP security grade ${entry.grade} (${entry.score}/100) · patchbay`
  const description = `patchbay audit of ${entry.host}. ${entry.findings.critical} critical, ${entry.findings.high} high, ${entry.findings.medium} medium, ${entry.findings.low} low findings. Last scanned ${entry.lastScanned.slice(0, 10)}.`
  return {
    title,
    description,
    alternates: { canonical: `/leaderboard/${entry.slug}` },
    openGraph: {
      type: 'article',
      url: `${SITE_URL}/leaderboard/${entry.slug}`,
      title,
      description,
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function LeaderboardHostPage({ params }: { params: { slug: string } }) {
  const entry = await loadLeaderboardEntry(params.slug)
  if (!entry) notFound()

  const totalFindings = entry.findings.critical + entry.findings.high + entry.findings.medium + entry.findings.low
  const rating = {
    '@context': 'https://schema.org',
    '@type': 'Rating',
    ratingValue: entry.score,
    bestRating: 100,
    worstRating: 0,
    ratingExplanation: `MCP security grade ${entry.grade} on patchbay. ${totalFindings} open finding(s).`,
  }

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <nav style={{ marginBottom: '1rem' }}>
        <Link href="/leaderboard" style={{ color: '#6366f1' }}>← Leaderboard</Link>
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
        <span style={{
          display: 'inline-block', minWidth: 48, padding: '0.5rem 0.75rem', borderRadius: 8,
          background: GRADE_COLOR[entry.grade], color: 'white', textAlign: 'center',
          fontWeight: 700, fontSize: '1.5rem',
        }}>{entry.grade}</span>
        <h1 style={{ margin: 0, fontSize: '1.75rem' }}>{entry.host}</h1>
      </div>
      <p style={{ margin: '0 0 1.5rem', color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
        Score {entry.score}/100 · Last scanned {entry.lastScanned.slice(0, 10)} · {entry.category}
      </p>

      <section style={{ padding: '1rem', background: '#f9fafb', borderRadius: 8, marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Findings</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontVariantNumeric: 'tabular-nums' }}>
          <span><strong style={{ color: '#ef4444' }}>{entry.findings.critical}</strong> critical</span>
          <span><strong style={{ color: '#f97316' }}>{entry.findings.high}</strong> high</span>
          <span><strong style={{ color: '#eab308' }}>{entry.findings.medium}</strong> medium</span>
          <span><strong style={{ color: '#6366f1' }}>{entry.findings.low}</strong> low</span>
          <span><strong style={{ color: '#6b7280' }}>{entry.findings.info}</strong> info</span>
        </div>
      </section>

      {entry.verificationCounts && (
        <section style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: 8 }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Verification breakdown</h2>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontVariantNumeric: 'tabular-nums' }}>
            <span><strong style={{ color: '#047857' }}>{entry.verificationCounts['source-confirmed']}</strong> source-confirmed</span>
            <span><strong style={{ color: '#4338ca' }}>{entry.verificationCounts['runtime-verified']}</strong> runtime-verified</span>
            <span><strong style={{ color: '#9ca3af' }}>{entry.verificationCounts['potential-fp']}</strong> potential-fp</span>
          </div>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
            Cold-outreach quality gate: only <strong>source-confirmed</strong> findings may be cited to operators by name.
            See <Link href="/docs" style={{ color: '#6366f1' }}>Finding Schema v2 docs</Link> for tier definitions.
          </p>
        </section>
      )}

      {entry.findingsDetail && entry.findingsDetail.length > 0 ? (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Findings ({entry.findingsDetail.length})</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                <th style={{ padding: '0.4rem 0.25rem' }}>Check</th>
                <th style={{ padding: '0.4rem 0.25rem' }}>Severity</th>
                <th style={{ padding: '0.4rem 0.25rem' }}>Verification</th>
              </tr>
            </thead>
            <tbody>
              {entry.findingsDetail.map((f, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.4rem 0.25rem' }}>
                    <Link href={`/docs/${f.id.toLowerCase()}`} style={{ color: '#6366f1' }}>{f.id}</Link>
                  </td>
                  <td style={{ padding: '0.4rem 0.25rem' }}>
                    <span style={{ color: SEVERITY_COLOR[f.severity] ?? '#6b7280', fontWeight: 500 }}>{f.severity}</span>
                  </td>
                  <td style={{ padding: '0.4rem 0.25rem' }}>
                    <VerificationBadge v={f.verification} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : entry.topFindingIds.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Top finding IDs</h2>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#9ca3af' }}>
            This entry was scanned before Finding Schema v2 — per-finding verification tier will populate on next rescan.
          </p>
          <ul>
            {entry.topFindingIds.map((id) => (
              <li key={id}><Link href={`/docs/${id.toLowerCase()}`} style={{ color: '#6366f1' }}>{id}</Link></li>
            ))}
          </ul>
        </section>
      )}

      {entry.reportId && (
        <p>
          <Link href={`/report/${entry.reportId}`} style={{ color: '#6366f1' }}>Full audit report →</Link>
        </p>
      )}

      <section style={{ marginTop: '2rem', padding: '1rem', background: '#f9fafb', borderRadius: 8, fontSize: '0.9rem', color: '#4b5563' }}>
        <p style={{ margin: 0 }}>
          This grade comes from a passive audit of <code>{entry.url}</code>. No OAuth flows were initiated, no Dynamic Client Registration was written, no tool calls were made. If you operate this server and want a re-scan or want to dispute a finding, open an issue on the <a href="https://github.com/GodSmasher/patchbay/issues" style={{ color: '#6366f1' }}>patchbay repo</a>.
        </p>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(rating) }}
      />
    </main>
  )
}

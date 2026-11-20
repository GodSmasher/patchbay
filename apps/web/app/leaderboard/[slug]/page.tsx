import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteShell } from '@/components/site-shell'
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
    fg: '#d1fae5', bg: 'rgba(4, 120, 87, 0.3)',
    title: 'patchbay saw the code path in source. Safe to cite in cold-mail outreach.',
  },
  'runtime-verified': {
    fg: '#e0e7ff', bg: 'rgba(67, 56, 202, 0.35)',
    title: 'patchbay reproduced the issue live against the endpoint.',
  },
  'potential-fp': {
    fg: '#d6d6dc', bg: 'rgba(255, 255, 255, 0.08)',
    title: 'Pattern matched but not confirmed. Manual verification required before public claim.',
  },
}

function VerificationBadge({ v }: { v?: LeaderboardVerification }) {
  if (!v) return <span className="text-[11px] italic text-ink-mute">pending rescan</span>
  const s = VERIFICATION_STYLE[v]
  return (
    <span
      title={s.title}
      style={{
        display: 'inline-block', padding: '2px 8px', borderRadius: 999,
        fontSize: '11px', fontWeight: 500, color: s.fg, background: s.bg,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {VERIFICATION_LABEL[v]}
    </span>
  )
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'g-sev g-sev-critical',
  high: 'g-sev g-sev-high',
  medium: 'g-sev g-sev-medium',
  low: 'g-sev g-sev-low',
  info: 'g-sev g-sev-info',
}

export const runtime = 'nodejs'
export const revalidate = 300

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://patchbay-mcp.dev'

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

  const gradeClass = `g-grade g-grade-${entry.grade satisfies LeaderboardGrade}`

  return (
    <SiteShell>
      <main className="relative z-10 mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
        <nav className="mb-6 text-sm">
          <Link href="/leaderboard" className="text-ink-mute hover:text-white">
            ← Leaderboard
          </Link>
        </nav>

        <header className="flex items-center gap-4">
          <span className={gradeClass} style={{ width: 48, height: 48, fontSize: 22 }}>{entry.grade}</span>
          <h1 className="font-display text-3xl text-ink sm:text-4xl">{entry.host}</h1>
        </header>
        <p className="mt-2 font-mono text-[12px] text-ink-mute tabular-nums">
          Score {entry.score}/100 · Last scanned {entry.lastScanned.slice(0, 10)} · {entry.category}
        </p>

        <section className="g-glass g-tint-b mt-8 p-6">
          <h2 className="g-eyebrow mb-3">Findings</h2>
          <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[13px] text-ink tabular-nums">
            <span><span className="font-display text-xl">{entry.findings.critical}</span> <span className="text-ink-mute">critical</span></span>
            <span><span className="font-display text-xl">{entry.findings.high}</span> <span className="text-ink-mute">high</span></span>
            <span><span className="font-display text-xl">{entry.findings.medium}</span> <span className="text-ink-mute">medium</span></span>
            <span><span className="font-display text-xl">{entry.findings.low}</span> <span className="text-ink-mute">low</span></span>
            <span><span className="font-display text-xl">{entry.findings.info}</span> <span className="text-ink-mute">info</span></span>
          </div>
        </section>

        {entry.verificationCounts && (
          <section className="g-glass mt-6 p-6">
            <h2 className="g-eyebrow mb-3">Verification breakdown</h2>
            <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[13px] tabular-nums">
              <span><span className="font-display text-xl text-ink">{entry.verificationCounts['source-confirmed']}</span> <span className="text-ink-mute">source-confirmed</span></span>
              <span><span className="font-display text-xl text-ink">{entry.verificationCounts['runtime-verified']}</span> <span className="text-ink-mute">runtime-verified</span></span>
              <span><span className="font-display text-xl text-ink">{entry.verificationCounts['potential-fp']}</span> <span className="text-ink-mute">potential-fp</span></span>
            </div>
            <p className="mt-3 text-[12px] text-ink-mute">
              Cold-outreach quality gate: only <strong className="text-ink">source-confirmed</strong> findings may be cited to operators by name.{' '}
              See <Link href="/docs" className="text-ink underline underline-offset-2 hover:text-white">Finding Schema v2 docs</Link> for tier definitions.
            </p>
          </section>
        )}

        {entry.findingsDetail && entry.findingsDetail.length > 0 ? (
          <section className="g-glass mt-6 p-6">
            <h2 className="g-eyebrow mb-4">Findings ({entry.findingsDetail.length})</h2>
            <table className="w-full border-collapse font-mono text-[13px]">
              <thead>
                <tr className="border-b border-white/15 text-left text-[11px] uppercase tracking-[.12em] text-ink-mute">
                  <th className="px-1 py-2 font-medium">Check</th>
                  <th className="px-1 py-2 font-medium">Severity</th>
                  <th className="px-1 py-2 font-medium">Verification</th>
                </tr>
              </thead>
              <tbody>
                {entry.findingsDetail.map((f, i) => (
                  <tr key={i} className="border-b border-white/[.07] last:border-b-0">
                    <td className="px-1 py-3">
                      <Link href={`/docs/${f.id.toLowerCase()}`} className="text-ink hover:text-white underline underline-offset-2">
                        {f.id}
                      </Link>
                    </td>
                    <td className="px-1 py-3">
                      <span className={SEVERITY_STYLE[f.severity] ?? 'g-sev g-sev-info'}>{f.severity}</span>
                    </td>
                    <td className="px-1 py-3">
                      <VerificationBadge v={f.verification} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : entry.topFindingIds.length > 0 && (
          <section className="g-glass mt-6 p-6">
            <h2 className="g-eyebrow mb-3">Top finding IDs</h2>
            <p className="mb-3 text-[12px] text-ink-mute">
              This entry was scanned before Finding Schema v2. Per-finding verification tier will populate on next rescan.
            </p>
            <ul className="list-disc space-y-1 pl-5 font-mono text-[13px]">
              {entry.topFindingIds.map((id) => (
                <li key={id}>
                  <Link href={`/docs/${id.toLowerCase()}`} className="text-ink hover:text-white underline underline-offset-2">
                    {id}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {entry.reportId && (
          <p className="mt-6">
            <Link
              href={`/report/${entry.reportId}`}
              className="inline-flex items-center gap-2 font-mono text-[13px] text-ink underline underline-offset-4 hover:text-white"
            >
              Full audit report →
            </Link>
          </p>
        )}

        <section className="mt-10 border-t border-white/10 pt-6 text-[12px] leading-relaxed text-ink-mute">
          <p>
            This grade comes from a passive audit of{' '}
            <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-ink">{entry.url}</code>.
            No OAuth flows were initiated, no Dynamic Client Registration was written, no tool calls were made.
            If you operate this server and want a re-scan or want to dispute a finding, open an issue on the{' '}
            <a href="https://github.com/GodSmasher/patchbay/issues" className="text-ink underline underline-offset-2 hover:text-white">
              patchbay repo
            </a>
            .
          </p>
        </section>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(rating) }}
        />
      </main>
    </SiteShell>
  )
}

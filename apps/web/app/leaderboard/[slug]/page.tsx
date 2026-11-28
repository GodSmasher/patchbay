import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { GlowShape, SEV_CLASS } from '@/components/glow'
import {
  loadLeaderboardEntry,
  loadLeaderboardSnapshot,
  type LeaderboardVerification,
} from '@/lib/leaderboard-store'
import { normalizeEntry } from '@/lib/leaderboard-grade'

const VERIFICATION_LABEL: Record<LeaderboardVerification, string> = {
  'source-confirmed': 'source-confirmed',
  'runtime-verified': 'runtime-verified',
  'potential-fp': 'potential-fp',
}
const VERIFICATION_STYLE: Record<LeaderboardVerification, { fg: string; bg: string; title: string }> = {
  'source-confirmed': {
    fg: '#000000', bg: '#ffffff',
    title: 'patchbay saw the code path in source. Safe to cite in cold-mail outreach.',
  },
  'runtime-verified': {
    fg: '#c3c8ff', bg: 'rgba(109,108,255,.18)',
    title: 'patchbay reproduced the issue live against the endpoint.',
  },
  'potential-fp': {
    fg: 'var(--color-ink-mute)', bg: 'rgba(255,255,255,.06)',
    title: 'Pattern matched but not confirmed. Manual verification required before public claim.',
  },
}

function VerificationBadge({ v }: { v?: LeaderboardVerification }) {
  if (!v) return <span style={{ color: 'var(--color-ink-mute)', fontSize: '0.75rem', fontStyle: 'italic' }}>pending rescan</span>
  const s = VERIFICATION_STYLE[v]
  return (
    <span
      title={s.title}
      style={{
        display: 'inline-block', padding: '0.05rem 0.5rem', borderRadius: 999,
        fontSize: '0.7rem', fontWeight: 500, color: s.fg, background: s.bg,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {VERIFICATION_LABEL[v]}
    </span>
  )
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
  const raw = await loadLeaderboardEntry(params.slug)
  if (!raw) return { title: 'Host not on the leaderboard · patchbay', robots: { index: false, follow: true } }
  const entry = normalizeEntry(raw)
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
  const raw = await loadLeaderboardEntry(params.slug)
  if (!raw) notFound()
  const entry = normalizeEntry(raw)

  const totalFindings = entry.findings.critical + entry.findings.high + entry.findings.medium + entry.findings.low
  const rating = {
    '@context': 'https://schema.org',
    '@type': 'Rating',
    ratingValue: entry.score,
    bestRating: 100,
    worstRating: 0,
    ratingExplanation: `MCP security grade ${entry.grade} on patchbay. ${totalFindings} open finding(s).`,
  }

  const sevs = ['critical', 'high', 'medium', 'low', 'info'] as const
  const watchUrl = `/early-access?ref=leaderboard-${entry.slug}&url=${encodeURIComponent(entry.url)}`

  return (
    <main>
      <section className="relative">
        <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-5 pb-8 pt-10 sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center">
          <div>
            <nav aria-label="Breadcrumb" className="flex gap-2 font-mono text-xs text-ink-mute">
              <Link href="/leaderboard" className="hover:text-white">leaderboard</Link>
              <span>/</span>
              <span className="text-ink-soft">{entry.host}</span>
            </nav>
            <p className="g-eyebrow mt-8">last scanned {entry.lastScanned.slice(0, 10)} · {entry.category}</p>
            <h1 className="mt-5 break-words text-[clamp(40px,6vw,72px)] leading-[.95]">{entry.host}</h1>
            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-ink-soft">
              Passive audit of <code className="break-all">{entry.url}</code>. No OAuth flows, no client
              registration, no tool calls.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {entry.reportId && (
                <Link href={`/report/${entry.reportId}`} className="g-btn g-btn-o">full audit report →</Link>
              )}
              <Link href={watchUrl} className="g-btn g-btn-ghost">watch this server</Link>
            </div>
          </div>

          <div className="relative flex h-[340px] flex-col items-center justify-center">
            <GlowShape className="inset-x-0 mx-auto top-2 h-[320px] w-[320px] " />
            <span className="font-display relative z-10 text-[180px] font-light leading-[.85]">{entry.grade}</span>
            <span className="relative z-10 text-sm text-ink-soft">
              score <b className="font-semibold tabular-nums text-white">{entry.score}</b> / 100
            </span>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8">
        <div className="g-glass grid grid-cols-5 overflow-hidden rounded-2xl">
          {sevs.map((s) => (
            <div key={s} className="border-r border-white/10 p-4 last:border-r-0 sm:p-5">
              <div className="font-display text-3xl tabular-nums sm:text-4xl">{entry.findings[s]}</div>
              <span className={SEV_CLASS[s]}>{s === 'critical' ? 'crit' : s}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-4 px-5 pt-10 sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div>
          <h2 className="text-[clamp(32px,4vw,44px)] leading-none">findings</h2>
          {entry.findingsDetail && entry.findingsDetail.length > 0 ? (
            <ul className="mt-6 flex flex-col gap-2">
              {entry.findingsDetail.map((f, i) => (
                <li key={i}>
                  <Link href={`/docs/${f.id.toLowerCase()}`} className="g-glass flex items-center justify-between gap-4 rounded-2xl px-5 py-4 hover:border-white/20">
                    <span className="font-mono text-sm text-ink">{f.id} →</span>
                    <span className="flex items-center gap-2">
                      <VerificationBadge v={f.verification} />
                      <span className={SEV_CLASS[f.severity] ?? SEV_CLASS.info}>{f.severity}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : entry.topFindingIds.length > 0 ? (
            <>
              <p className="mt-4 text-sm text-ink-mute">
                Scanned before Finding Schema v2 — per-finding verification fills in on the next rescan.
              </p>
              <ul className="mt-4 flex flex-col gap-2">
                {entry.topFindingIds.map((id) => (
                  <li key={id}>
                    <Link href={`/docs/${id.toLowerCase()}`} className="g-glass flex items-center justify-between rounded-2xl px-5 py-4 font-mono text-sm hover:border-white/20">
                      {id} <span className="text-ink-mute">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-4 text-ink-soft">Nothing to fix from the outside. Nice.</p>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          {entry.verificationCounts && (
            <div className="g-glass g-tint-b p-6">
              <p className="text-[11px] uppercase tracking-[.12em] text-ink-mute">verification</p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div><div className="font-display text-3xl tabular-nums">{entry.verificationCounts['source-confirmed']}</div><div className="text-xs text-ink-soft">source-confirmed</div></div>
                <div><div className="font-display text-3xl tabular-nums text-[#c3c8ff]">{entry.verificationCounts['runtime-verified']}</div><div className="text-xs text-ink-soft">runtime-verified</div></div>
                <div><div className="font-display text-3xl tabular-nums text-ink-mute">{entry.verificationCounts['potential-fp']}</div><div className="text-xs text-ink-soft">potential-fp</div></div>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-ink-mute">
                Only source-confirmed findings are cited to operators by name. Tiers are explained in the{' '}
                <Link href="/docs" className="text-[#ffb38a] hover:text-white">docs</Link>.
              </p>
            </div>
          )}
          <div className="g-glass g-tint-o p-6">
            <p className="font-display text-2xl">run this server?</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Want a re-scan or think a finding is wrong? Open an issue on the{' '}
              <a href="https://github.com/GodSmasher/patchbay/issues" className="text-[#ffb38a] hover:text-white">patchbay repo</a>.
              Or get told when this grade changes.
            </p>
            <Link href={watchUrl} className="g-btn g-btn-w mt-4">watch this server</Link>
          </div>
        </aside>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(rating) }}
      />
    </main>
  )
}

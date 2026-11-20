import type { Metadata } from 'next'
import Link from 'next/link'
import { loadLeaderboardSnapshot, type LeaderboardEntry, type LeaderboardGrade, type LeaderboardScanSource, type LeaderboardVerificationCounts } from '@/lib/leaderboard-store'
import { NewsletterSignup } from '@/components/newsletter-signup'
import { SiteShell } from '@/components/site-shell'
import { GlowShape } from '@/components/glow'

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

// Bar colours for the grade distribution, matching the .g-grade-* chips.
const GRADE_BAR: Record<LeaderboardGrade, string> = {
  A: '#ffffff',
  B: '#9fa8ff',
  C: '#ffcfb3',
  D: '#ff8a55',
  F: '#ff6a2b',
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

function VerificationPills({ counts }: { counts: LeaderboardVerificationCounts | undefined }) {
  // No data = pre-Schema-v2 snapshot or empty entry. Show a quiet marker
  // instead of implying everything is a potential FP.
  if (!counts) {
    return (
      <span
        title="This entry was scanned before Schema v2 — verification tier will populate on next rescan."
        className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[10.5px] text-ink-mute"
      >
        tier pending
      </span>
    )
  }
  const total = counts['source-confirmed'] + counts['runtime-verified'] + counts['potential-fp']
  if (total === 0) {
    return <span className="text-ink-mute">—</span>
  }
  const pills: Array<[string, number, string, string]> = [
    ['confirmed', counts['source-confirmed'], '#000000', '#ffffff'],
    ['verified', counts['runtime-verified'], '#c3c8ff', 'rgba(109,108,255,.18)'],
    ['fp', counts['potential-fp'], '#a3a3ad', 'rgba(255,255,255,.06)'],
  ]
  return (
    <span
      title="Finding Schema v2 breakdown. source-confirmed = patchbay saw the code path · runtime-verified = reproduced live against the endpoint · potential-fp = pattern matched, manual verification required."
      style={{ display: 'inline-flex', gap: '0.25rem', fontVariantNumeric: 'tabular-nums', fontSize: '0.72rem' }}
    >
      {pills.map(([label, n, fg, bg]) => (
        <span
          key={label}
          style={{
            padding: '0.05rem 0.35rem',
            borderRadius: 999,
            color: fg,
            background: bg,
            opacity: n === 0 ? 0.45 : 1,
          }}
        >
          {n} {label}
        </span>
      ))}
    </span>
  )
}

function CoverageBadge({ entry }: { entry: LeaderboardEntry }) {
  const s = entry.scanSource
  if (!s) return <span className="text-ink-mute">—</span>
  const l = COVERAGE_LABEL[s]
  return (
    <span title={l.title} className="text-ink-soft">
      <span style={{ marginRight: '0.3rem' }}>{l.icon}</span>{l.text}
    </span>
  )
}

export default async function LeaderboardPage() {
  const snapshot = await loadLeaderboardSnapshot()
  const fullSnapshot = await loadLeaderboardSnapshot(true)
  const embargoedCount = fullSnapshot && snapshot ? fullSnapshot.entries.length - snapshot.entries.length : 0
  if (!snapshot) {
    return (
      <SiteShell>
        <main className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <h1 className="text-6xl">mcp security leaderboard</h1>
          <p className="mt-4 text-ink-soft">No snapshot uploaded yet. Run <code>scripts/leaderboard-upload.ts</code> against a sweep JSON to populate.</p>
        </main>
      </SiteShell>
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

  const maxCount = Math.max(1, ...(['A', 'B', 'C', 'D', 'F'] as const).map((g) => counts[g]))

  return (
    <SiteShell>
      <main>
        <section className="relative">
          <GlowShape className="right-[-80px] top-[-60px] h-[300px] w-[300px] sm:right-[4%] lg:h-[520px] lg:w-[540px]" />
          <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-5 pb-10 pt-14 sm:px-8 lg:grid-cols-[7fr_5fr] lg:items-end lg:pt-20">
            <div>
              <p className="g-eyebrow">audited {capturedDate} · rescanned weekly</p>
              <h1 className="mt-6 text-[clamp(60px,10vw,112px)] leading-[.92]">
                <span className="block">mcp server</span>
                <span className="block">security</span>
                <span className="block pl-[0.5em] lg:pl-[1.3em]">leaderboard</span>
              </h1>
              <p className="mt-8 max-w-xl text-[17px] leading-relaxed text-ink-soft">
                {reachable.length} of {snapshot.cohortSize} public MCP servers. Passive checks only — OAuth
                metadata, response headers, manifest drift. No tool calls, no OAuth flows against
                third-party servers.
                {embargoedCount > 0 && (
                  <>
                    {' '}
                    <span
                      title="Under coordinated-disclosure embargo: operator notified, 90-day fix window running."
                      className="text-[#ffb38a]"
                    >
                      {embargoedCount} entr{embargoedCount === 1 ? 'y' : 'ies'} under disclosure embargo.
                    </span>
                  </>
                )}
              </p>
              <p className="mt-3 text-sm text-ink-mute">
                Also: <Link href="/cve" className="text-[#ffb38a] hover:text-white">CVE database</Link> ·{' '}
                <Link href="/about-crawler" className="text-[#ffb38a] hover:text-white">about the crawler</Link>
              </p>
            </div>

            <div className="g-glass flex flex-col gap-3 bg-[rgba(10,10,13,.75)] p-6">
              <span className="text-[11px] uppercase tracking-[.12em] text-ink-mute">grade distribution</span>
              {(['A', 'B', 'C', 'D', 'F'] as const).map((g, i) => (
                <div key={g} className="grid grid-cols-[34px_1fr_44px] items-center gap-3 text-sm">
                  <span className={`g-grade g-grade-${g}`} style={{ width: 28, height: 28, fontSize: 14 }}>{g}</span>
                  <div className="h-1.5 rounded-full bg-white/[.08]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(counts[g] / maxCount) * 100}%`,
                        minWidth: counts[g] > 0 ? 6 : 0,
                        background: GRADE_BAR[g],
                        animation: `g-bar 1.2s ${i * 0.1}s ease both`,
                      }}
                    />
                  </div>
                  <b className="text-right font-medium tabular-nums">{counts[g]}</b>
                </div>
              ))}
              {unreachable.length > 0 && (
                <span className="text-xs text-ink-mute">{unreachable.length} hosts unreachable, not scored</span>
              )}
            </div>
          </div>
        </section>

        <section className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8">
          {/* Desktop: table. Phone: the same rows as a compact list. */}
          <div className="g-glass hidden overflow-x-auto px-6 pb-3 pt-2 md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/15 text-left text-[11px] uppercase tracking-[.12em] text-ink-mute">
                  <th scope="col" className="px-1 py-3 font-normal">#</th>
                  <th scope="col" className="px-1 py-3 font-normal">host</th>
                  <th scope="col" className="px-1 py-3 font-normal">grade</th>
                  <th scope="col" className="px-1 py-3 text-right font-normal">score</th>
                  <th scope="col" className="px-1 py-3 text-right font-normal">findings</th>
                  <th scope="col" className="px-1 py-3 pl-6 font-normal">verification</th>
                  <th scope="col" className="px-1 py-3 font-normal">coverage</th>
                </tr>
              </thead>
              <tbody>
                {reachable.map((e, i) => {
                  const totalFindings = e.findings.critical + e.findings.high + e.findings.medium + e.findings.low
                  return (
                    <tr key={e.slug} className="border-b border-white/[.07] last:border-b-0">
                      <td className="px-1 py-3 font-mono text-xs tabular-nums text-ink-mute">{i + 1}</td>
                      <td className="px-1 py-3">
                        <Link href={`/leaderboard/${e.slug}`} className="font-mono text-[13px] text-ink hover:text-white">
                          {e.host}
                        </Link>
                      </td>
                      <td className="px-1 py-3"><span className={`g-grade g-grade-${e.grade}`}>{e.grade}</span></td>
                      <td className="font-display px-1 py-3 text-right text-xl tabular-nums">{e.score}</td>
                      <td className="px-1 py-3 text-right tabular-nums text-ink-soft">{totalFindings}</td>
                      <td className="px-1 py-3 pl-6"><VerificationPills counts={e.verificationCounts} /></td>
                      <td className="px-1 py-3 text-xs"><CoverageBadge entry={e} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <ol className="md:hidden">
            {reachable.map((e, i) => {
              const totalFindings = e.findings.critical + e.findings.high + e.findings.medium + e.findings.low
              return (
                <li key={e.slug} className="border-b border-white/[.07]">
                  <Link href={`/leaderboard/${e.slug}`} className="grid grid-cols-[32px_1fr_34px] items-center gap-3 py-3">
                    <span className="font-mono text-[11px] text-ink-mute">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-[13px] text-ink">{e.host}</span>
                      <span className="text-[11.5px] text-ink-mute">
                        {e.score} · {totalFindings} finding{totalFindings === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span className={`g-grade g-grade-${e.grade}`}>{e.grade}</span>
                  </Link>
                </li>
              )
            })}
          </ol>

          {unreachable.length > 0 && (
            <details className="mt-6 text-sm text-ink-mute">
              <summary className="cursor-pointer">{unreachable.length} host(s) unreachable on {capturedDate} — not scored</summary>
              <ul className="mt-2 columns-1 font-mono text-xs sm:columns-3">
                {unreachable.map((e) => <li key={e.slug}>{e.host}</li>)}
              </ul>
            </details>
          )}
        </section>

        <section className="relative z-10 mx-auto grid max-w-6xl gap-4 px-5 pt-14 sm:px-8 lg:grid-cols-[7fr_5fr]">
          <div className="g-glass g-tint-b p-7 text-sm">
            <h2 className="text-3xl">methodology</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-ink-soft">
              <li>Hosts: every server in the <a href="https://registry.modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" className="text-[#ffb38a] hover:text-white">official MCP Registry</a>, plus submitted entries.</li>
              <li>Two tiers per host: live metadata (public well-known OAuth documents + response headers, nothing authenticated) and static source (shallow-cloned from <code>repository.url</code> when available).</li>
              <li>Never authenticates against a third-party host. See <Link href="/about-crawler" className="text-[#ffb38a] hover:text-white">about the crawler</Link> for guard-rails and opt-out.</li>
              <li>Coverage: <strong className="text-ink">🔍 metadata</strong> live probe only · <strong className="text-ink">📦 source</strong> repo-only · <strong className="text-ink">✅ full</strong> both tiers · <strong className="text-ink">👤 operator</strong> operator-verified.</li>
              <li>Verification: <strong className="text-ink">confirmed</strong> = code path seen in source · <strong className="text-ink">verified</strong> = reproduced live · <strong className="text-ink">fp</strong> = pattern match, needs manual check. Outreach only cites confirmed findings.</li>
              <li>Checks: see the <Link href="/docs" className="text-[#ffb38a] hover:text-white">docs</Link>. Grade = 100 − Σ(finding × severity weight). Full rescan weekly; API at <code>/api/leaderboard</code>.</li>
            </ul>
          </div>
          <div className="g-glass g-tint-o p-7">
            <NewsletterSignup
              source="leaderboard"
              heading="Weekly leaderboard changes, in your inbox."
              pitch="Grade movements, new findings, resolved CVEs. One Tuesday email."
              variant="inline"
            />
          </div>
        </section>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
        />
      </main>
    </SiteShell>
  )
}

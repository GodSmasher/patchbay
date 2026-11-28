'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { GlowShape, SEV_CLASS, gradeClass } from '@/components/glow'

interface CohortStats { total: number; graded: number; dOrF: number }

interface TopFinding {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  title: string
  docsUrl: string
}

interface ScanResult {
  id: string
  url: string
  reachable: true
  grade: string
  score: number
  findings: { critical: number; high: number; medium: number; low: number; info: number }
  topFindings: TopFinding[]
}

interface ScanInconclusive {
  reachable: false
  target: string
  hint: string
}

type State =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'done'; result: ScanResult; target: string }
  | { kind: 'inconclusive'; result: ScanInconclusive; target: string }
  | { kind: 'error'; message: string }

type SaveState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'ok' }
  | { kind: 'error'; message: string }

const EXAMPLES = [
  'https://mcp.deepwiki.com/mcp',
  'https://mcp.context7.com/mcp',
]

export default function AuditPage() {
  const [url, setUrl] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [email, setEmail] = useState('')
  const [digest, setDigest] = useState(true)
  const [publish, setPublish] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })
  const [cohort, setCohort] = useState<CohortStats | null>(null)

  // Pull live cohort stats from the leaderboard snapshot so the three
  // stat tiles track the actual weekly re-scan rather than a hard-coded
  // snapshot. One shot on mount; the snapshot is cached at the edge.
  useEffect(() => {
    let cancelled = false
    fetch('/api/leaderboard')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return
        const entries: Array<{ grade?: string }> = d.entries || []
        const graded = entries.filter((e) => e.grade && e.grade !== 'unreachable').length
        const dOrF = entries.filter((e) => e.grade === 'D' || e.grade === 'F').length
        setCohort({ total: d.cohortSize ?? entries.length, graded, dOrF })
      })
      .catch(() => { /* leave null → tiles show "…" */ })
    return () => { cancelled = true }
  }, [])
  const fmt = (n: number | undefined) => (typeof n === 'number' ? n.toLocaleString('en-US') : '…')

  async function onScan(e: FormEvent) {
    e.preventDefault()
    setState({ kind: 'scanning' })
    setSaveState({ kind: 'idle' })
    try {
      const r = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const j = await r.json()
      if (!r.ok) { setState({ kind: 'error', message: j.error ?? 'scan failed' }); return }
      if (j && j.reachable === false) {
        setState({ kind: 'inconclusive', result: j as ScanInconclusive, target: url.trim() })
        return
      }
      setState({ kind: 'done', result: j as ScanResult, target: url.trim() })
    } catch (err) {
      setState({ kind: 'error', message: (err as Error).message })
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (state.kind !== 'done') return
    setSaveState({ kind: 'submitting' })
    try {
      const r = await fetch('/api/watch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          target: state.target,
          reportId: state.result.id,
          grade: state.result.grade,
          score: state.result.score,
          digestOptIn: digest,
          leaderboardOptIn: publish,
        }),
      })
      const j = await r.json()
      if (!r.ok) { setSaveState({ kind: 'error', message: j.error ?? 'could not save' }); return }
      setSaveState({ kind: 'ok' })
    } catch (err) {
      setSaveState({ kind: 'error', message: (err as Error).message })
    }
  }

  const shareText = state.kind === 'done'
    ? `Scanned ${state.target} with patchbay: grade ${state.result.grade}, score ${state.result.score}/100. https://patchbay-mcp.dev/report/${state.result.id}`
    : ''
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`
  const badgeMd = state.kind === 'done'
    ? `[![patchbay audit](https://patchbay-mcp.dev/api/badge/${state.result.id})](https://patchbay-mcp.dev/report/${state.result.id})`
    : ''


  return (
    <main>
      {/* ── hero ─────────────────────────────────────────────── */}
      <section className="relative">
        <GlowShape className="left-[18%] top-[-30px] h-[360px] w-[320px] sm:left-[24%] lg:h-[600px] lg:w-[540px]" />
        <GlowShape className="right-[-140px] top-[260px] hidden h-[340px] w-[300px] lg:block" delay={-5} hue={35} />

        <div className="relative z-10 mx-auto max-w-6xl px-5 pb-10 pt-14 sm:px-8 lg:pt-20">
          <p className="g-eyebrow">patchbay · mcp security audit</p>
          <h1 className="mt-6 text-[clamp(64px,12.5vw,156px)] leading-[.9]">
            <span className="block">audit</span>
            <span className="g-grad-text block pl-[0.9em] lg:pl-[3.5em]">your</span>
            <span className="block pl-[0.3em] lg:pl-[1.2em]">mcp server</span>
          </h1>

          <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
            <div>
              <p className="max-w-md text-[17px] leading-relaxed text-ink-soft">
                Paste the endpoint URL. 38 checks run server-side and you get the grade, the top
                findings and a shareable report — no sign-up, no install.
              </p>

              <form onSubmit={onScan} className="mt-7 flex max-w-xl flex-col gap-2 sm:flex-row sm:gap-0 sm:rounded-full sm:border sm:border-white/10 sm:bg-[rgba(18,18,22,.8)] sm:p-1.5 sm:pl-6">
                <label htmlFor="audit-url" className="sr-only">MCP endpoint URL</label>
                <input
                  id="audit-url"
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://your-server.example.com/mcp"
                  className="min-w-0 flex-1 rounded-full border border-white/10 bg-[rgba(18,18,22,.8)] px-5 py-4 font-mono text-sm text-ink placeholder:text-[#8e8e98] focus:border-[#ff8a55]/60 focus:outline-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-2"
                />
                <button type="submit" disabled={state.kind === 'scanning'} className="g-btn g-btn-o py-4 sm:py-3">
                  {state.kind === 'scanning' ? 'scanning…' : 'run audit'}
                </button>
              </form>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-mute">
                <span>try:</span>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setUrl(ex)}
                    className="g-glass g-pill px-3 py-1.5 font-mono text-[11.5px] text-ink-soft hover:text-white"
                  >
                    {ex.replace('https://', '')}
                  </button>
                ))}
              </div>
              <p className="mt-5 font-mono text-xs text-ink-mute">
                or locally: npx -y @patchbay-nebius/agent audit &lt;url&gt;
              </p>

              {state.kind === 'error' && (
                <div role="alert" className="mt-6 max-w-xl rounded-2xl border border-warn/40 bg-warn-soft p-4 text-sm text-warn">
                  {state.message}
                </div>
              )}
            </div>

            {/* Snapshot from the 2026-11-24 full-registry sweep, rescanned weekly. */}
            <dl className="-mx-5 flex gap-3 overflow-x-auto px-5 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
              <div className="g-glass flex-none rounded-2xl p-4 lg:w-auto" style={{ width: 160 }}>
                <dt className="sr-only">public servers crawled</dt>
                <dd className="font-display text-4xl leading-none tabular-nums">{fmt(cohort?.total)}</dd>
                <dd className="mt-1 text-xs text-ink-soft">public MCP servers crawled</dd>
              </div>
              <div className="g-glass flex-none rounded-2xl p-4 lg:w-auto" style={{ width: 160 }}>
                <dt className="sr-only">graded</dt>
                <dd className="font-display text-4xl leading-none tabular-nums">{fmt(cohort?.graded)}</dd>
                <dd className="mt-1 text-xs text-ink-soft">graded (reachable)</dd>
              </div>
              <div className="g-glass g-tint-o flex-none rounded-2xl p-4 lg:w-auto" style={{ width: 160 }}>
                <dt className="sr-only">D or F grade</dt>
                <dd className="font-display text-4xl leading-none text-[#ffb38a] tabular-nums">{fmt(cohort?.dOrF)}</dd>
                <dd className="mt-1 text-xs text-ink-soft">carry grade D or F</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* ── inconclusive (no MCP server at that URL) ─────────── */}
      {state.kind === 'inconclusive' && (
        <section className="relative mx-auto max-w-6xl px-5 py-10 sm:px-8" aria-live="polite">
          <div className="g-glass g-tint-o flex flex-col gap-3 rounded-2xl p-6">
            <p className="font-display text-3xl leading-tight">Inconclusive — no grade</p>
            <p className="break-all font-mono text-xs text-ink-mute">{state.target}</p>
            <p className="text-sm text-ink-soft">{state.result.hint}</p>
            <p className="text-xs text-ink-mute">
              A grade is only assigned when an MCP server actually responds to a JSON-RPC
              <code> initialize</code>. Nothing here was shareable, no badge was generated, no
              report was stored.
            </p>
          </div>
        </section>
      )}

      {/* ── result ───────────────────────────────────────────── */}
      {state.kind === 'done' && (
        <section className="relative mx-auto max-w-6xl px-5 py-10 sm:px-8" aria-live="polite">
          <div className="grid gap-4 lg:grid-cols-[5fr_7fr]">
            <div className="g-glass relative flex min-h-[340px] flex-col items-center justify-center overflow-hidden bg-[#08080b] p-6">
              <GlowShape className="inset-x-0 mx-auto top-6 h-[290px] w-[300px] " />
              <span className="font-display relative z-10 text-[160px] font-light leading-[.85]">{state.result.grade}</span>
              <span className="relative z-10 text-sm text-ink-soft">
                score <b className="font-semibold text-white">{state.result.score}</b> / 100
              </span>
              <span className="relative z-10 mt-1 break-all font-mono text-xs text-ink-mute">{state.target}</span>
            </div>

            <div className="flex flex-col gap-4">
              <div className="g-glass grid grid-cols-5 overflow-hidden rounded-2xl">
                {(['critical', 'high', 'medium', 'low', 'info'] as const).map((sev) => (
                  <div key={sev} className="border-r border-white/10 p-4 last:border-r-0">
                    <div className="font-display text-3xl">{state.result.findings[sev]}</div>
                    <span className={SEV_CLASS[sev]}>{sev === 'critical' ? 'crit' : sev}</span>
                  </div>
                ))}
              </div>

              {state.result.topFindings.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {state.result.topFindings.map((f) => (
                    <li key={f.id} className="g-glass rounded-2xl p-4">
                      <div className="flex items-center justify-between gap-4">
                        <code className="text-sm text-ink">{f.id}</code>
                        <span className={SEV_CLASS[f.severity]}>{f.severity}</span>
                      </div>
                      <p className="font-display mt-2 text-xl">{f.title}</p>
                      <a href={f.docsUrl} target="_blank" rel="noreferrer noopener" className="mt-1 inline-block text-sm text-[#ffb38a] hover:text-white">
                        spec reference + fix →
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap gap-2">
                <Link href={`/report/${state.result.id}`} className="g-btn g-btn-o">open full report →</Link>
                <a href={tweetUrl} target="_blank" rel="noreferrer noopener" className="g-btn g-btn-ghost">share on x</a>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="g-glass g-tint-o p-6">
              {saveState.kind === 'ok' ? (
                <div>
                  <p className="font-display text-2xl">saved. confirmation on the way.</p>
                  <p className="mt-2 text-sm text-ink-soft">
                    We mailed a confirmation link. Click it once and the report stays pinned to your email,
                    plus you&apos;re on the weekly digest if you ticked that. One-click unsubscribe on every mail.
                    See the <Link href="/privacy" className="underline underline-offset-2 hover:text-white">privacy policy</Link>.
                  </p>
                </div>
              ) : (
                <form onSubmit={onSave}>
                  <p className="font-display text-2xl">watch this server — weekly diffs by email</p>
                  <p className="mb-4 mt-2 text-sm text-ink-soft">
                    {state.result.grade === 'A' || state.result.grade === 'B'
                      ? `Grade ${state.result.grade} today. Keep it that way — we rescan weekly and email you if any finding changes on this host.`
                      : state.result.grade === 'C'
                      ? `Grade C today. Most C-grade MCP servers regress within six weeks of our first scan. Weekly diffs catch it.`
                      : `Grade ${state.result.grade} today. Fix the findings above, then let patchbay watch — weekly rescan, email on any change.`}
                    {' '}One-click unsubscribe. See the <Link href="/privacy" className="underline underline-offset-2 hover:text-white">privacy policy</Link>.
                  </p>
                  <div className="g-glass g-pill g-field mb-3">
                    <label htmlFor="save-email" className="sr-only">Email</label>
                    <input id="save-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
                    <button type="submit" disabled={saveState.kind === 'submitting'} className="g-btn g-btn-w">
                      {saveState.kind === 'submitting' ? 'saving…' : 'save + subscribe'}
                    </button>
                  </div>
                  <label className="mb-2 flex items-center gap-2 text-sm text-ink-soft">
                    <input type="checkbox" checked={digest} onChange={(e) => setDigest(e.target.checked)} className="accent-[#ff6a2b]" />
                    Yes, send the weekly MCP-security digest.
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink-soft">
                    <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="accent-[#ff6a2b]" />
                    Add this host to the public leaderboard.
                  </label>
                  {saveState.kind === 'error' && <p role="alert" className="mt-2 text-sm text-warn">{saveState.message}</p>}
                </form>
              )}
            </div>
            <div className="g-glass p-6">
              <p className="font-display text-2xl">badge for your readme</p>
              <p className="mb-3 mt-2 text-sm text-ink-soft">Copy this once. The badge re-renders with every fresh scan.</p>
              <pre className="overflow-x-auto rounded-xl border border-white/10 bg-[#0a0a0d] p-3 text-xs text-ink-soft">
                <code>{badgeMd}</code>
              </pre>
            </div>
          </div>
        </section>
      )}

      {/* ── runs where you work ──────────────────────────────── */}
      <section className="relative z-10 mx-auto grid max-w-6xl grid-cols-2 gap-3 px-5 pt-10 sm:grid-cols-3 sm:px-8 lg:grid-cols-6">
        {[
          ['npm cli', '@patchbay-nebius/agent'],
          ['github action', 'patchbay-audit@v1'],
          ['code scanning', 'SARIF upload'],
          ['your agent', 'Claude Code · Cursor · Codex'],
          ['slack', '/patchbay'],
          ['browser', 'patchbay-mcp.dev/scan'],
        ].map(([name, sub], i) => (
          <div
            key={name}
            className={`g-glass flex h-24 flex-col items-center justify-center gap-1 rounded-2xl text-center ${i === 0 ? 'bg-gradient-to-br from-[rgba(109,108,255,.18)] to-white/[.03]' : ''}`}
          >
            <span className="font-display text-xl font-medium">{name}</span>
            <span className="px-2 text-[11px] text-ink-mute">{sub}</span>
          </div>
        ))}
      </section>

      {/* ── how it runs ──────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pt-24 sm:px-8">
        <h2 className="text-center text-[clamp(38px,6vw,56px)] leading-none">how an audit runs</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="g-glass g-tint-b flex min-h-[260px] flex-col justify-between p-7">
            <div>
              <p className="font-mono text-[11px] text-[#ffb38a]">01 · probe + snapshot</p>
              <p className="font-display mt-3 text-[28px] leading-tight">fetch what a client would, then freeze it</p>
            </div>
            <p className="text-sm text-ink-soft">The OAuth documents under <code>/.well-known</code>, <code>initialize</code>, <code>tools/list</code> with and without a dummy bearer. 8-second budget.</p>
          </div>
          <div className="g-glass g-tint-o relative flex min-h-[260px] flex-col justify-between overflow-hidden p-7">
            <div aria-hidden="true" className="relative mx-auto h-[150px] w-[160px]">
              <div className="g-blob g-soft" />
              <div className="g-blob" />
            </div>
            <div>
              <p className="font-mono text-[11px] text-[#ffb38a]">02 · checks</p>
              <p className="font-display mt-2 text-[28px] leading-tight">pure functions, no i/o</p>
              <p className="mt-2 text-sm text-ink-soft">Severity reads the server&apos;s context, so reports stay short.</p>
            </div>
          </div>
          <div className="g-glass flex min-h-[260px] flex-col justify-between p-7" style={{ background: 'radial-gradient(120% 80% at 100% 0%, rgba(77,76,255,.24), transparent 60%), #0d0d11' }}>
            <div>
              <p className="font-mono text-[11px] text-[#ffb38a]">03 · report</p>
              <p className="font-display mt-3 text-[28px] leading-tight">grade, then gate</p>
            </div>
            <p className="text-sm text-ink-soft">Start at 100: critical −30, high −15, medium −5, low −1. <code>--ci</code> fails the build; <code>--sarif</code> feeds code scanning.</p>
          </div>
        </div>
      </section>

      {/* ── what it catches ──────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pt-24 sm:px-8">
        <h2 className="text-center text-[clamp(38px,6vw,56px)] leading-none">what it catches</h2>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['auth-001', 'AUTH-001 · 002 · 007', 'missing or fake auth', 'Tool listing without credentials, static keys with no OAuth discovery, the wrong status for a bad token.'],
            ['auth-003', 'AUTH-003 · 005 · 006 · ISS-001', 'metadata that blocks clients', 'No PKCE S256, no CIMD or DCR, loopback redirects rejected, no iss parameter.'],
            ['audience-001', 'AUDIENCE-001 · 002 · RESOURCE-001', 'token audience bugs', 'Sibling-resource tokens accepted, JWTs with no aud slipping through, RFC 9728 document missing.'],
            ['pkce-001', 'PKCE-001 · 002 · IMPLICIT-001', 'what oauth 2.1 removed', 'Codes without a challenge, plain PKCE, implicit tokens, unregistered redirects.'],
            ['transport-001', 'TRANSPORT-001 · 002 · HEADERS-001', 'transport', 'Plain HTTP, foreign origins accepted, missing security headers.'],
            ['poisoning-001', 'POISONING-001 · 002 · 003', 'tool poisoning and drift', 'Hidden characters, text addressed to the model, tools that changed after you approved them.'],
          ].map(([slug, ids, title, body]) => (
            <Link key={slug} href={`/docs/${slug}`} className="g-glass flex flex-col gap-2 rounded-[18px] p-6 hover:border-white/20">
              <span className="font-mono text-[11px] text-[#ffb38a]">{ids}</span>
              <span className="font-display text-2xl">{title}</span>
              <span className="text-sm leading-relaxed text-ink-soft">{body}</span>
            </Link>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-ink-mute">
          Methodology is public: <Link href="/scanning" className="text-[#ffb38a] hover:text-white">what we read and never do</Link> · <Link href="/docs" className="text-[#ffb38a] hover:text-white">every check</Link> · <Link href="/leaderboard" className="text-[#ffb38a] hover:text-white">see how the public registry grades today</Link>
        </p>
      </section>

      {/* ── waitlist ─────────────────────────────────────────── */}
      <section id="waitlist" className="relative mx-auto mt-16 max-w-6xl scroll-mt-6 px-5 sm:px-8">
        <GlowShape className="inset-x-0 mx-auto top-4 h-[360px] w-[340px]  lg:h-[460px] lg:w-[520px]" delay={-3} />
        <div className="relative z-10 mx-auto flex min-h-[460px] max-w-xl flex-col items-center justify-center gap-4 text-center">
          <span className="g-eyebrow">hosted scans · January 2027</span>
          <h2 className="text-[clamp(40px,6vw,60px)] leading-none">get told when a server you trust changes.</h2>
          <p className="text-[15px] text-ink-soft">
            Scheduled rescans, drift alerts, history per server. Most servers on today&apos;s leaderboard
            that start at a C regress to D within six weeks. Weekly diffs catch it. The first 100 teams
            get 50% off the annual plan — $149 instead of $298.
          </p>
          <Link href="/early-access" className="g-btn g-btn-o mt-2 px-8 py-4 text-[15px]">claim a founding spot</Link>
          <Link href="/leaderboard" className="text-sm text-ink-mute hover:text-white">or see the full cohort →</Link>
        </div>
      </section>
    </main>
  )
}

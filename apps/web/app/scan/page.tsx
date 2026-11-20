'use client'

import { useState, useEffect, type FormEvent } from 'react'
import Link from 'next/link'
import { GlowShape, gradeClass } from '@/components/glow'

interface ScanResult {
  id: string
  url: string
  grade: string
  score: number
  findings: { critical: number; high: number; medium: number; low: number; info: number }
}

type State =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'done'; result: ScanResult; target: string }
  | { kind: 'error'; message: string }

type WatchState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'ok'; watcherCount: number }
  | { kind: 'error'; message: string }

const EXAMPLES = [
  'https://mcp.deepwiki.com/mcp',
  'https://mcp.context7.com/mcp',
]

export default function ScanPage() {
  const [url, setUrl] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [email, setEmail] = useState('')
  const [watchState, setWatchState] = useState<WatchState>({ kind: 'idle' })
  const [initialWatcherCount, setInitialWatcherCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/watch').then((r) => r.json()).then((j) => {
      if (typeof j.watcherCount === 'number') setInitialWatcherCount(j.watcherCount)
    }).catch(() => {})
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setState({ kind: 'scanning' })
    setWatchState({ kind: 'idle' })
    try {
      const r = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const j = await r.json()
      if (!r.ok) {
        setState({ kind: 'error', message: j.error ?? 'scan failed' })
        return
      }
      setState({ kind: 'done', result: j as ScanResult, target: url.trim() })
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message })
    }
  }

  async function onWatch(e: FormEvent) {
    e.preventDefault()
    if (state.kind !== 'done') return
    setWatchState({ kind: 'submitting' })
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
        }),
      })
      const j = await r.json()
      if (!r.ok) {
        setWatchState({ kind: 'error', message: j.error ?? 'could not save' })
        return
      }
      setWatchState({ kind: 'ok', watcherCount: j.watcherCount })
    } catch (e) {
      setWatchState({ kind: 'error', message: (e as Error).message })
    }
  }

  const shareText = state.kind === 'done'
    ? `Scanned ${state.target} with patchbay: grade ${state.result.grade}, score ${state.result.score}/100. https://patchbay-mcp.dev/report/${state.result.id}`
    : ''
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`

  return (
    <main className="relative">
      <GlowShape className="right-[-60px] top-[-60px] h-[320px] w-[300px] sm:right-[2%] lg:h-[560px] lg:w-[560px]" />
      <div className="relative z-10 mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 lg:pt-20">
        <p className="g-eyebrow">free · no install · no account</p>
        <h1 className="mt-6 text-[clamp(64px,11vw,132px)] leading-[.92]">
          <span className="block">scan an</span>
          <span className="block pl-[0.6em] lg:pl-[1.4em]">mcp server</span>
        </h1>
        <p className="mt-8 max-w-xl text-[17px] leading-relaxed text-ink-soft">
          Paste the URL. We run every check that works from a URL without credentials, store the
          report and give you a public link you can share. No install, no account.
        </p>

        <form onSubmit={onSubmit} className="mt-8 max-w-2xl">
          <label htmlFor="url" className="sr-only">MCP endpoint URL</label>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-0 sm:rounded-full sm:border sm:border-white/10 sm:bg-[rgba(18,18,22,.8)] sm:p-1.5 sm:pl-6">
            <input
              id="url"
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-server.example.com/mcp"
              className="min-w-0 flex-1 rounded-full border border-white/10 bg-[rgba(18,18,22,.8)] px-5 py-4 font-mono text-sm text-ink placeholder:text-[#8e8e98] focus:border-[#ff8a55]/60 focus:outline-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-2"
            />
            <button type="submit" disabled={state.kind === 'scanning'} className="g-btn g-btn-o py-4 sm:py-3">
              {state.kind === 'scanning' ? 'scanning…' : 'run scan'}
            </button>
          </div>
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
        </form>

        {state.kind === 'error' && (
          <div className="mt-8 p-4 border border-warn/40 bg-warn-soft rounded text-warn text-sm">
            {state.message}
          </div>
        )}

        {state.kind === 'done' && (
          <>
            <div className="mt-10 max-w-2xl g-glass p-6">
              <div className="flex items-center gap-4 mb-4">
                <span className={gradeClass(state.result.grade)} style={{ width: 64, height: 64, fontSize: 30 }}>{state.result.grade}</span>
                <span className="text-ink-soft">score {state.result.score} / 100</span>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-ink-soft mb-6">
                <span>critical {state.result.findings.critical}</span>
                <span>high {state.result.findings.high}</span>
                <span>medium {state.result.findings.medium}</span>
                <span>low {state.result.findings.low}</span>
                <span>info {state.result.findings.info}</span>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/report/${state.result.id}`}
                  className="inline-block px-4 py-2 bg-ink text-paper rounded font-medium hover:opacity-90"
                >
                  Open full report →
                </Link>
                <a
                  href={tweetUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-block px-4 py-2 border border-paper-line rounded font-medium text-ink-soft hover:text-ink hover:border-ink"
                >
                  Share grade
                </a>
              </div>
            </div>

            <div className="mt-4 max-w-2xl g-glass g-tint-o p-6">
              {watchState.kind === 'ok' ? (
                <div>
                  <p className="text-ink font-medium mb-1">You are on the early-access list.</p>
                  <p className="text-sm text-ink-soft">
                    Hosted monitoring (weekly change alerts for watched servers) launches January 2027.
                    You will get one email when it goes live, nothing before. Every email carries a
                    one-click unsubscribe. See the <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">privacy policy</Link>.
                    {' '}<span className="text-ink-mute">{watchState.watcherCount} {watchState.watcherCount === 1 ? 'scan is' : 'scans are'} on the list so far.</span>
                  </p>
                </div>
              ) : (
                <form onSubmit={onWatch}>
                  <p className="text-ink font-medium mb-1">Watch this server</p>
                  <p className="text-sm text-ink-soft mb-4">
                    Get on the early-access list for weekly change alerts. One email when hosted monitoring
                    launches (Jan 2027), nothing before. One-click unsubscribe in every email.
                    See the <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">privacy policy</Link>.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="flex-1 px-4 py-3 bg-paper border border-paper-line rounded text-ink placeholder:text-ink-mute focus:outline-none focus:border-ink"
                    />
                    <button
                      type="submit"
                      disabled={watchState.kind === 'submitting'}
                      className="px-5 py-3 bg-ink text-paper rounded font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      {watchState.kind === 'submitting' ? 'Saving…' : 'Watch'}
                    </button>
                  </div>
                  {watchState.kind === 'error' && (
                    <p className="mt-2 text-sm text-warn">{watchState.message}</p>
                  )}
                  {initialWatcherCount !== null && initialWatcherCount > 0 && (
                    <p className="mt-3 text-xs text-ink-mute">
                      {initialWatcherCount} {initialWatcherCount === 1 ? 'scan is' : 'scans are'} already being watched.
                    </p>
                  )}
                </form>
              )}
            </div>
          </>
        )}

        <div className="mt-16 max-w-2xl pt-8 border-t border-paper-line text-sm text-ink-mute space-y-2">
          <p>
            Prefer the CLI? <code className="text-ink-soft">npx -y @patchbay-nebius/agent audit {'<url>'}</code>
          </p>
          <p>
            Scans run server-side with an 8-second timeout. Reports are public and cached for 90 days.
          </p>
        </div>
      </div>
    </main>
  )
}

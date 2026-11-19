'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'

interface TopFinding {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  title: string
  docsUrl: string
}

interface ScanResult {
  id: string
  url: string
  grade: string
  score: number
  findings: { critical: number; high: number; medium: number; low: number; info: number }
  topFindings: TopFinding[]
}

type State =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'done'; result: ScanResult; target: string }
  | { kind: 'error'; message: string }

type SaveState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'ok' }
  | { kind: 'error'; message: string }

const SEVERITY_COLOR: Record<TopFinding['severity'], string> = {
  critical: 'text-warn',
  high: 'text-warn',
  medium: 'text-ink',
  low: 'text-ink-soft',
  info: 'text-ink-mute',
}

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
    <main className="bg-paper text-ink">
      <section className="px-6 pt-20 pb-12 border-b border-paper-line">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-ink-mute mb-3">patchbay · MCP security audit</p>
          <h1 className="text-5xl font-semibold text-ink leading-tight mb-5">
            Audit your MCP server in 30 seconds.
          </h1>
          <p className="text-lg text-ink-soft mb-10 max-w-xl">
            Paste the endpoint URL. 37 checks run server-side and you get the grade, the top findings
            and a shareable report — no sign-up, no install.
          </p>

          <form onSubmit={onScan} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                id="audit-url"
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://mcp.example.com/mcp"
                className="flex-1 px-5 py-4 bg-paper-card border border-paper-line rounded text-ink text-lg placeholder:text-ink-mute focus:outline-none focus:border-ink"
                aria-label="MCP endpoint URL"
              />
              <button
                type="submit"
                disabled={state.kind === 'scanning'}
                className="px-6 py-4 bg-ink text-paper rounded font-medium text-lg hover:opacity-90 disabled:opacity-50"
              >
                {state.kind === 'scanning' ? 'Scanning…' : 'Audit →'}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-mute">
              <span>try:</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setUrl(ex)}
                  className="text-ink-soft hover:text-ink underline underline-offset-2"
                >
                  {ex}
                </button>
              ))}
            </div>
          </form>

          {state.kind === 'error' && (
            <div className="mt-8 p-4 border border-warn/40 bg-warn-soft rounded text-warn text-sm">
              {state.message}
            </div>
          )}
        </div>
      </section>

      {state.kind === 'done' && (
        <section className="px-6 py-12 border-b border-paper-line">
          <div className="mx-auto max-w-3xl space-y-8">
            <div className="p-6 border border-paper-line bg-paper-card rounded">
              <div className="flex items-baseline gap-4 mb-3">
                <span className="text-6xl font-semibold text-ink">{state.result.grade}</span>
                <span className="text-ink-soft">score {state.result.score} / 100 · {state.target}</span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-ink-soft">
                <span><strong className="text-warn">{state.result.findings.critical}</strong> critical</span>
                <span><strong className="text-warn">{state.result.findings.high}</strong> high</span>
                <span><strong className="text-ink">{state.result.findings.medium}</strong> medium</span>
                <span><strong>{state.result.findings.low}</strong> low</span>
                <span><strong>{state.result.findings.info}</strong> info</span>
              </div>
            </div>

            {state.result.topFindings.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-ink mb-4">Top findings</h2>
                <ul className="space-y-3">
                  {state.result.topFindings.map((f) => (
                    <li key={f.id} className="p-4 border border-paper-line bg-paper-card rounded">
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <code className={`text-sm font-semibold ${SEVERITY_COLOR[f.severity]}`}>{f.id}</code>
                        <span className="text-xs text-ink-mute uppercase">{f.severity}</span>
                      </div>
                      <p className="text-ink mb-2">{f.title}</p>
                      <a href={f.docsUrl} target="_blank" rel="noreferrer noopener" className="text-sm text-ink-soft underline underline-offset-2 hover:text-ink">
                        Spec reference + fix →
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
                Share on X
              </a>
            </div>

            <div className="p-6 border border-ink/15 bg-paper-card rounded">
              {saveState.kind === 'ok' ? (
                <div>
                  <p className="text-ink font-medium mb-1">Saved. Confirmation on the way.</p>
                  <p className="text-sm text-ink-soft">
                    We mailed a confirmation link. Click it once and the report stays pinned to your email,
                    plus you&apos;re on the weekly digest if you ticked that. One-click unsubscribe on every mail.
                    See the <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">privacy policy</Link>.
                  </p>
                </div>
              ) : (
                <form onSubmit={onSave}>
                  <p className="text-ink font-medium mb-1">Save this report + get weekly rescan alerts</p>
                  <p className="text-sm text-ink-soft mb-4">
                    We email you if any new finding surfaces on this host and a short weekly digest of
                    ecosystem-wide drift. One-click unsubscribe. See the{' '}
                    <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">privacy policy</Link>.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 mb-3">
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
                      disabled={saveState.kind === 'submitting'}
                      className="px-5 py-3 bg-ink text-paper rounded font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      {saveState.kind === 'submitting' ? 'Saving…' : 'Save + subscribe'}
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-ink-soft mb-2">
                    <input type="checkbox" checked={digest} onChange={(e) => setDigest(e.target.checked)} />
                    Yes, send the weekly MCP-security digest.
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink-soft">
                    <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
                    Add this host to the public leaderboard.
                  </label>
                  {saveState.kind === 'error' && (
                    <p className="mt-2 text-sm text-warn">{saveState.message}</p>
                  )}
                </form>
              )}
            </div>

            <div className="p-6 border border-paper-line bg-paper-card rounded">
              <p className="text-ink font-medium mb-2">Put the grade in your README</p>
              <p className="text-sm text-ink-soft mb-3">Copy this once. The badge re-renders with every fresh scan.</p>
              <pre className="text-xs bg-paper border border-paper-line rounded p-3 overflow-x-auto text-ink-soft">
                <code>{badgeMd}</code>
              </pre>
            </div>
          </div>
        </section>
      )}

      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl grid gap-8 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-ink font-medium mb-2">37 checks, source-confirmed first</p>
            <p className="text-ink-soft">
              OAuth 2.1 / RFC 9728 / RFC 8693 metadata, MCP spec 2026-07-28 conformance, poisoning
              + manifest drift, transport headers. Every finding carries verification tier.
            </p>
          </div>
          <div>
            <p className="text-ink font-medium mb-2">No sign-up, no install</p>
            <p className="text-ink-soft">
              Scans run server-side with an 8-second timeout. Reports stay live for 90 days and have
              their own public URL. Prefer the CLI? <code>npx -y @patchbay-nebius/agent audit {'<url>'}</code>
            </p>
          </div>
          <div>
            <p className="text-ink font-medium mb-2">Methodology is public</p>
            <p className="text-ink-soft">
              What we read, what we never do, how findings are labeled — see{' '}
              <Link href="/scanning" className="underline underline-offset-2 hover:text-ink">/scanning</Link> and the
              per-check write-ups at <Link href="/docs" className="underline underline-offset-2 hover:text-ink">/docs</Link>.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

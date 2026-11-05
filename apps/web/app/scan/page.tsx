'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'

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
  | { kind: 'done'; result: ScanResult; emailCaptured: boolean }
  | { kind: 'error'; message: string }

const EXAMPLES = [
  'https://mcp.deepwiki.com/mcp',
  'https://mcp.context7.com/mcp',
]

export default function ScanPage() {
  const [url, setUrl] = useState('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setState({ kind: 'scanning' })
    try {
      const r = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), email: email.trim() || undefined }),
      })
      const j = await r.json()
      if (!r.ok) {
        setState({ kind: 'error', message: j.error ?? 'scan failed' })
        return
      }
      setState({ kind: 'done', result: j as ScanResult, emailCaptured: Boolean(email.trim()) })
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message })
    }
  }

  return (
    <main className="min-h-screen bg-paper text-ink px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <nav className="mb-10 text-sm text-ink-mute">
          <Link href="/" className="hover:text-ink">patchbay</Link>
          <span className="mx-2">/</span>
          <span className="text-ink">scan</span>
        </nav>

        <h1 className="text-3xl font-semibold text-ink mb-2">Scan an MCP server</h1>
        <p className="text-ink-soft mb-10">
          Paste the URL. We run the same 14 checks the CLI does, store the report,
          and give you a public link you can share. No install, no account.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="url" className="block text-sm text-ink mb-2">
              MCP endpoint URL
            </label>
            <input
              id="url"
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://mcp.example.com/mcp"
              className="w-full px-4 py-3 bg-paper-card border border-paper-line rounded text-ink placeholder:text-ink-mute focus:outline-none focus:border-ink"
            />
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="text-ink-mute">try:</span>
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
          </div>

          <div>
            <label htmlFor="email" className="block text-sm text-ink mb-2">
              Email <span className="text-ink-mute">(optional, for weekly change alerts when hosted monitoring launches Jan 2027)</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-4 py-3 bg-paper-card border border-paper-line rounded text-ink placeholder:text-ink-mute focus:outline-none focus:border-ink"
            />
          </div>

          <button
            type="submit"
            disabled={state.kind === 'scanning'}
            className="px-5 py-3 bg-ink text-paper rounded font-medium hover:opacity-90 disabled:opacity-50"
          >
            {state.kind === 'scanning' ? 'Scanning…' : 'Run scan'}
          </button>
        </form>

        {state.kind === 'error' && (
          <div className="mt-8 p-4 border border-warn/40 bg-warn-soft rounded text-warn text-sm">
            {state.message}
          </div>
        )}

        {state.kind === 'done' && (
          <div className="mt-10 p-6 border border-paper-line bg-paper-card rounded">
            <div className="flex items-baseline gap-4 mb-4">
              <span className="text-5xl font-semibold text-ink">{state.result.grade}</span>
              <span className="text-ink-soft">score {state.result.score} / 100</span>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-ink-soft mb-6">
              <span>critical {state.result.findings.critical}</span>
              <span>high {state.result.findings.high}</span>
              <span>medium {state.result.findings.medium}</span>
              <span>low {state.result.findings.low}</span>
              <span>info {state.result.findings.info}</span>
            </div>
            <Link
              href={`/report/${state.result.id}`}
              className="inline-block px-4 py-2 bg-ink text-paper rounded font-medium hover:opacity-90"
            >
              Open full report →
            </Link>
            {state.emailCaptured && (
              <p className="mt-4 text-sm text-ink-mute">
                We saved your email. You will get a note when the server changes or when hosted monitoring goes live.
              </p>
            )}
          </div>
        )}

        <div className="mt-16 pt-8 border-t border-paper-line text-sm text-ink-mute space-y-2">
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

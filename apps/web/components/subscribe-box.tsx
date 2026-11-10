'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'

type State =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'ok' }
  | { kind: 'error'; message: string }

/**
 * Early-access signup for pages where nothing was scanned (blog, docs).
 * Same list and same promise as the Watch form on /scan: one email when
 * hosted monitoring launches, nothing before.
 */
export function SubscribeBox({ page }: { page: string }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setState({ kind: 'submitting' })
    try {
      const r = await fetch('/api/watch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source: 'site', page }),
      })
      const j = await r.json()
      if (!r.ok) {
        setState({ kind: 'error', message: j.error ?? 'could not save' })
        return
      }
      setState({ kind: 'ok' })
    } catch (err) {
      setState({ kind: 'error', message: (err as Error).message })
    }
  }

  return (
    <aside className="mt-16 p-6 border border-ink/15 bg-paper-card rounded" aria-label="Early access signup">
      {state.kind === 'ok' ? (
        <div role="status">
          <p className="text-ink font-medium mb-1">You are on the early-access list.</p>
          <p className="text-sm text-ink-soft">
            You will get one email when hosted monitoring goes live, nothing before. Want a grade for
            a server right now?{' '}
            <Link href="/scan" className="underline underline-offset-2 hover:text-ink">
              Run a scan
            </Link>
            .
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit}>
          <p className="text-ink font-medium mb-1">Get hosted monitoring first</p>
          <p className="text-sm text-ink-soft mb-4">
            Scheduled scans and change alerts for your MCP servers launch January 2027. Leave your
            email for one message when it goes live, nothing before. One-click unsubscribe in every
            email. See the{' '}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
              privacy policy
            </Link>
            .
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <label htmlFor="subscribe-email" className="sr-only">
              Email address
            </label>
            <input
              id="subscribe-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="flex-1 px-4 py-3 bg-paper border border-paper-line rounded text-ink placeholder:text-ink-mute focus:outline-none focus:border-ink"
            />
            <button
              type="submit"
              disabled={state.kind === 'submitting'}
              className="px-5 py-3 bg-ink text-paper rounded font-medium hover:opacity-90 disabled:opacity-50"
            >
              {state.kind === 'submitting' ? 'Saving…' : 'Notify me'}
            </button>
          </div>
          {state.kind === 'error' && (
            <p className="mt-2 text-sm text-warn" role="alert">
              {state.message}
            </p>
          )}
        </form>
      )}
    </aside>
  )
}

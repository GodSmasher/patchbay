'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'

type State =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'ok' }
  | { kind: 'error'; message: string }

interface NewsletterSignupProps {
  /** Where this instance is mounted — carried into Resend as `source` for attribution. */
  source: string
  /** Optional heading override. Default: "Weekly MCP security digest." */
  heading?: string
  /** Optional one-line pitch override. */
  pitch?: string
  /** Render style. 'hero' is bordered card; 'inline' is slimmer for below-fold placement. */
  variant?: 'hero' | 'inline'
}

export function NewsletterSignup({
  source,
  heading = 'Weekly MCP security digest.',
  pitch = 'Grade changes, new findings, OWASP movements. Every Tuesday.',
  variant = 'hero',
}: NewsletterSignupProps) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setState({ kind: 'submitting' })
    try {
      const r = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setState({ kind: 'error', message: j.error ?? 'could not subscribe' })
        return
      }
      setState({ kind: 'ok' })
    } catch (err) {
      setState({ kind: 'error', message: (err as Error).message })
    }
  }

  const containerClass = variant === 'hero'
    ? 'mt-10 p-6 border border-ink/15 bg-paper-card rounded'
    : 'mt-8 p-5 border border-ink/10 bg-paper-card rounded'

  if (state.kind === 'ok') {
    return (
      <aside className={containerClass} aria-label="Newsletter signup" data-umami-event="newsletter-subscribed">
        <div role="status">
          <p className="text-ink font-medium mb-1">Check your inbox.</p>
          <p className="text-sm text-ink-soft">
            We sent a confirmation email. One click there and you are on the list. Want to grade a server right now?{' '}
            <Link href="/leaderboard" className="underline underline-offset-2 hover:text-ink">
              See the leaderboard
            </Link>
            .
          </p>
        </div>
      </aside>
    )
  }

  return (
    <aside className={containerClass} aria-label="Newsletter signup">
      <form onSubmit={onSubmit}>
        <p className="text-ink font-medium mb-1">{heading}</p>
        <p className="text-sm text-ink-soft mb-4">
          {pitch} One-click unsubscribe in every email. See the{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">privacy policy</Link>.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <label htmlFor={`newsletter-email-${source}`} className="sr-only">Email address</label>
          <input
            id={`newsletter-email-${source}`}
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
            data-umami-event="newsletter-signup-submit"
            data-umami-event-source={source}
          >
            {state.kind === 'submitting' ? 'Saving…' : 'Get the digest'}
          </button>
        </div>
        {state.kind === 'error' && (
          <p className="mt-2 text-sm text-warn" role="alert">{state.message}</p>
        )}
      </form>
    </aside>
  )
}

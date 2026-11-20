'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'

interface Totals {
  claimed: number
  limit: number
  remaining: number
}

type State =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'done'; position: number; founding: boolean; alreadyClaimed: boolean }
  | { kind: 'error'; message: string }

/**
 * Live counter + sign-up form for /early-access. The page renders the count
 * on the server; this refreshes it on mount and after a successful claim.
 */
export function FoundingClaim({ initial, refTag, prefillUrl }: { initial: Totals; refTag?: string; prefillUrl?: string }) {
  const [totals, setTotals] = useState<Totals>(initial)
  const [email, setEmail] = useState('')
  const [serverUrl, setServerUrl] = useState(prefillUrl ?? '')
  const [state, setState] = useState<State>({ kind: 'idle' })

  useEffect(() => {
    fetch('/api/founding', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: Totals) => typeof j.claimed === 'number' && setTotals(j))
      .catch(() => {})
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setState({ kind: 'submitting' })
    try {
      const r = await fetch('/api/founding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), serverUrl: serverUrl.trim() || undefined, ref: refTag }),
      })
      const j = await r.json()
      if (!r.ok) {
        setState({ kind: 'error', message: j.error ?? 'could not save' })
        return
      }
      setTotals({ claimed: j.claimed, limit: j.limit, remaining: j.remaining })
      setState({ kind: 'done', position: j.position, founding: j.founding, alreadyClaimed: j.alreadyClaimed })
    } catch (err) {
      setState({ kind: 'error', message: (err as Error).message })
    }
  }

  const soldOut = totals.remaining <= 0
  const pct = Math.min(100, (totals.claimed / totals.limit) * 100)

  return (
    <div className="flex flex-col gap-6">
      {/* counter */}
      <div aria-live="polite">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm text-ink-soft">
            <span className="font-display text-4xl text-white">{totals.claimed}</span>
            <span className="text-ink-mute"> / {totals.limit}</span> founding spots claimed
          </p>
          <p className={`text-sm ${soldOut ? 'text-ink-mute' : 'text-[#ffb38a]'}`}>
            {soldOut ? 'all taken' : `${totals.remaining} left`}
          </p>
        </div>
        <div
          className="mt-3 h-2 rounded-full bg-white/[.08]"
          role="progressbar"
          aria-label="Founding spots claimed"
          aria-valuemin={0}
          aria-valuemax={totals.limit}
          aria-valuenow={totals.claimed}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#6d6cff] to-[#ff6a2b] transition-[width] duration-700"
            style={{ width: `${pct}%`, minWidth: totals.claimed > 0 ? 8 : 0 }}
          />
        </div>
      </div>

      {state.kind === 'done' ? (
        <div className="g-glass g-tint-o p-6">
          {state.founding ? (
            <>
              <p className="g-eyebrow">{state.alreadyClaimed ? 'already yours' : 'spot claimed'}</p>
              <p className="font-display mt-2 text-4xl leading-tight">you&apos;re founding member #{state.position}.</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                $149 a year is locked for you. Nothing is charged now — we email you once when hosted
                scans launch in January 2027, and you decide then.
              </p>
            </>
          ) : (
            <>
              <p className="g-eyebrow">on the waitlist</p>
              <p className="font-display mt-2 text-4xl leading-tight">all 100 spots are gone — you&apos;re #{state.position}.</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                We email you once when hosted scans launch in January 2027.
              </p>
            </>
          )}
          <Link href="/scan" className="g-btn g-btn-ghost mt-5">scan a server meanwhile</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label htmlFor="fc-email" className="sr-only">Work email</label>
          <input
            id="fc-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="rounded-full border border-white/10 bg-[rgba(18,18,22,.8)] px-5 py-4 text-[15px] text-ink placeholder:text-[#8e8e98] focus:border-[#ff8a55]/60 focus:outline-none"
          />
          <label htmlFor="fc-url" className="sr-only">Your MCP server URL (optional)</label>
          <input
            id="fc-url"
            type="url"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="your MCP server URL (optional)"
            className="rounded-full border border-white/10 bg-[rgba(18,18,22,.8)] px-5 py-4 font-mono text-sm text-ink placeholder:text-[#8e8e98] focus:border-[#ff8a55]/60 focus:outline-none"
          />
          <button type="submit" disabled={state.kind === 'submitting'} className="g-btn g-btn-o py-4 text-[15px]">
            {state.kind === 'submitting' ? 'claiming…' : soldOut ? 'join the waitlist' : 'claim my founding spot'}
          </button>
          {state.kind === 'error' && (
            <p role="alert" className="text-sm text-warn">{state.message}</p>
          )}
          <p className="text-xs leading-relaxed text-ink-mute">
            No card, no commitment. One email at launch, nothing before; one-click unsubscribe.
            See the <Link href="/privacy" className="underline underline-offset-2 hover:text-white">privacy policy</Link>.
          </p>
        </form>
      )}
    </div>
  )
}

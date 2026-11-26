'use client'

// Sign-in page — magic-link via Supabase Auth. Lives outside the /app
// gate (middleware checks path.startsWith('/app')). The ?next= param
// carries the originally requested URL so a successful sign-in can
// return the user there.

import { Suspense, useState, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string }

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInInner />
    </Suspense>
  )
}

function SignInInner() {
  const params = useSearchParams()
  const next = params.get('next') || '/app'
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setState({ kind: 'sending' })
    try {
      const supabase = createClient()
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      })
      if (error) {
        setState({ kind: 'error', message: error.message })
        return
      }
      setState({ kind: 'sent', email: email.trim() })
    } catch (err) {
      setState({ kind: 'error', message: (err as Error).message })
    }
  }

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-16">
      <h1 className="font-display text-5xl leading-none">Sign in</h1>
      <p className="mt-4 text-sm text-ink-soft">
        Magic-link only — no password. We'll email you a one-time link that signs you in on this device.
      </p>

      {state.kind === 'sent' ? (
        <div className="g-glass mt-8 rounded-2xl p-5 text-sm">
          <p>
            Link sent to <b>{state.email}</b>. Check your inbox, click the link, you're signed in.
          </p>
          <p className="mt-2 text-ink-mute">The link expires in 1 hour. Nothing else gets emailed to you.</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-2 sm:flex-row sm:gap-0 sm:rounded-full sm:border sm:border-white/10 sm:bg-[rgba(18,18,22,.8)] sm:p-1.5 sm:pl-6">
          <label htmlFor="signin-email" className="sr-only">
            Email
          </label>
          <input
            id="signin-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-[rgba(18,18,22,.8)] px-5 py-4 font-mono text-sm text-ink placeholder:text-[#8e8e98] focus:border-[#ff8a55]/60 focus:outline-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-2"
          />
          <button type="submit" disabled={state.kind === 'sending'} className="g-btn g-btn-o py-4 sm:py-3">
            {state.kind === 'sending' ? 'sending…' : 'email me a link'}
          </button>
        </form>
      )}

      {state.kind === 'error' && (
        <div role="alert" className="mt-4 rounded-2xl border border-warn/40 bg-warn-soft p-3 text-sm text-warn">
          {state.message}
        </div>
      )}

      <p className="mt-10 text-xs text-ink-mute">
        New here? The same form creates your account on first sign-in. By continuing you agree to the{' '}
        <Link href="/privacy" className="underline">
          privacy policy
        </Link>
        .
      </p>
    </main>
  )
}

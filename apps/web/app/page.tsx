'use client'

import { useEffect, useState } from 'react'
import { CodePanel } from '@/components/code-panel'
import { PlanCard } from '@/components/plan-card'
import { Timeline } from '@/components/timeline'
import { useRun } from '@/lib/use-run'

const RECORDED_PROMPT =
  'When someone submits our Typeform contact form, create the lead in Pipedrive as organization, person and deal.'

const EXAMPLES = [
  RECORDED_PROMPT,
  'When a Stripe payment succeeds, add the customer to a Mailchimp audience with the plan as a tag.',
  'When a Calendly meeting is booked, post the invitee and their answers to a Slack channel.',
  'When a GitHub issue gets the label "bug", create a Linear issue in the Triage team.',
]

export default function Home() {
  const { state, start } = useRun()
  const [prompt, setPrompt] = useState(RECORDED_PROMPT)
  const [live, setLive] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/run')
      .then((r) => r.json())
      .then((d: { live: boolean }) => setLive(d.live))
      .catch(() => setLive(false))
  }, [])

  const started = state.running || state.drafts.length > 0 || state.error !== null || state.plan !== null
  const cost = state.usage.reduce((sum, u) => sum + u.costUsd, 0)

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <span className="text-[15px] font-semibold tracking-tight">patchbay</span>
        <nav className="flex items-center gap-4 text-xs text-ink-soft">
          <ModeBadge live={live} />
          <a href="https://github.com/GodSmasher/patchbay" className="hover:text-ink">GitHub</a>
        </nav>
      </header>

      <section className="pt-8 pb-8 sm:pt-14">
        <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-[42px]">
          Describe an integration. Get a connector that already passed its tests.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          patchbay plans the integration, reads the real API docs, writes a TypeScript connector with tests and runs them in an
          isolated Nebius sandbox with the network switched off. When a test fails, it reads the failure and fixes the code.
        </p>

        <form
          className="mt-8 max-w-3xl"
          onSubmit={(e) => {
            e.preventDefault()
            if (!state.running) void start(prompt)
          }}
        >
          <label htmlFor="prompt" className="sr-only">Integration</label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            maxLength={400}
            className="w-full resize-none rounded-xl border border-paper-line bg-paper-card px-4 py-3 text-[15px] leading-relaxed shadow-sm outline-none focus:border-ink-mute"
            placeholder="When X happens in app A, do Y in app B."
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={state.running || prompt.trim().length < 12}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {state.running ? 'Building…' : 'Build connector'}
            </button>
            {live === false && (
              <span className="text-xs text-ink-mute">Live mode is off here, you will see a recorded run.</span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setPrompt(example)}
                className="rounded-full border border-paper-line bg-paper-card px-3 py-1 text-left text-xs text-ink-soft hover:border-ink-mute hover:text-ink"
              >
                {example.length > 64 ? `${example.slice(0, 62)}…` : example}
              </button>
            ))}
          </div>
        </form>
      </section>

      {started && (
        <section className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            <div className="rounded-xl border border-paper-line bg-paper-card py-2">
              <Timeline state={state} />
            </div>
            {state.mode === 'replay' && (
              <p className="rounded-lg bg-paper px-3 py-2 text-xs text-ink-soft">
                {state.notice ?? 'Recorded run: the same events a live run streams, with the code and test results it produced.'}
              </p>
            )}
            {state.usage.length > 0 && (
              <div className="rounded-xl border border-paper-line bg-paper-card p-4 text-xs">
                <div className="font-semibold uppercase tracking-wide text-ink-mute">Model usage</div>
                <ul className="mt-2 space-y-1">
                  {state.usage.map((u) => (
                    <li key={u.model} className="flex justify-between gap-2">
                      <span className="code truncate">{u.model.split('/').pop()}</span>
                      <span className="text-ink-soft">{(u.promptTokens + u.completionTokens).toLocaleString()} tok</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 border-t border-paper-line pt-2 text-ink-soft">Total ≈ ${cost.toFixed(4)}</div>
              </div>
            )}
          </aside>

          <div className="min-w-0 space-y-5">
            {state.error && (
              <div className="rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">{state.error}</div>
            )}
            {state.drafts.length > 0 && <CodePanel drafts={state.drafts} finalOk={state.result?.ok ?? null} />}
            {state.plan && <PlanCard plan={state.plan} spec={state.spec} sources={state.sources} />}
          </div>
        </section>
      )}

      <section className="mt-20 grid gap-6 border-t border-paper-line pt-10 sm:grid-cols-4">
        {[
          ['Plan', 'A small, fast Nemotron model turns your sentence into source, target and field mapping.'],
          ['Research', 'Tavily finds the official API reference, a mid-size Nemotron extracts endpoints, auth and payloads.'],
          ['Generate', 'Nemotron Ultra writes the connector and hermetic tests against an injected fetch.'],
          ['Verify', 'Every draft runs typecheck and vitest in a forked Nebius sandbox with no network. Failures go back to the model.'],
        ].map(([title, text]) => (
          <div key={title}>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{text}</p>
          </div>
        ))}
      </section>
    </main>
  )
}

function ModeBadge({ live }: { live: boolean | null }) {
  if (live === null) return null
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${live ? 'bg-signal-soft text-signal' : 'bg-paper text-ink-mute'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-signal' : 'bg-ink-mute'}`} />
      {live ? 'Live · Nemotron on Nebius' : 'Replay mode'}
    </span>
  )
}

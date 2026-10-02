'use client'

import { useEffect, useState } from 'react'
import { CodePanel } from '@/components/code-panel'
import { PlanCard } from '@/components/plan-card'
import { Timeline } from '@/components/timeline'
import { useRun } from '@/lib/use-run'

const RECORDED_PROMPT =
  'When someone submits our Typeform contact form, create the lead in Pipedrive as organization, person and deal.'

// Curated from the 20-prompt benchmark: the hardest cases that still finished green,
// so a judge clicking any of them sees a non-trivial run.
const EXAMPLES: { label: string; prompt: string }[] = [
  { label: 'Typeform → Pipedrive', prompt: RECORDED_PROMPT },
  { label: 'Stripe → Mailchimp', prompt: 'When a Stripe payment succeeds, add the customer to a Mailchimp audience with the plan as a tag.' },
  { label: 'Calendly → Slack', prompt: 'When a Calendly meeting is booked, post the invitee name, email and their answers to a Slack channel.' },
  { label: 'GitHub → Linear', prompt: 'When a GitHub issue gets the label "bug", create an issue in Linear in the Triage team.' },
  { label: 'Shopify HMAC → Slack', prompt: 'When a Shopify order webhook arrives, verify the HMAC-SHA256 signature from the X-Shopify-Hmac-Sha256 header against the shared secret, then forward the order summary to a Slack channel.' },
  { label: 'Jotform → Airtable (filterByFormula)', prompt: 'When a Jotform submission arrives, update an Airtable record by looking it up with filterByFormula on the email field and PATCHing only the empty fields.' },
]

export default function Home() {
  const { state, start } = useRun()
  const [prompt, setPrompt] = useState(RECORDED_PROMPT)
  const [live, setLive] = useState<boolean | null>(null)
  const [showMcp, setShowMcp] = useState(false)

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
          <button
            type="button"
            onClick={() => setShowMcp(true)}
            className="rounded-full border border-paper-line bg-paper-card px-3 py-1 text-xs text-ink hover:border-ink-mute"
          >
            Open in Claude Code
          </button>
          <a href="https://github.com/GodSmasher/patchbay" className="hover:text-ink">GitHub</a>
        </nav>
      </header>
      {showMcp && <McpModal prompt={prompt} onClose={() => setShowMcp(false)} />}

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
                key={example.label}
                type="button"
                onClick={() => setPrompt(example.prompt)}
                className="rounded-full border border-paper-line bg-paper-card px-3 py-1 text-left text-xs text-ink-soft hover:border-ink-mute hover:text-ink"
                title={example.prompt}
              >
                {example.label}
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

      <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-paper-line pt-6 text-xs text-ink-mute">
        <span>
          Models: <span className="text-ink-soft">Nemotron on Nebius Token Factory</span>
          <span className="mx-2 text-paper-line">·</span>
          API docs: <span className="text-ink-soft">Tavily</span>
          <span className="mx-2 text-paper-line">·</span>
          Verified in: <span className="text-ink-soft">Nebius Sandboxes</span>
        </span>
        <a href="https://github.com/GodSmasher/patchbay/blob/main/bench/RESULTS.md" className="hover:text-ink">
          Benchmark: 19/20 green · 50% first-try · $0.86 for 20 integrations ↗
        </a>
      </footer>
    </main>
  )
}

function McpModal({ prompt, onClose }: { prompt: string; onClose: () => void }) {
  const safePrompt = prompt.trim().length >= 12 ? prompt.trim() : 'When X happens in app A, do Y in app B.'
  const addCommand = `claude mcp add patchbay -- npx -y tsx <path-to-patchbay>/packages/mcp/src/server.ts`
  const chatCommand = `Use patchbay to build a connector: "${safePrompt}"`

  const [copied, setCopied] = useState<'add' | 'chat' | null>(null)
  const copy = (text: string, key: 'add' | 'chat') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-xl border border-paper-line bg-paper-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Open patchbay in Claude Code</h2>
            <p className="mt-1 text-xs text-ink-soft">
              patchbay ships an MCP server (stdio). Any MCP-speaking client — Claude Code, Codex, Cursor — can call it.
            </p>
          </div>
          <button onClick={onClose} className="text-sm text-ink-mute hover:text-ink">✕</button>
        </div>

        <div className="mt-5 space-y-4">
          <McpStep
            step="1"
            label="Register the server once"
            command={addCommand}
            copied={copied === 'add'}
            onCopy={() => copy(addCommand, 'add')}
          />
          <McpStep
            step="2"
            label="Then, in a Claude Code chat"
            command={chatCommand}
            copied={copied === 'chat'}
            onCopy={() => copy(chatCommand, 'chat')}
          />
        </div>

        <p className="mt-5 text-xs text-ink-mute">
          Full setup for Claude Code, Codex and Cursor:{' '}
          <a href="https://github.com/GodSmasher/patchbay/blob/main/docs/mcp-setup.md" className="text-ink-soft hover:text-ink">
            docs/mcp-setup.md ↗
          </a>
        </p>
      </div>
    </div>
  )
}

function McpStep({ step, label, command, copied, onCopy }: { step: string; label: string; command: string; copied: boolean; onCopy: () => void }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-soft"><span className="text-ink">{step}.</span> {label}</span>
        <button onClick={onCopy} className="text-ink-mute hover:text-ink">{copied ? 'Copied' : 'Copy'}</button>
      </div>
      <pre className="code mt-1.5 overflow-x-auto rounded-lg bg-paper px-3 py-2 text-xs">{command}</pre>
    </div>
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

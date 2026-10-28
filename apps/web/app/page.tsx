'use client'

import { useEffect, useState } from 'react'
import { CodePanel } from '@/components/code-panel'
import { PlanCard } from '@/components/plan-card'
import { Timeline } from '@/components/timeline'
import { GitHubBadge, useGhUser } from '@/components/github-badge'
import { GitHubPush } from '@/components/github-push'
import { ScanPanel } from '@/components/scan-panel'
import { useRun, type RunState } from '@/lib/use-run'

const RECORDED_PROMPT =
  'When someone submits our Typeform contact form, create the lead in Pipedrive as organization, person and deal.'

// Curated from the 20-prompt benchmark: the hardest cases that still finished green,
// so a judge clicking any of them sees a non-trivial run. The last three were green
// 2/2 passes on the Python Brutal-20 set (adversarial shapes); they work in TS too.
const EXAMPLES: { label: string; prompt: string }[] = [
  { label: 'Typeform → Pipedrive', prompt: RECORDED_PROMPT },
  { label: 'Stripe → Mailchimp', prompt: 'When a Stripe payment succeeds, add the customer to a Mailchimp audience with the plan as a tag.' },
  { label: 'Calendly → Slack', prompt: 'When a Calendly meeting is booked, post the invitee name, email and their answers to a Slack channel.' },
  { label: 'GitHub → Linear', prompt: 'When a GitHub issue gets the label "bug", create an issue in Linear in the Triage team.' },
  { label: 'Shopify HMAC → Slack', prompt: 'When a Shopify order webhook arrives, verify the HMAC-SHA256 signature from the X-Shopify-Hmac-Sha256 header against the shared secret, then forward the order summary to a Slack channel.' },
  { label: 'Jotform → Airtable (filterByFormula)', prompt: 'When a Jotform submission arrives, update an Airtable record by looking it up with filterByFormula on the email field and PATCHing only the empty fields.' },
  { label: 'GitHub PR → OpenAI structured output', prompt: 'When a GitHub pull_request is opened, call OpenAI with a structured output schema requesting title and reviewer suggestions, then post as a PR comment.' },
  { label: 'Zendesk priority routing', prompt: 'When a Zendesk ticket is updated, inspect the ticket priority — if high, page via Opsgenie Create Alert API; if normal, create a Jira issue instead.' },
  { label: 'Linear GraphQL nested mutation', prompt: 'When a Linear comment is created, use the Linear GraphQL API with a nested mutation to add two reactions and a sub-comment in a single request.' },
]

type LangChoice = 'ts' | 'py' | 'both'

export default function Home() {
  // Two independent runs: picking "Both" fires both in parallel so the side-by-side
  // comparison shows the same prompt producing both languages in one go.
  const tsRun = useRun()
  const pyRun = useRun()
  const { user: ghUser } = useGhUser()
  const [prompt, setPrompt] = useState(RECORDED_PROMPT)
  const [live, setLive] = useState<boolean | null>(null)
  const [showMcp, setShowMcp] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [lang, setLang] = useState<LangChoice>('ts')

  const bothMode = lang === 'both'
  const activeRun = lang === 'py' ? pyRun : tsRun
  const anyRunning = bothMode ? tsRun.state.running || pyRun.state.running : activeRun.state.running

  async function onShare() {
    setSharing(true)
    try {
      // Share is a single-run concept; in Both mode we share the TS run (TypeScript is
      // the recorded replay side, so it works even when live keys are missing).
      const runForShare = bothMode ? tsRun : activeRun
      const url = await runForShare.share(prompt)
      setShareUrl(url)
      await navigator.clipboard.writeText(url).catch(() => undefined)
    } catch (error) {
      setShareUrl(`error: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setSharing(false)
    }
  }

  function onSubmit() {
    setShareUrl(null)
    if (bothMode) {
      void tsRun.start(prompt, { lang: 'ts' })
      void pyRun.start(prompt, { lang: 'py' })
    } else {
      void activeRun.start(prompt, { lang })
    }
  }

  useEffect(() => {
    fetch('/api/run')
      .then((r) => r.json())
      .then((d: { live: boolean }) => setLive(d.live))
      .catch(() => setLive(false))
  }, [])

  const isStarted = (s: RunState) => s.running || s.drafts.length > 0 || s.error !== null || s.plan !== null
  const started = bothMode ? isStarted(tsRun.state) || isStarted(pyRun.state) : isStarted(activeRun.state)
  const singleCost = activeRun.state.usage.reduce((sum, u) => sum + u.costUsd, 0)
  const bothCost =
    tsRun.state.usage.reduce((sum, u) => sum + u.costUsd, 0) +
    pyRun.state.usage.reduce((sum, u) => sum + u.costUsd, 0)

  const bothGreen = tsRun.state.result?.ok === true && pyRun.state.result?.ok === true
  const bothFinished = !tsRun.state.running && !pyRun.state.running

  const langLabel = lang === 'py' ? 'Python 3.12' : lang === 'ts' ? 'TypeScript' : 'TypeScript AND Python'

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-y-2 py-5">
        <span className="text-[15px] font-semibold tracking-tight">patchbay</span>
        <nav className="flex items-center gap-2 overflow-x-auto whitespace-nowrap text-xs text-ink-soft sm:gap-4">
          <ModeBadge live={live} />
          <button
            type="button"
            onClick={() => setShowMcp(true)}
            className="whitespace-nowrap rounded-full border border-paper-line bg-paper-card px-3 py-1 text-xs text-ink hover:border-ink-mute"
          >
            Open in Claude Code
          </button>
          <GitHubBadge user={ghUser} />
          <a href="https://github.com/GodSmasher/patchbay" className="whitespace-nowrap hover:text-ink">Source</a>
        </nav>
      </header>
      {showMcp && <McpModal prompt={prompt} onClose={() => setShowMcp(false)} />}

      <section className="pt-8 pb-8 sm:pt-14">
        <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-[42px]">
          Describe an integration. Get a connector that already passed its tests.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          patchbay plans the integration, reads the real API docs, writes a
          <span className="whitespace-nowrap"> {langLabel}</span> connector with tests,
          and runs them in an isolated Nebius sandbox with the network switched off. When a test fails, it reads the failure
          and fixes the code. <span className="text-ink-mute">
            {bothMode
              ? 'Both languages, same prompt, same plan+research — only the generated code and test harness differ.'
              : 'Toggle TypeScript or Python below — or pick Both to run them side by side.'}
          </span>
        </p>

        <form
          className="mt-8 max-w-3xl"
          onSubmit={(e) => {
            e.preventDefault()
            if (!anyRunning) onSubmit()
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
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={anyRunning || prompt.trim().length < 12}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {anyRunning ? 'Building…' : bothMode ? 'Build both' : 'Build connector'}
            </button>
            <div
              role="radiogroup"
              aria-label="Target language"
              className="inline-flex rounded-lg border border-paper-line bg-paper-card p-0.5 text-xs"
            >
              {(
                [
                  { v: 'ts' as const, label: 'TypeScript', hint: 'vitest + fetch' },
                  { v: 'py' as const, label: 'Python', hint: 'pytest + httpx-style' },
                  { v: 'both' as const, label: 'Both', hint: 'TypeScript + Python side by side' },
                ]
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  role="radio"
                  aria-checked={lang === opt.v}
                  onClick={() => setLang(opt.v)}
                  title={opt.hint}
                  className={
                    'rounded-md px-3 py-1 transition-colors ' +
                    (lang === opt.v ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink')
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {live === false && (
              <span className="text-xs text-ink-mute">
                Live mode is off here, you will see a recorded TypeScript run
                {lang === 'py' ? ' (the Python replay is only reachable with live keys).' : lang === 'both' ? ' on each side.' : '.'}
              </span>
            )}
            {live && (lang === 'py' || lang === 'both') && (
              <span className="text-xs text-ink-mute">
                {lang === 'both' ? 'Side-by-side' : 'Python mode'}: first live run may take ~90s while the sandbox image warms up.
              </span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <span className="text-[11px] uppercase tracking-wide text-ink-mute">Examples:</span>
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

        <ScanPanel onPick={(p) => { setPrompt(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
      </section>

      {started && !bothMode && (
        <section className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            <div className="rounded-xl border border-paper-line bg-paper-card py-2">
              <Timeline state={activeRun.state} />
            </div>
            {activeRun.state.mode === 'replay' && (
              <p className="rounded-lg bg-paper px-3 py-2 text-xs text-ink-soft">
                {activeRun.state.notice ?? 'Recorded run: the same events a live run streams, with the code and test results it produced.'}
              </p>
            )}
            {activeRun.state.usage.length > 0 && (
              <div className="rounded-xl border border-paper-line bg-paper-card p-4 text-xs">
                <div className="font-semibold uppercase tracking-wide text-ink-mute">Model usage</div>
                <ul className="mt-2 space-y-1">
                  {activeRun.state.usage.map((u) => (
                    <li key={u.model} className="flex justify-between gap-2">
                      <span className="code truncate">{u.model.split('/').pop()}</span>
                      <span className="text-ink-soft">{(u.promptTokens + u.completionTokens).toLocaleString()} tok</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 border-t border-paper-line pt-2 text-ink-soft">Total ≈ ${singleCost.toFixed(4)}</div>
              </div>
            )}
          </aside>

          <div className="min-w-0 space-y-5">
            {activeRun.state.error && (
              <div className="rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">{activeRun.state.error}</div>
            )}
            {/* When a build finishes green, the push action is what the user
                came here to do — show it first, above the code, so it fits in
                one viewport with the "all tests pass" banner. */}
            {activeRun.state.result?.ok && !activeRun.state.running && activeRun.state.drafts.length > 0 && (
              <GitHubPush
                user={ghUser}
                prompt={prompt}
                files={activeRun.state.drafts[activeRun.state.drafts.length - 1]?.files ?? []}
              />
            )}
            {activeRun.state.result && !activeRun.state.running && (
              <ShareBar sharing={sharing} shareUrl={shareUrl} onShare={onShare} />
            )}
            {activeRun.state.drafts.length > 0 && (
              <CodePanel
                drafts={activeRun.state.drafts}
                finalOk={activeRun.state.result?.ok ?? null}
                lang={activeRun.state.lang}
                evidence={{
                  prompt,
                  plan: activeRun.state.plan,
                  spec: activeRun.state.spec,
                  usage: activeRun.state.usage,
                  result: activeRun.state.result,
                }}
              />
            )}
            {activeRun.state.plan && (
              <PlanCard
                plan={activeRun.state.plan}
                spec={activeRun.state.spec}
                sources={activeRun.state.sources}
                collapsible={activeRun.state.result?.ok === true && !activeRun.state.running}
              />
            )}
          </div>
        </section>
      )}

      {started && bothMode && (
        <section className="space-y-5">
          {bothFinished && bothGreen && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-signal/30 bg-signal-soft px-4 py-3 text-sm">
              <span className="font-semibold text-signal">
                Both green ✓ — same prompt, two languages, both pass their contract tests.
              </span>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-ink-soft">Total spent across both runs ≈ ${bothCost.toFixed(4)}</span>
                <button
                  type="button"
                  onClick={onShare}
                  disabled={sharing}
                  className="rounded-md bg-ink px-3 py-1 text-xs text-white disabled:opacity-40"
                >
                  {sharing ? 'Sharing…' : shareUrl ? 'Copy again' : 'Share TS run'}
                </button>
              </div>
            </div>
          )}

          {bothFinished && bothGreen && (tsRun.state.drafts.length > 0 || pyRun.state.drafts.length > 0) && (
            <GitHubPush
              user={ghUser}
              prompt={prompt}
              files={(tsRun.state.drafts.at(-1)?.files ?? [])}
            />
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <RunColumn label="TypeScript · vitest" state={tsRun.state} prompt={prompt} />
            <RunColumn label="Python 3.12 · pytest" state={pyRun.state} prompt={prompt} />
          </div>

          {(tsRun.state.plan || pyRun.state.plan) && (
            <PlanCard
              plan={(tsRun.state.plan ?? pyRun.state.plan)!}
              spec={tsRun.state.spec ?? pyRun.state.spec}
              sources={tsRun.state.sources.length ? tsRun.state.sources : pyRun.state.sources}
              collapsible={bothFinished}
            />
          )}
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
        <a href="/bench" className="hover:text-ink">
          Benchmark: 90% green over 92 runs · 52% first-try · $0.07 per connector →
        </a>
      </footer>
    </main>
  )
}

function ShareBar({ sharing, shareUrl, onShare }: { sharing: boolean; shareUrl: string | null; onShare: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-paper-line bg-paper-card px-4 py-2 text-xs">
      <span className="text-ink-soft">Share this run so someone else can see what the model did.</span>
      <div className="flex items-center gap-2">
        {shareUrl && !shareUrl.startsWith('error') && (
          <code className="code max-w-[280px] truncate rounded bg-paper px-2 py-1 text-[11px]">{shareUrl}</code>
        )}
        {shareUrl?.startsWith('error') && <span className="text-warn">{shareUrl}</span>}
        <button
          type="button"
          onClick={onShare}
          disabled={sharing}
          className="rounded-md bg-ink px-3 py-1 text-xs text-white disabled:opacity-40"
        >
          {sharing ? 'Sharing…' : shareUrl ? 'Copy again' : 'Share run'}
        </button>
      </div>
    </div>
  )
}

/**
 * One side of the Both-mode comparison: shows a per-language header, inline
 * timeline, model usage line, and the code panel. We don't duplicate the
 * sidebar — too narrow in a two-column layout — so Timeline collapses into
 * the column header.
 */
function RunColumn({ label, state, prompt }: { label: string; state: RunState; prompt?: string }) {
  const cost = state.usage.reduce((sum, u) => sum + u.costUsd, 0)
  const result = state.result
  const status = result
    ? result.ok
      ? `✓ ${result.attempts} attempt${result.attempts === 1 ? '' : 's'}`
      : `✖ ${result.attempts} attempt${result.attempts === 1 ? '' : 's'}`
    : state.running
      ? 'Building…'
      : 'Idle'
  const statusClass = result
    ? result.ok
      ? 'text-signal'
      : 'text-warn'
    : 'text-ink-mute'
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-paper-line bg-paper-card px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink">{label}</span>
          <span className={statusClass}>{status}</span>
        </div>
        {cost > 0 && <span className="text-ink-mute">${cost.toFixed(4)}</span>}
      </div>
      <div className="rounded-xl border border-paper-line bg-paper-card">
        <Timeline state={state} />
      </div>
      {state.error && (
        <div className="rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">{state.error}</div>
      )}
      {state.drafts.length > 0 && (
        <CodePanel
          drafts={state.drafts}
          finalOk={state.result?.ok ?? null}
          lang={state.lang}
          evidence={{
            prompt,
            plan: state.plan,
            spec: state.spec,
            usage: state.usage,
            result: state.result,
          }}
        />
      )}
    </div>
  )
}

function McpModal({ prompt, onClose }: { prompt: string; onClose: () => void }) {
  const safePrompt = prompt.trim().length >= 12 ? prompt.trim() : 'When X happens in app A, do Y in app B.'
  const addCommand = `claude mcp add patchbay -- npx -y @patchbay-nebius/mcp`
  const chatCommand = `Use patchbay to build a connector: "${safePrompt}"`
  // Claude Desktop registers a `claude://` URL scheme on install. We try to open
  // claude://mcp/add with a canonical payload the moment the modal mounts, AND copy
  // the terminal command to clipboard. Users with Claude Desktop installed see the
  // prompt open directly; users without see nothing happen in-browser but still get
  // the command they can paste.
  const deepLink =
    'claude://mcp/add?' +
    new URLSearchParams({
      name: 'patchbay',
      command: 'npx',
      args: '-y,@patchbay-nebius/mcp',
    }).toString()

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
    // On mount: auto-copy the install command and try to open Claude Desktop.
    navigator.clipboard.writeText(addCommand).then(() => {
      setCopied('add')
      setTimeout(() => setCopied(null), 2000)
    }).catch(() => {})
    try {
      // iframe trick avoids a visible "page can't be found" blink when the scheme
      // is not registered on this OS.
      const frame = document.createElement('iframe')
      frame.style.display = 'none'
      frame.src = deepLink
      document.body.appendChild(frame)
      setTimeout(() => frame.remove(), 1500)
    } catch {}
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, addCommand, deepLink])

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
              If you have Claude Desktop installed, it should open now and ask whether to add the patchbay MCP server. Otherwise paste the command below into Claude Code's terminal — it's already in your clipboard.
            </p>
          </div>
          <button onClick={onClose} className="text-sm text-ink-mute hover:text-ink">✕</button>
        </div>

        <div className="mt-5 space-y-4">
          <McpStep
            step="1"
            label="Register the server once (copied to clipboard)"
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

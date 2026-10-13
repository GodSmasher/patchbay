import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { RunEvent, GeneratedFile, Plan, Source, TestReport, Usage } from '@patchbay/agent'
import { getShare } from '@/lib/share-store'

export const dynamic = 'force-dynamic'

export default function SharePage({ params }: { params: { id: string } }) {
  const run = getShare(params.id)
  if (!run) notFound()

  const plan = pluck<Plan>(run.events, 'plan', 'plan')
  const sources = pluck<Source[]>(run.events, 'sources', 'sources') ?? []
  const drafts = buildDrafts(run.events)
  const final = run.events.find((e): e is Extract<RunEvent, { type: 'result' }> => e.type === 'result')
  const usage = pluck<Usage[]>(run.events, 'usage', 'usage') ?? []
  const totalCost = usage.reduce((s, u) => s + u.costUsd, 0)

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <Link href="/" className="text-[15px] font-semibold tracking-tight">patchbay</Link>
        <nav className="flex items-center gap-4 text-xs text-ink-soft">
          <Link href="/" className="hover:text-ink">Build your own</Link>
          <a href="https://github.com/GodSmasher/patchbay" className="hover:text-ink">GitHub</a>
        </nav>
      </header>

      <section className="pt-4">
        <div className="text-xs uppercase tracking-wide text-ink-mute">Shared run</div>
        <h1 className="mt-1 max-w-3xl text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          {run.prompt}
        </h1>
        <p className="mt-2 text-xs text-ink-mute">
          Shared {new Date(run.createdAt).toLocaleString()} ·
          {final ? ` ${final.ok ? '✅ green' : '✖ not green'} after ${final.attempts} attempt${final.attempts > 1 ? 's' : ''}` : ''}
          {totalCost > 0 ? ` · $${totalCost.toFixed(4)}` : ''}
        </p>
      </section>

      {plan && (
        <section className="mt-6 rounded-xl border border-paper-line bg-paper-card p-4 text-sm">
          <div className="text-xs uppercase tracking-wide text-ink-mute">Plan</div>
          <p className="mt-1 text-ink">{plan.summary}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[11px] uppercase text-ink-mute">Source</div>
              <div className="font-medium">{plan.source.app}</div>
              <div className="text-xs text-ink-soft">{plan.source.trigger}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase text-ink-mute">Target</div>
              <div className="font-medium">{plan.target.app}</div>
              <div className="text-xs text-ink-soft">{plan.target.action}</div>
            </div>
          </div>
        </section>
      )}

      {sources.length > 0 && (
        <section className="mt-4 rounded-xl border border-paper-line bg-paper-card p-4 text-sm">
          <div className="text-xs uppercase tracking-wide text-ink-mute">Sources</div>
          <ul className="mt-2 space-y-1">
            {sources.map((s, i) => (
              <li key={i} className="truncate text-xs">
                <a href={s.url} className="text-ink hover:underline">{s.title}</a>
                {s.official && <span className="ml-1 text-signal">· official</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {drafts.length > 0 && (
        <section className="mt-6 rounded-xl border border-paper-line bg-paper-card">
          <div className="flex items-center gap-2 border-b border-paper-line px-3 py-2 text-xs">
            <span className="text-ink-mute">Drafts</span>
            {drafts.map((d, i) => (
              <span key={d.attempt} className="flex items-center gap-1">
                {i > 0 && <span className="text-ink-mute">→</span>}
                <span className={d.green ? 'text-signal' : 'text-warn'}>
                  {d.passed}/{d.total}
                </span>
              </span>
            ))}
          </div>
          {drafts.at(-1)?.files.map((f) => (
            <details key={f.path} className="border-t border-paper-line first-of-type:border-t-0">
              <summary className="cursor-pointer px-3 py-2 text-xs text-ink-soft hover:text-ink">
                {f.path} · {f.content.split('\n').length} lines
              </summary>
              <pre className="code max-h-[480px] overflow-auto bg-paper p-3 text-[12px] text-ink">{f.content}</pre>
            </details>
          ))}
        </section>
      )}

      <footer className="mt-10 border-t border-paper-line pt-4 text-xs text-ink-mute">
        Reproduce or remix this at <Link href="/" className="text-ink hover:underline">patchbay-nebius.vercel.app</Link>.
      </footer>
    </main>
  )
}

interface Draft {
  attempt: number
  files: GeneratedFile[]
  passed: number
  total: number
  green: boolean
}

function buildDrafts(events: RunEvent[]): Draft[] {
  const byAttempt = new Map<number, Draft>()
  for (const e of events) {
    if (e.type === 'files') {
      byAttempt.set(e.attempt, { attempt: e.attempt, files: e.files, passed: 0, total: 0, green: false })
    }
    if (e.type === 'tests') {
      const entry = byAttempt.get(e.attempt)
      if (entry) {
        entry.passed = e.report.passed
        entry.total = e.report.total
        entry.green = e.report.typecheckOk && e.report.failed === 0 && (e.report.contract ?? 'passed') === 'passed'
      }
    }
  }
  return [...byAttempt.values()].sort((a, b) => a.attempt - b.attempt)
}

function pluck<T>(events: RunEvent[], type: RunEvent['type'], key: string): T | undefined {
  const match = events.find((e) => e.type === type) as (Record<string, unknown> & { type: string }) | undefined
  return match ? (match[key] as T) : undefined
}

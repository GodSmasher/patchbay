import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Link from 'next/link'

export const metadata = { title: 'patchbay — benchmark' }
export const dynamic = 'force-dynamic'

interface PromptRow {
  index: number
  prompt: string
  passes: number
  greenRuns: number
  firstTryRuns: number
  costMean: number
  costStd: number
  attemptsMean: number
}

interface Variance {
  totalRuns: number
  totalGreen: number
  totalFirstTry: number
  totalCostMean: number
  totalCostStd: number
  prompts: PromptRow[]
}

interface RawVariance {
  summary?: {
    passes?: number
    prompts?: number
    greenRate?: number
    firstTryRate?: number
    costPerPassUsd?: number
    costPerPassStdUsd?: number
  }
  prompts?: Array<Partial<PromptRow>>
  // legacy flat shape:
  totalRuns?: number
  totalGreen?: number
  totalFirstTry?: number
  totalCostMean?: number
  totalCostStd?: number
}

type Lang = 'ts' | 'py'

function loadVariance(lang: Lang): Variance {
  const file = lang === 'py' ? 'variance-py.json' : 'variance.json'
  const raw = readFileSync(join(process.cwd(), 'public', file), 'utf8')
  const data = JSON.parse(raw) as RawVariance
  // New shape: summary.{greenRate,firstTryRate,costPerPassUsd,passes,prompts}
  if (data.summary) {
    const prompts = (data.prompts ?? []).map((p, i) => ({
      index: p.index ?? i + 1,
      prompt: p.prompt ?? '',
      passes: p.passes ?? 0,
      greenRuns: p.greenRuns ?? 0,
      firstTryRuns: p.firstTryRuns ?? 0,
      costMean: p.costMean ?? 0,
      costStd: p.costStd ?? 0,
      attemptsMean: p.attemptsMean ?? 0,
    }))
    // Totals come from the actual rows, not passes×prompts — the Core 20 ran
    // 5-pass and the Brutal 10 ran 2-pass, so there's no single "passes"
    // number to multiply with.
    const totalRuns = prompts.reduce((s, p) => s + p.passes, 0) || 1
    const totalGreen = prompts.reduce((s, p) => s + p.greenRuns, 0)
    const totalFirstTry = prompts.reduce((s, p) => s + p.firstTryRuns, 0)
    const totalCostMean = prompts.reduce((s, p) => s + p.costMean, 0)
    const totalCostStd = Math.sqrt(prompts.reduce((s, p) => s + p.costStd * p.costStd, 0))
    return { totalRuns, totalGreen, totalFirstTry, totalCostMean, totalCostStd, prompts }
  }
  // Legacy flat shape fallback.
  return {
    totalRuns: data.totalRuns ?? 0,
    totalGreen: data.totalGreen ?? 0,
    totalFirstTry: data.totalFirstTry ?? 0,
    totalCostMean: data.totalCostMean ?? 0,
    totalCostStd: data.totalCostStd ?? 0,
    prompts: (data.prompts ?? []) as PromptRow[],
  }
}

export default async function BenchPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const resolved = await searchParams
  const lang: Lang = resolved?.lang === 'py' ? 'py' : 'ts'
  const v = loadVariance(lang)
  const greenPct = v.totalGreen / v.totalRuns
  const firstTryPct = v.totalFirstTry / v.totalRuns
  const perConnector = v.totalCostMean / v.prompts.length
  const langLabel = lang === 'py' ? 'Python 3.12 (pytest)' : 'TypeScript (vitest)'

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <Link href="/" className="text-[15px] font-semibold tracking-tight">patchbay</Link>
        <nav className="flex items-center gap-4 text-xs text-ink-soft">
          <Link href="/" className="hover:text-ink">Live demo</Link>
          <a href="https://github.com/GodSmasher/patchbay" className="hover:text-ink">GitHub</a>
        </nav>
      </header>

      <section className="pt-6 pb-8 sm:pt-10">
        <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-[42px]">
          The benchmark that keeps patchbay honest.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          {v.prompts.length} integrations across common and adversarial APIs, run as {langLabel}. Every run goes
          through the full pipeline — plan, research, generate, verify in a Nebius sandbox, repair with parallel
          branches. Green means typecheck ok, zero failing tests, and the documented-example contract test passed.
        </p>

        <div
          role="radiogroup"
          aria-label="Target language"
          className="mt-5 inline-flex rounded-lg border border-paper-line bg-paper-card p-0.5 text-xs"
        >
          <Link
            href="/bench"
            aria-checked={lang === 'ts'}
            role="radio"
            className={`rounded-md px-3 py-1 transition-colors ${lang === 'ts' ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink'}`}
          >
            TypeScript
          </Link>
          <Link
            href="/bench?lang=py"
            aria-checked={lang === 'py'}
            role="radio"
            className={`rounded-md px-3 py-1 transition-colors ${lang === 'py' ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink'}`}
          >
            Python
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label="Green" value={pct(greenPct)} detail={`${v.totalGreen} / ${v.totalRuns} runs`} />
        <Stat label="First-try green" value={pct(firstTryPct)} detail={`${v.totalFirstTry} / ${v.totalRuns} runs`} />
        <Stat label="Cost per connector" value={`$${perConnector.toFixed(4)}`} detail={`$${v.totalCostMean.toFixed(4)} ± $${v.totalCostStd.toFixed(4)} per full pass`} />
        <Stat label="Variance passes" value={maxPasses(v.prompts).toString()} detail={`${v.prompts.length} prompts × up to ${maxPasses(v.prompts)}`} />
      </section>

      <section className="mt-10 overflow-x-auto rounded-xl border border-paper-line bg-paper-card">
        <table className="w-full text-sm">
          <thead className="border-b border-paper-line text-left text-xs uppercase tracking-wide text-ink-mute">
            <tr>
              <th className="w-10 px-3 py-2">#</th>
              <th className="px-3 py-2">Integration</th>
              <th className="w-24 px-3 py-2">Green</th>
              <th className="w-24 px-3 py-2">First-try</th>
              <th className="w-40 px-3 py-2">Cost (mean ± σ)</th>
              <th className="w-24 px-3 py-2 text-right">Attempts</th>
            </tr>
          </thead>
          <tbody>
            {v.prompts.map((r) => (
              <tr key={r.index} className="border-b border-paper-line last:border-b-0 align-top">
                <td className="px-3 py-2 text-ink-mute">{r.index}</td>
                <td className="px-3 py-2 text-ink">{r.prompt}</td>
                <td className="px-3 py-2">
                  <StabilityPill good={r.greenRuns} total={r.passes} />
                </td>
                <td className="px-3 py-2">
                  <StabilityPill good={r.firstTryRuns} total={r.passes} subtle />
                </td>
                <td className="px-3 py-2 code text-xs text-ink-soft">
                  ${r.costMean.toFixed(4)} ± ${r.costStd.toFixed(4)}
                </td>
                <td className="px-3 py-2 text-right text-ink-soft">{r.attemptsMean.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8 rounded-xl border border-paper-line bg-paper px-4 py-3 text-xs text-ink-soft">
        Reproduce it yourself:{' '}
        <code className="code rounded bg-paper-card px-1.5 py-0.5">
          git clone github.com/GodSmasher/patchbay && cd patchbay && npm install && npm run bench {lang === 'py' ? '-- --lang=python ' : ''}-- --passes=5
        </code>
        . Needs live keys in <code className="code">.env.local</code> (<code>NEBIUS_API_KEY</code>,{' '}
        <code>NEBIUS_AI_PROJECT</code>, <code>TAVILY_API_KEY</code>). The raw per-run JSON lives in{' '}
        <a href="https://github.com/GodSmasher/patchbay/tree/main/bench/runs" className="text-ink hover:underline">
          bench/runs/
        </a>
        .
      </section>
    </main>
  )
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`
}

function maxPasses(rows: PromptRow[]): number {
  return rows.reduce((m, r) => Math.max(m, r.passes), 0)
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-paper-line bg-paper-card px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-ink-mute">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</div>
      <div className="mt-0.5 text-[11.5px] text-ink-soft">{detail}</div>
    </div>
  )
}

function StabilityPill({ good, total, subtle }: { good: number; total: number; subtle?: boolean }) {
  const pct = good / total
  const className = pct === 1
    ? subtle ? 'text-signal' : 'bg-signal text-white'
    : pct >= 0.6
      ? subtle ? 'text-ink-soft' : 'bg-signal-soft text-signal'
      : 'bg-warn-soft text-warn'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {good}/{total}
    </span>
  )
}

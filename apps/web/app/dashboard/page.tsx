import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import Link from 'next/link'
import { loadAllCves, isEmbargoActive } from '@/lib/cve'

export const metadata = {
  title: 'patchbay — ecosystem dashboard',
  description: 'Live weekly view of MCP ecosystem security posture: daily sweeps, weekly drift, CVE status.',
}
export const dynamic = 'force-dynamic'

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

interface Aggregate {
  capturedAt: string
  totalTargets: number
  reachable: number
  totals: Record<Severity, number>
  checkCounts: Record<string, number>
}

interface Manifest {
  syncedAt: string
  aggregate: string | null
  weeklyReport: string | null
}

function readJson<T>(relPath: string): T | null {
  const abs = join(process.cwd(), 'public', 'dashboard', relPath)
  if (!existsSync(abs)) return null
  try { return JSON.parse(readFileSync(abs, 'utf8')) as T } catch { return null }
}

function readText(relPath: string): string | null {
  const abs = join(process.cwd(), 'public', 'dashboard', relPath)
  if (!existsSync(abs)) return null
  try { return readFileSync(abs, 'utf8') } catch { return null }
}

export default function DashboardPage() {
  const manifest = readJson<Manifest>('manifest.json')
  const aggregate = readJson<Aggregate>('latest-aggregate.json')
  const weeklyReport = readText('latest-weekly.md')
  const cves = loadAllCves()

  const activeCves = cves.filter((c) => c.status !== 'withdrawn' && !isEmbargoActive(c))
  const withdrawnCves = cves.filter((c) => c.status === 'withdrawn')

  const reachPct = aggregate ? (aggregate.reachable / aggregate.totalTargets) * 100 : 0
  const totalFindings = aggregate
    ? aggregate.totals.critical + aggregate.totals.high + aggregate.totals.medium + aggregate.totals.low + aggregate.totals.info
    : 0

  const topChecks = aggregate
    ? Object.entries(aggregate.checkCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
    : []

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <Link href="/" className="text-[15px] font-semibold tracking-tight">patchbay</Link>
        <nav className="flex items-center gap-4 text-xs text-ink-soft">
          <Link href="/leaderboard" className="hover:text-ink">Leaderboard</Link>
          <Link href="/cve" className="hover:text-ink">CVE</Link>
          <Link href="/bench" className="hover:text-ink">Benchmark</Link>
          <a href="https://github.com/GodSmasher/patchbay" className="hover:text-ink">GitHub</a>
        </nav>
      </header>

      <section className="pt-6 pb-8 sm:pt-10">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-paper-card px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft">
            MVP · W1
          </span>
          {manifest && (
            <span className="text-[11px] text-ink-mute">
              Last sync: {new Date(manifest.syncedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC
            </span>
          )}
        </div>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-[42px]">
          The MCP ecosystem, from one page.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          Daily sweeps of {aggregate?.totalTargets ?? '—'} public MCP servers, weekly drift reports, and the CVE
          register that comes out of them. Every number on this page was produced by{' '}
          <code className="code rounded bg-paper-card px-1.5 py-0.5">patchbay audit</code> and is reproducible from{' '}
          <a href="https://github.com/GodSmasher/patchbay/tree/main/bench" className="text-ink underline underline-offset-4 hover:text-ink">
            bench/
          </a>
          .
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <Stat
          label="Targets scanned"
          value={aggregate ? aggregate.totalTargets.toString() : '—'}
          detail={aggregate ? `Last sweep ${new Date(aggregate.capturedAt).toISOString().slice(0, 10)}` : 'No sweep yet'}
        />
        <Stat
          label="Reachable"
          value={aggregate ? `${aggregate.reachable}/${aggregate.totalTargets}` : '—'}
          detail={`${reachPct.toFixed(1)}% of registry`}
        />
        <Stat
          label="Total findings"
          value={totalFindings.toString()}
          detail={aggregate ? `${aggregate.totals.critical} critical · ${aggregate.totals.high} high` : 'No sweep yet'}
        />
        <Stat
          label="Active CVEs"
          value={activeCves.length.toString()}
          detail={withdrawnCves.length > 0 ? `${withdrawnCves.length} withdrawn` : 'No withdrawals'}
        />
      </section>

      {aggregate && (
        <section className="mt-8 rounded-xl border border-paper-line bg-paper-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-mute">Severity breakdown — latest sweep</h2>
            <span className="text-xs text-ink-mute">{new Date(aggregate.capturedAt).toISOString()}</span>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2 text-sm">
            <SevBar label="Critical" n={aggregate.totals.critical} total={totalFindings} tone="crit" />
            <SevBar label="High" n={aggregate.totals.high} total={totalFindings} tone="high" />
            <SevBar label="Medium" n={aggregate.totals.medium} total={totalFindings} tone="med" />
            <SevBar label="Low" n={aggregate.totals.low} total={totalFindings} tone="low" />
            <SevBar label="Info" n={aggregate.totals.info} total={totalFindings} tone="info" />
          </div>
        </section>
      )}

      {topChecks.length > 0 && (
        <section className="mt-8 rounded-xl border border-paper-line bg-paper-card p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-mute">Top checks by occurrence</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {topChecks.map(([id, n]) => (
                <tr key={id} className="border-b border-paper-line last:border-b-0">
                  <td className="py-1.5 pr-3">
                    <Link href={`/docs/${encodeURIComponent(id)}`} className="code text-ink hover:underline">
                      {id}
                    </Link>
                  </td>
                  <td className="py-1.5 text-right text-ink-soft tabular-nums">{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {weeklyReport && (
        <section className="mt-8 rounded-xl border border-paper-line bg-paper-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-mute">Weekly rescan report</h2>
            <a
              href="https://github.com/GodSmasher/patchbay/tree/main/bench/rescan-reports"
              className="text-xs text-ink-soft hover:text-ink"
            >
              All reports →
            </a>
          </div>
          <pre className="mt-3 max-h-[480px] overflow-auto whitespace-pre-wrap rounded-md bg-paper p-3 text-[12px] leading-relaxed text-ink">
{weeklyReport}
          </pre>
        </section>
      )}

      {!aggregate && !weeklyReport && (
        <section className="mt-8 rounded-xl border border-paper-line bg-paper-card p-6 text-center text-sm text-ink-soft">
          Dashboard data has not been synced yet. Run{' '}
          <code className="code rounded bg-paper px-1.5 py-0.5">npm run sync:dashboard</code> from the repo root.
        </section>
      )}

      <section className="mt-10 text-xs text-ink-soft">
        Data sources: the latest daily{' '}
        <a href="https://github.com/GodSmasher/patchbay/tree/main/bench" className="text-ink hover:underline">sweep aggregate</a>,
        the latest{' '}
        <a href="https://github.com/GodSmasher/patchbay/tree/main/bench/rescan-reports" className="text-ink hover:underline">weekly rescan report</a>,
        and the{' '}
        <Link href="/cve" className="text-ink hover:underline">CVE register</Link>. Raw per-target scan data is retained as
        private 90-day GitHub artifacts; only anonymized aggregates land here.
      </section>
    </main>
  )
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-paper-line bg-paper-card px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-ink-mute">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-ink tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11.5px] text-ink-soft">{detail}</div>
    </div>
  )
}

function SevBar({ label, n, total, tone }: { label: string; n: number; total: number; tone: 'crit' | 'high' | 'med' | 'low' | 'info' }) {
  const pct = total > 0 ? (n / total) * 100 : 0
  const barColor =
    tone === 'crit' ? 'bg-rose-500' :
    tone === 'high' ? 'bg-orange-500' :
    tone === 'med' ? 'bg-amber-500' :
    tone === 'low' ? 'bg-sky-500' :
    'bg-slate-400'
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-wide text-ink-mute">{label}</span>
        <span className="text-sm font-semibold text-ink tabular-nums">{n}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-paper">
        <div className={`h-full ${barColor}`} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      <div className="mt-0.5 text-[10px] text-ink-mute tabular-nums">{pct.toFixed(1)}%</div>
    </div>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { letterGrade, score, gradeColor } from '@patchbay-nebius/audit-core'
import { loadReport } from '@/lib/report-store'
import { watchersForTarget } from '@/lib/lead-store'
import type { AuditReport, Finding, Severity } from '@patchbay-nebius/audit-core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SEV_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info']

const SEV_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
}

// Pastel chips in paper-tone context: warn-rust for the two risky tiers,
// a yellow for medium, ink-mute for low/info so the eye focuses on the real
// problems instead of being painted red by every finding.
const SEV_CHIP: Record<Severity, string> = {
  critical: 'bg-warn-soft text-warn border-warn/30',
  high: 'bg-warn-soft text-warn border-warn/30',
  medium: 'bg-[#fff7d6] text-[#8a5a00] border-[#e4c16a]/40 dark:bg-[#2b2211] dark:text-[#e2b64a] dark:border-[#e2b64a]/30',
  low: 'bg-paper-card text-ink-soft border-paper-line',
  info: 'bg-paper-card text-ink-mute border-paper-line',
}

const SEV_CARD: Record<Severity, string> = {
  critical: 'border-warn/40 bg-warn-soft',
  high: 'border-warn/40 bg-warn-soft',
  medium: 'border-[#e4c16a]/50 bg-[#fff7d6] dark:border-[#e2b64a]/30 dark:bg-[#2b2211]',
  low: 'border-paper-line bg-paper-card',
  info: 'border-paper-line bg-paper-card',
}

export default async function ReportPage({ params }: { params: { id: string } }) {
  const entry = await loadReport(params.id)
  if (!entry) notFound()

  const report = entry.body as AuditReport
  const num = score(report.summary)
  const grade = letterGrade(num)
  const color = gradeColor(grade)
  const watcherCount = await watchersForTarget(report.target)

  const grouped = SEV_ORDER.reduce<Record<Severity, Finding[]>>((acc, s) => {
    acc[s] = report.findings.filter((f) => f.severity === s)
    return acc
  }, { critical: [], high: [], medium: [], low: [], info: [] })

  const badgeMarkdown = `[![patchbay](https://patchbay-mcp.dev/api/badge/${encodeURIComponent(report.target)}.svg)](https://patchbay-mcp.dev/report/${entry.id})`

  return (
    <main className="min-h-screen bg-paper text-ink px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-10 text-sm text-ink-mute">
          <Link href="/" className="hover:text-ink">patchbay</Link>
          <span className="mx-2">/</span>
          <span className="text-ink-soft">report</span>
          <span className="mx-2">/</span>
          <span className="font-mono text-ink-soft">{entry.id}</span>
        </nav>

        <p className="text-xs uppercase tracking-wider text-ink-mute mb-2">audit report</p>
        <h1 className="text-3xl font-semibold text-ink break-all">{report.target}</h1>
        <p className="mt-2 text-sm text-ink-mute">
          Captured {new Date(entry.storedAt).toLocaleString()} · {(report.durationMs / 1000).toFixed(1)}s
          {watcherCount > 0 && (
            <>
              {' · '}
              <span className="text-ink-soft">
                {watcherCount === 1
                  ? '1 person watching'
                  : `${watcherCount} people watching`}
              </span>
            </>
          )}
        </p>

        <section className="mt-10 rounded-lg border border-paper-line bg-paper-card p-6">
          <div className="flex flex-wrap items-center gap-6">
            <div
              className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-lg text-4xl font-bold text-white shadow-sm"
              style={{ backgroundColor: color }}
            >
              {grade}
            </div>
            <div className="flex-1 min-w-[12rem]">
              <p className="text-4xl font-semibold text-ink">
                {num}<span className="text-xl text-ink-mute"> / 100</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SEV_ORDER.filter((s) => report.summary[s] > 0).map((s) => (
                  <span
                    key={s}
                    className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs ${SEV_CHIP[s]}`}
                  >
                    {report.summary[s]} {SEV_LABEL[s]}
                  </span>
                ))}
                {report.findings.length === 0 && (
                  <span className="text-sm text-signal">All clean</span>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-lg border border-paper-line bg-paper-card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-ink">Embed this badge</h2>
              <p className="mt-1 text-xs text-ink-mute">
                Live-updates on every new <code className="font-mono">--publish</code> for this target.
              </p>
            </div>
            <img
              src={`/api/badge/${encodeURIComponent(report.target)}.svg`}
              alt="patchbay score badge"
              className="h-6"
            />
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded border border-paper-line bg-paper px-3 py-2 text-xs text-ink-soft code">
{badgeMarkdown}
          </pre>
        </section>

        {report.findings.length === 0 ? (
          <section className="mt-10 rounded-lg border border-paper-line bg-paper-card p-6 text-center">
            <p className="text-ink">No findings. Every check passed on this scan.</p>
          </section>
        ) : (
          SEV_ORDER.map((sev) =>
            grouped[sev].length ? (
              <section key={sev} className="mt-10">
                <div className="mb-4 flex items-center gap-3">
                  <h2 className="text-lg font-semibold uppercase tracking-wider text-ink">
                    {SEV_LABEL[sev]}
                  </h2>
                  <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs ${SEV_CHIP[sev]}`}>
                    {grouped[sev].length}
                  </span>
                </div>
                <div className="space-y-4">
                  {grouped[sev].map((f, i) => (
                    <article key={i} className={`rounded-lg border p-5 ${SEV_CARD[sev]}`}>
                      <div className="mb-3 flex flex-wrap items-baseline gap-2">
                        <span className="font-mono text-sm text-ink-mute">{f.id}</span>
                        <h3 className="text-base font-semibold text-ink">{f.title}</h3>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-ink-soft">{f.evidence}</p>
                      <div className="mt-4 rounded border border-paper-line bg-paper px-4 py-3">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-ink-mute">Fix</p>
                        <p className="text-sm text-ink">{f.fix}</p>
                      </div>
                      <p className="mt-3 text-xs text-ink-mute">
                        Severity {f.severity} · Confidence {f.confidence} ·{' '}
                        <a href={f.docsUrl} className="text-ink-soft underline underline-offset-4 hover:text-ink">
                          docs
                        </a>
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null,
          )
        )}

        <footer className="mt-16 border-t border-paper-line pt-6">
          <p className="text-sm text-ink-mute">
            Generated by{' '}
            <Link href="/" className="text-ink-soft underline underline-offset-4 hover:text-ink">
              patchbay audit
            </Link>
            . Local, open source, no backend. Reproduce this report:
          </p>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded border border-paper-line bg-paper px-3 py-2 text-xs text-ink-soft code">
{`npx -y @patchbay-nebius/agent audit ${report.target}`}
          </pre>
        </footer>
      </div>
    </main>
  )
}

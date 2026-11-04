import Link from 'next/link'
import { notFound } from 'next/navigation'
import { letterGrade, score, gradeColor } from '@patchbay-nebius/audit-core'
import { loadReport } from '@/lib/report-store'
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

const SEV_BAR: Record<Severity, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-neutral-500',
  info: 'bg-neutral-600',
}

const SEV_CARD: Record<Severity, string> = {
  critical: 'border-red-900/60 bg-red-950/30',
  high: 'border-orange-900/60 bg-orange-950/30',
  medium: 'border-yellow-900/60 bg-yellow-950/30',
  low: 'border-neutral-800 bg-neutral-950',
  info: 'border-neutral-800 bg-neutral-950',
}

export default async function ReportPage({ params }: { params: { id: string } }) {
  const entry = await loadReport(params.id)
  if (!entry) notFound()

  const report = entry.body as AuditReport
  const num = score(report.summary)
  const grade = letterGrade(num)
  const color = gradeColor(grade)

  const grouped = SEV_ORDER.reduce<Record<Severity, Finding[]>>((acc, s) => {
    acc[s] = report.findings.filter((f) => f.severity === s)
    return acc
  }, { critical: [], high: [], medium: [], low: [], info: [] })

  const badgeMarkdown = `[![patchbay](https://patchbay-mcp.dev/api/badge/${encodeURIComponent(report.target)}.svg)](https://patchbay-mcp.dev/report/${entry.id})`

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200">
      <nav className="border-b border-neutral-800">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-sm font-semibold text-white hover:text-neutral-300">
            patchbay
          </Link>
          <div className="flex gap-6 text-sm text-neutral-400">
            <Link href="/blog/state-of-mcp-auth-nov-2026" className="hover:text-neutral-200">Blog</Link>
            <a href="https://github.com/GodSmasher/patchbay" className="hover:text-neutral-200">GitHub</a>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-wider text-neutral-500">patchbay audit report</p>
          <h1 className="mt-2 break-all text-2xl font-semibold text-white sm:text-3xl">
            {report.target}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Captured {new Date(entry.storedAt).toLocaleString()} · {(report.durationMs / 1000).toFixed(1)}s
          </p>
        </div>

        <section className="mb-10 rounded-lg border border-neutral-800 bg-neutral-900/60 p-6">
          <div className="flex flex-wrap items-center gap-6">
            <div
              className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-lg text-4xl font-bold text-white"
              style={{ backgroundColor: color }}
            >
              {grade}
            </div>
            <div className="flex-1 min-w-[12rem]">
              <p className="text-4xl font-semibold text-white">{num}<span className="text-xl text-neutral-500"> / 100</span></p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SEV_ORDER.filter((s) => report.summary[s] > 0).map((s) => (
                  <span
                    key={s}
                    className={`inline-flex items-center gap-1.5 rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1 text-xs text-neutral-200`}
                  >
                    <span className={`inline-block h-2 w-2 rounded-full ${SEV_BAR[s]}`} />
                    <span>{report.summary[s]} {SEV_LABEL[s]}</span>
                  </span>
                ))}
                {report.findings.length === 0 && (
                  <span className="text-sm text-neutral-400">All clean</span>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-10 rounded-lg border border-neutral-800 bg-neutral-900/60 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-white">Embed this badge</h2>
              <p className="mt-1 text-xs text-neutral-500">Live-updates on every new <code>--publish</code> for this target.</p>
            </div>
            <img
              src={`/api/badge/${encodeURIComponent(report.target)}.svg`}
              alt="patchbay score badge"
              className="h-6"
            />
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-300">
{badgeMarkdown}
          </pre>
        </section>

        {report.findings.length === 0 ? (
          <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-6 text-center">
            <p className="text-neutral-300">No findings. Every check passed on this scan.</p>
          </section>
        ) : (
          SEV_ORDER.map((sev) =>
            grouped[sev].length ? (
              <section key={sev} className="mb-10">
                <div className="mb-4 flex items-center gap-3">
                  <span className={`inline-block h-3 w-3 rounded-full ${SEV_BAR[sev]}`} />
                  <h2 className="text-lg font-semibold uppercase tracking-wider text-white">
                    {SEV_LABEL[sev]}
                  </h2>
                  <span className="text-sm text-neutral-500">{grouped[sev].length}</span>
                </div>
                <div className="space-y-4">
                  {grouped[sev].map((f, i) => (
                    <article key={i} className={`rounded-lg border p-5 ${SEV_CARD[sev]}`}>
                      <div className="mb-3 flex flex-wrap items-baseline gap-2">
                        <span className="font-mono text-sm text-neutral-400">{f.id}</span>
                        <h3 className="text-base font-semibold text-white">{f.title}</h3>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-neutral-300">{f.evidence}</p>
                      <div className="mt-4 rounded border border-neutral-800 bg-neutral-950/60 p-3">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-neutral-500">Fix</p>
                        <p className="text-sm text-neutral-200">{f.fix}</p>
                      </div>
                      <p className="mt-3 text-xs text-neutral-500">
                        Severity {f.severity} · Confidence {f.confidence} ·{' '}
                        <a href={f.docsUrl} className="text-neutral-300 underline underline-offset-4 hover:text-white">
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

        <footer className="mt-16 border-t border-neutral-800 pt-6">
          <p className="text-sm text-neutral-500">
            Generated by{' '}
            <Link href="/" className="text-neutral-300 underline underline-offset-4 hover:text-white">
              patchbay audit
            </Link>
            . Local, open source, no backend. Reproduce this report:
          </p>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-300">
{`npx -y @patchbay-nebius/agent audit ${report.target}`}
          </pre>
        </footer>
      </main>
    </div>
  )
}

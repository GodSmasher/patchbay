'use client'

import { useEffect, useState } from 'react'
import type { GeneratedFile, Lang, TestReport } from '@patchbay-nebius/agent'

interface Draft {
  attempt: number
  files: GeneratedFile[]
  report: TestReport | null
}

// The main source file in each language — used as the default tab when the panel first renders.
const DEFAULT_PATH_BY_LANG: Record<Lang, string> = {
  ts: 'src/connector.ts',
  py: 'connector.py',
}

export function CodePanel({ drafts, finalOk, lang }: { drafts: Draft[]; finalOk: boolean | null; lang: Lang }) {
  const [attempt, setAttempt] = useState(1)
  const [path, setPath] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const latest = drafts.at(-1)?.attempt
    if (latest) setAttempt(latest)
  }, [drafts.length])

  const draft = drafts.find((d) => d.attempt === attempt) ?? drafts.at(-1)
  if (!draft) return null
  const effectivePath = path ?? DEFAULT_PATH_BY_LANG[lang]
  const file = draft.files.find((f) => f.path === effectivePath) ?? draft.files.find((f) => f.path === DEFAULT_PATH_BY_LANG[lang]) ?? draft.files[0]
  const fixturesPath = lang === 'py' ? 'fixtures.py' : 'src/fixtures.ts'
  const previous = drafts.find((d) => d.attempt === draft.attempt - 1)
  const changed = new Set(
    previous ? draft.files.filter((f) => previous.files.find((p) => p.path === f.path)?.content !== f.content).map((f) => f.path) : [],
  )

  async function download() {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    for (const f of draft!.files) zip.file(f.path, f.content)
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'connector.zip'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function copy() {
    if (!file) return
    await navigator.clipboard.writeText(file.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-paper-line bg-paper-card">
      {drafts.length > 1 && <Trajectory drafts={drafts} activeAttempt={draft.attempt} onPick={setAttempt} lang={lang} />}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper-line px-3 py-2">
        <div className="flex gap-1">
          {drafts.map((d) => (
            <button
              key={d.attempt}
              onClick={() => setAttempt(d.attempt)}
              className={`rounded-md px-2.5 py-1 text-xs ${d.attempt === draft.attempt ? 'bg-ink text-white' : 'text-ink-soft hover:bg-paper'}`}
            >
              Draft {d.attempt}
              {d.report && <span className="ml-1.5 opacity-80">{d.report.passed}/{d.report.total}</span>}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button onClick={copy} className="rounded-md px-2.5 py-1 text-xs text-ink-soft hover:bg-paper">
            {copied ? 'Copied' : 'Copy file'}
          </button>
          <button
            onClick={download}
            disabled={!finalOk}
            title={finalOk ? '' : 'Available once the tests pass'}
            className="rounded-md bg-signal px-2.5 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Download .zip
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-paper-line px-3 pt-2">
        {draft.files.map((f) => (
          <button
            key={f.path}
            onClick={() => setPath(f.path)}
            className={`-mb-px rounded-t-md border px-2.5 py-1.5 text-xs ${f.path === file?.path ? 'border-paper-line border-b-paper-card bg-paper-card text-ink' : 'border-transparent text-ink-mute hover:text-ink'}`}
          >
            {f.path.replace(/^src\//, '')}
            {f.path === fixturesPath && <span className="ml-1 text-ink-mute">(from docs)</span>}
            {changed.has(f.path) && <span className="ml-1 text-signal">●</span>}
          </button>
        ))}
      </div>

      <pre className="code min-h-[320px] flex-1 overflow-auto p-4 text-ink">{file?.content}</pre>

      {draft.report && <Report report={draft.report} lang={lang} />}
    </section>
  )
}

/**
 * Compact strip across the top of the Code panel that shows how the connector
 * evolved from draft 1 to the current one. Each pill is clickable (jumps the
 * code viewer to that draft), hover shows the first failing test so the viewer
 * sees *why* the model took another swing without expanding anything.
 */
function Trajectory({ drafts, activeAttempt, onPick, lang }: { drafts: Draft[]; activeAttempt: number; onPick: (n: number) => void; lang: Lang }) {
  const checkLabel = lang === 'py' ? 'syntax check' : 'typecheck'
  return (
    <div className="flex items-center gap-2 border-b border-paper-line bg-paper px-3 py-2 text-[11px]">
      <span className="text-ink-mute">Repair trajectory</span>
      <div className="flex flex-wrap items-center gap-1">
        {drafts.map((d, i) => {
          const r = d.report
          const green = r?.typecheckOk && r.failed === 0 && (r.contract === undefined || r.contract === 'passed')
          const label = r ? `${r.passed}/${r.total}` : '…'
          const why = r?.failures[0]
            ? `attempt ${d.attempt}: ${r.passed}/${r.total}, ${r.typecheckOk ? `${checkLabel} ok` : `${checkLabel} failed`}, ${r.contract ?? 'no contract'}\nfirst failure: ${r.failures[0].name}`
            : `attempt ${d.attempt}`
          return (
            <span key={d.attempt} className="flex items-center gap-1">
              {i > 0 && <span className="text-ink-mute">→</span>}
              <button
                onClick={() => onPick(d.attempt)}
                title={why}
                className={`rounded-full border px-2 py-0.5 font-medium transition ${
                  d.attempt === activeAttempt
                    ? 'border-ink text-ink'
                    : green
                    ? 'border-signal/40 text-signal hover:border-signal'
                    : 'border-warn/40 text-warn hover:border-warn'
                }`}
              >
                {label}
                <span className="ml-1 text-ink-mute">{green ? '✓' : '✖'}</span>
              </button>
            </span>
          )
        })}
      </div>
    </div>
  )
}

function Report({ report, lang }: { report: TestReport; lang: 'ts' | 'py' }) {
  const green = report.typecheckOk && report.failed === 0
  const typecheckLabel = lang === 'py' ? 'syntax check' : 'typecheck'
  const fixturesPath = lang === 'py' ? 'fixtures.py' : 'src/fixtures.ts'
  return (
    <div className={`border-t border-paper-line px-4 py-3 text-xs ${green ? 'bg-signal-soft' : 'bg-warn-soft'}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className={`font-semibold ${green ? 'text-signal' : 'text-warn'}`}>
          {green ? 'All tests pass' : `${report.failed} of ${report.total} tests fail`}
        </span>
        <span className="text-ink-soft">{typecheckLabel} {report.typecheckOk ? 'clean' : 'failed'}</span>
        {report.contract && (
          <span
            title={`The suite ran the connector against the example payload and responses from the official docs (${fixturesPath}), which patchbay writes and the model cannot change.`}
            className={report.contract === 'passed' ? 'text-signal' : 'text-warn'}
          >
            docs contract {report.contract === 'passed' ? 'passed' : report.contract === 'missing' ? 'missing' : 'failed'}
          </span>
        )}
        <span className="text-ink-soft">{report.passed}/{report.total} passed</span>
        <span className="code text-ink-mute">
          {report.ranOn === 'replay' ? 'recorded run' : report.ranOn === 'local' ? 'local runner' : report.ranOn.replace('nebius-sandbox:', 'sandbox op ')}
        </span>
      </div>
      {report.failures.length > 0 && (
        <ul className="mt-2 space-y-2">
          {report.failures.map((f, i) => (
            <li key={i}>
              <div className="font-medium text-ink">✖ {f.name}</div>
              <pre className="code mt-0.5 max-h-28 overflow-auto whitespace-pre-wrap text-[11.5px] text-ink-soft">{f.message}</pre>
            </li>
          ))}
        </ul>
      )}
      {!report.typecheckOk && report.typecheckOutput && (
        <pre className="code mt-2 max-h-28 overflow-auto whitespace-pre-wrap text-[11.5px] text-ink-soft">{report.typecheckOutput}</pre>
      )}
    </div>
  )
}

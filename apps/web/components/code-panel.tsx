'use client'

import { useEffect, useState } from 'react'
import type { ApiSpec, GeneratedFile, Lang, Plan, TestReport, Usage } from '@patchbay-nebius/agent'

interface Draft {
  attempt: number
  files: GeneratedFile[]
  report: TestReport | null
}

export interface EvidenceContext {
  /** The user's one-sentence prompt — the whole thing starts here. */
  prompt?: string
  plan?: Plan | null
  spec?: ApiSpec | null
  usage?: Usage[]
  result?: { ok: boolean; attempts: number } | null
  startedAt?: string
}

// The main source file in each language — used as the default tab when the panel first renders.
const DEFAULT_PATH_BY_LANG: Record<Lang, string> = {
  ts: 'src/connector.ts',
  py: 'connector.py',
}

export function CodePanel({ drafts, finalOk, lang, evidence }: { drafts: Draft[]; finalOk: boolean | null; lang: Lang; evidence?: EvidenceContext }) {
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

  async function downloadEvidence() {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    const timestamp = new Date().toISOString()
    const sha256Hex = async (text: string): Promise<string> => {
      const buf = new TextEncoder().encode(text)
      const hash = await crypto.subtle.digest('SHA-256', buf)
      return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
    }

    // Final deliverable — the connector files from the best attempt
    const final = drafts[drafts.length - 1]
    const finalDir = zip.folder('connector')!
    const hashes: Record<string, string> = {}
    for (const f of final?.files ?? []) {
      finalDir.file(f.path, f.content)
      hashes[`connector/${f.path}`] = await sha256Hex(f.content)
    }

    // Every attempt — files + report — so a judge can audit the repair trajectory
    const trajDir = zip.folder('trajectory')!
    for (const d of drafts) {
      const attDir = trajDir.folder(`attempt-${d.attempt}`)!
      for (const f of d.files) {
        attDir.file(f.path, f.content)
        hashes[`trajectory/attempt-${d.attempt}/${f.path}`] = await sha256Hex(f.content)
      }
      if (d.report) {
        const reportJson = JSON.stringify(d.report, null, 2)
        attDir.file('report.json', reportJson)
        hashes[`trajectory/attempt-${d.attempt}/report.json`] = await sha256Hex(reportJson)
      }
    }

    // Prompt + plan + spec — the research breadcrumb a reviewer can follow back to the vendor docs
    if (evidence?.prompt) zip.file('prompt.txt', evidence.prompt)
    if (evidence?.plan) zip.file('plan.json', JSON.stringify(evidence.plan, null, 2))
    if (evidence?.spec) zip.file('spec.json', JSON.stringify(evidence.spec, null, 2))

    // Model usage with cost — exactly what patchbay charged against the Nebius Token Factory account
    if (evidence?.usage?.length) {
      const costUsd = evidence.usage.reduce((s, u) => s + u.costUsd, 0)
      const usageDoc = {
        totalCostUsd: costUsd,
        calls: evidence.usage.map((u) => ({
          model: u.model,
          promptTokens: u.promptTokens,
          completionTokens: u.completionTokens,
          costUsd: u.costUsd,
        })),
      }
      zip.file('usage.json', JSON.stringify(usageDoc, null, 2))
    }

    // Sandbox operation IDs — the auditable breadcrumb inside Nebius
    const sandboxOps = drafts
      .map((d) => d.report?.ranOn)
      .filter((x): x is string => !!x && x.startsWith('nebius-sandbox:'))
      .map((s) => s.replace('nebius-sandbox:', ''))

    const manifest = {
      kind: 'patchbay-evidence',
      version: 1,
      issuedAt: timestamp,
      prompt: evidence?.prompt ?? null,
      lang,
      attempts: drafts.length,
      finalResult: evidence?.result ?? (final?.report ? { ok: final.report.failed === 0 && final.report.typecheckOk && (final.report.contract === undefined || final.report.contract === 'passed'), attempts: drafts.length } : null),
      finalReport: final?.report ?? null,
      sandboxOperationIds: sandboxOps,
      sha256: hashes,
      verify: {
        hashAlgo: 'sha256',
        notes: [
          'Every file under connector/ and trajectory/ is listed in sha256{} with its hex digest.',
          'Recompute locally: `shasum -a 256 connector/connector.py` (or sha256sum on linux). Must match this manifest.',
          'The sandboxOperationIds are the Nebius Token Factory operations that ran the tests. They are retained in your project history for audit.',
          'usage.json carries the per-call model usage billed against your Nebius account for this build.',
        ],
      },
    }
    zip.file('manifest.json', JSON.stringify(manifest, null, 2))

    const readmeMd = [
      '# patchbay — evidence export',
      '',
      '`manifest.json` is the single source of truth. Every artifact here is referenced from it, and every file has a SHA-256 in `manifest.sha256`.',
      '',
      '## Contents',
      '- `connector/` — the final (green) connector files you can drop into a repo',
      '- `trajectory/attempt-N/` — every attempt the agent made, including the files and the test report for that attempt',
      '- `prompt.txt` — the one-sentence prompt that started it',
      '- `plan.json` — the plan step (source app, target app, field mapping)',
      '- `spec.json` — the researched API spec (endpoints, auth, example payloads) from the docs',
      '- `usage.json` — model calls and cost (per call and total)',
      '- `manifest.json` — issuedAt, prompt, final result, sandbox operation IDs, sha256 of every file, and verify instructions',
      '',
      '## Verify',
      '```bash',
      '# recompute every file hash and compare against manifest.sha256',
      'jq -r \'.sha256 | to_entries[] | "\\(.value)  \\(.key)"\' manifest.json | shasum -a 256 -c',
      '```',
      '',
      'The `sandboxOperationIds` in manifest.json are Nebius Token Factory operations that ran the tests inside an isolated sandbox with networking off. Your Nebius project retains them in its operation history.',
    ].join('\n')
    zip.file('README.md', readmeMd)

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `patchbay-evidence-${timestamp.replace(/[:.]/g, '-')}.zip`
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
            onClick={downloadEvidence}
            disabled={drafts.length === 0}
            title="Full audit bundle: every attempt, the final files, the plan/spec, model usage, sandbox op ids, and sha-256 hashes"
            className="rounded-md border border-paper-line px-2.5 py-1 text-xs text-ink-soft hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40"
          >
            Evidence .zip
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

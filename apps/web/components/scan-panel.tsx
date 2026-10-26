'use client'

import { useEffect, useRef, useState } from 'react'
import type { Opportunity } from '@patchbay-nebius/agent'

export function ScanPanel({ onPick }: { onPick: (prompt: string) => void }) {
  const [repo, setRepo] = useState('')
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<{
    repo: string; ref: string; scanned: number; totalCandidates?: number; truncated: boolean; private: boolean; opportunities: Opportunity[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [copied, setCopied] = useState(false)
  const autoScanned = useRef(false)

  async function scanRepo(input: string) {
    const parsed = parseRepo(input)
    if (!parsed) { setError('Enter a GitHub URL or "owner/name".'); return }
    setScanning(true); setError(null); setResult(null); setShowAll(false)
    try {
      const res = await fetch('/api/github/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: parsed }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `Scan failed (${res.status})`)
      } else {
        setResult(data)
        // Deep-link the scanned repo into the URL so it's shareable, without
        // reloading the page. Someone pasting ?scan=owner/name lands on the
        // same results instantly.
        const url = new URL(window.location.href)
        url.searchParams.set('scan', parsed)
        window.history.replaceState({}, '', url.toString())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setScanning(false)
    }
  }

  async function scan(e: React.FormEvent) {
    e.preventDefault()
    await scanRepo(repo)
  }

  // Auto-scan when ?scan=owner/name is in the URL — makes the whole result
  // page shareable: tweet the link, the recipient sees the same scan.
  useEffect(() => {
    if (autoScanned.current) return
    const params = new URLSearchParams(window.location.search)
    const q = params.get('scan')
    if (q && parseRepo(q)) {
      autoScanned.current = true
      setRepo(q)
      void scanRepo(q)
    }
  }, [])

  function copyShareLink() {
    if (!result) return
    const url = new URL(window.location.href)
    url.searchParams.set('scan', result.repo)
    void navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const shown = result ? (showAll ? result.opportunities : result.opportunities.slice(0, 8)) : []

  return (
    <section className="mt-6 rounded-xl border border-paper-line bg-paper-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Scan a repo for integration opportunities</h3>
          <p className="mt-0.5 text-xs text-ink-soft">
            Point patchbay at any GitHub repo — it flags TODOs, env vars, stub webhook handlers and unused SDK imports that could become a connector.
          </p>
        </div>
      </div>

      <form onSubmit={scan} className="mt-3 flex flex-wrap gap-2">
        <input
          type="text"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          placeholder="github.com/vercel/next.js  —  or  owner/name"
          className="flex-1 min-w-[260px] rounded-md border border-paper-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-ink-mute"
        />
        <button
          type="submit"
          disabled={scanning || repo.trim().length < 3}
          className="rounded-md bg-ink px-4 py-1.5 text-sm text-white disabled:opacity-40"
        >
          {scanning ? 'Scanning…' : 'Scan repo'}
        </button>
      </form>

      {error && <div className="mt-3 rounded-md border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn">{error}</div>}

      {result && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
            <span>
              <span className="code">{result.repo}</span>
              <span className="mx-1.5 text-paper-line">·</span>
              {result.opportunities.length} opportunit{result.opportunities.length === 1 ? 'y' : 'ies'} across {result.scanned} files
              {result.totalCandidates && result.totalCandidates > result.scanned
                ? ` (ranked from ${result.totalCandidates} candidates)`
                : ''}
              {result.truncated && ' · tree truncated by GitHub'}
            </span>
            <div className="flex items-center gap-3">
              {result.opportunities.length > 8 && (
                <button onClick={() => setShowAll((s) => !s)} className="text-ink-mute hover:text-ink">
                  {showAll ? 'Show top 8' : `Show all ${result.opportunities.length}`}
                </button>
              )}
              <button
                onClick={copyShareLink}
                className="text-ink-mute hover:text-ink"
                title="Copy a link to this scan"
              >
                {copied ? '✓ copied' : 'Share scan ↗'}
              </button>
            </div>
          </div>

          {result.opportunities.length === 0 ? (
            <p className="mt-3 text-xs text-ink-mute">Nothing obvious — the scanner looks for TODOs, env vars with vendor names, stub webhook handlers, and unused vendor SDK imports.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {shown.map((op, i) => (
                <li key={`${op.file}:${op.line}:${i}`} className="rounded-lg border border-paper-line bg-paper p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-ink">
                      <span className="rounded bg-paper-card px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-mute">{op.kind}</span>
                      <span className="mx-2 text-ink-mute">score {op.score}</span>
                      <a
                        href={`https://github.com/${result.repo}/blob/${result.ref}/${op.file}#L${op.line}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-ink-soft hover:text-ink"
                      >
                        {op.file}:{op.line} ↗
                      </a>
                    </span>
                    <button
                      onClick={() => onPick(op.prompt)}
                      className="rounded bg-ink px-2.5 py-1 text-[11px] text-white hover:opacity-90"
                    >
                      Use this prompt →
                    </button>
                  </div>
                  <p className="mt-2 text-ink-soft">{op.evidence}</p>
                  <p className="mt-1.5 border-l-2 border-paper-line pl-2 italic text-ink">{op.prompt}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

function parseRepo(input: string): string | null {
  const trimmed = input.trim().replace(/\.git$/, '')
  const urlMatch = trimmed.match(/github\.com[/:]([\w.-]+\/[\w.-]+)/i)
  if (urlMatch) return urlMatch[1]!
  if (/^[\w.-]+\/[\w.-]+$/.test(trimmed)) return trimmed
  return null
}

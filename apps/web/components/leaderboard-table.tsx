'use client'

import Link from 'next/link'
import { useMemo, useState, type ReactNode } from 'react'
import type {
  LeaderboardEntry,
  LeaderboardGrade,
  LeaderboardScanSource,
  LeaderboardVerificationCounts,
} from '@/lib/leaderboard-store'

const GRADES: LeaderboardGrade[] = ['A', 'B', 'C', 'D', 'F']

const COVERAGE_LABEL: Record<LeaderboardScanSource, { icon: string; text: string; title: string }> = {
  'live-metadata+source': { icon: '✅', text: 'full', title: 'Live metadata probe plus static source audit of the linked repo' },
  'live-metadata': { icon: '🔍', text: 'metadata', title: 'Live metadata only — repo not available or clone failed' },
  'source': { icon: '📦', text: 'source', title: 'Static source audit only — the live URL was unreachable' },
  'authenticated': { icon: '🔑', text: 'auth', title: 'Scanned with a user-submitted bearer token' },
  'operator-verified': { icon: '👤', text: 'operator', title: 'Submitted by the server operator (verified ownership)' },
  'unreachable': { icon: '🚨', text: 'unreachable', title: 'Not reachable during the last scan' },
}

function VerificationPills({ counts }: { counts: LeaderboardVerificationCounts | undefined }) {
  // No data = pre-Schema-v2 snapshot or empty entry. Show a quiet marker
  // instead of implying everything is a potential FP.
  if (!counts) {
    return (
      <span
        title="This entry was scanned before Schema v2 — verification tier will populate on next rescan."
        className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[10.5px] text-ink-mute"
      >
        tier pending
      </span>
    )
  }
  const total = counts['source-confirmed'] + counts['runtime-verified'] + counts['potential-fp']
  if (total === 0) {
    return <span className="text-ink-mute">—</span>
  }
  const pills: Array<[string, number, string, string]> = [
    ['confirmed', counts['source-confirmed'], '#000000', '#ffffff'],
    ['verified', counts['runtime-verified'], '#c3c8ff', 'rgba(109,108,255,.18)'],
    ['fp', counts['potential-fp'], '#a3a3ad', 'rgba(255,255,255,.06)'],
  ]
  return (
    <span
      title="Finding Schema v2 breakdown. source-confirmed = patchbay saw the code path · runtime-verified = reproduced live against the endpoint · potential-fp = pattern matched, manual verification required."
      style={{ display: 'inline-flex', gap: '0.25rem', fontVariantNumeric: 'tabular-nums', fontSize: '0.72rem' }}
    >
      {pills.map(([label, n, fg, bg]) => (
        <span
          key={label}
          style={{
            padding: '0.05rem 0.35rem',
            borderRadius: 999,
            color: fg,
            background: bg,
            opacity: n === 0 ? 0.45 : 1,
          }}
        >
          {n} {label}
        </span>
      ))}
    </span>
  )
}

function CoverageBadge({ entry }: { entry: LeaderboardEntry }) {
  const s = entry.scanSource
  if (!s) return <span className="text-ink-mute">—</span>
  const l = COVERAGE_LABEL[s]
  return (
    <span title={l.title} className="text-ink-soft">
      <span style={{ marginRight: '0.3rem' }}>{l.icon}</span>{l.text}
    </span>
  )
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[]
  capturedDate: string
  unreachable: ReactNode
}

export function LeaderboardTable({ entries, capturedDate: _capturedDate, unreachable }: LeaderboardTableProps) {
  const [query, setQuery] = useState('')
  const [enabledGrades, setEnabledGrades] = useState<Set<LeaderboardGrade>>(() => new Set(GRADES))

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (!enabledGrades.has(e.grade)) return false
      if (normalizedQuery === '') return true
      // Match host, slug, category — covers "google", "oauth-protected", "mcp.foo.dev"
      return (
        e.host.toLowerCase().includes(normalizedQuery) ||
        e.slug.toLowerCase().includes(normalizedQuery) ||
        e.category.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [entries, normalizedQuery, enabledGrades])

  function toggleGrade(g: LeaderboardGrade) {
    setEnabledGrades((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      // Never leave all off — toggling the last one back on gives all
      if (next.size === 0) return new Set(GRADES)
      return next
    })
  }

  function setOnly(g: LeaderboardGrade) {
    setEnabledGrades(new Set([g]))
  }

  function resetFilters() {
    setQuery('')
    setEnabledGrades(new Set(GRADES))
  }

  const total = entries.length
  const shown = filtered.length
  const filterActive = normalizedQuery !== '' || enabledGrades.size !== GRADES.length

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="g-glass g-field flex-1 max-w-md">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            className="h-4 w-4 flex-none text-ink-mute"
          >
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="m14 14 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            inputMode="search"
            placeholder="Search host, slug or category"
            aria-label="Search leaderboard"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none"
          />
          {query !== '' && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="text-ink-mute hover:text-white"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[.12em] text-ink-mute">grade</span>
          {GRADES.map((g) => {
            const on = enabledGrades.has(g)
            return (
              <button
                key={g}
                type="button"
                aria-pressed={on}
                onClick={() => toggleGrade(g)}
                onDoubleClick={() => setOnly(g)}
                title={`Toggle grade ${g} (double-click: only ${g})`}
                className={`g-grade g-grade-${g} ${on ? '' : 'opacity-30'} hover:opacity-100`}
                style={{ cursor: 'pointer', width: 26, height: 26, fontSize: 13 }}
              >
                {g}
              </button>
            )
          })}
          {filterActive && (
            <button
              type="button"
              onClick={resetFilters}
              className="ml-1 text-[11px] text-ink-mute underline underline-offset-2 hover:text-white"
            >
              clear
            </button>
          )}
        </div>
      </div>

      <p className="mb-3 text-[11px] text-ink-mute tabular-nums">
        Showing {shown} of {total}{filterActive && shown === 0 ? ' — no hosts match.' : ''}
      </p>

      {/* Desktop: table. Phone: the same rows as a compact list. */}
      <div className="g-glass hidden overflow-x-auto px-6 pb-3 pt-2 md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/15 text-left text-[11px] uppercase tracking-[.12em] text-ink-mute">
              <th scope="col" className="px-1 py-3 font-normal">#</th>
              <th scope="col" className="px-1 py-3 font-normal">host</th>
              <th scope="col" className="px-1 py-3 font-normal">grade</th>
              <th scope="col" className="px-1 py-3 text-right font-normal">score</th>
              <th scope="col" className="px-1 py-3 text-right font-normal">findings</th>
              <th scope="col" className="px-1 py-3 pl-6 font-normal">verification</th>
              <th scope="col" className="px-1 py-3 font-normal">coverage</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => {
              const totalFindings = e.findings.critical + e.findings.high + e.findings.medium + e.findings.low
              return (
                <tr key={e.slug} className="border-b border-white/[.07] last:border-b-0">
                  <td className="px-1 py-3 font-mono text-xs tabular-nums text-ink-mute">{i + 1}</td>
                  <td className="px-1 py-3">
                    <Link href={`/leaderboard/${e.slug}`} className="font-mono text-[13px] text-ink hover:text-white">
                      {e.host}
                    </Link>
                  </td>
                  <td className="px-1 py-3"><span className={`g-grade g-grade-${e.grade}`}>{e.grade}</span></td>
                  <td className="font-display px-1 py-3 text-right text-xl tabular-nums">{e.score}</td>
                  <td className="px-1 py-3 text-right tabular-nums text-ink-soft">{totalFindings}</td>
                  <td className="px-1 py-3 pl-6"><VerificationPills counts={e.verificationCounts} /></td>
                  <td className="px-1 py-3 text-xs"><CoverageBadge entry={e} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ol className="md:hidden">
        {filtered.map((e, i) => {
          const totalFindings = e.findings.critical + e.findings.high + e.findings.medium + e.findings.low
          return (
            <li key={e.slug} className="border-b border-white/[.07]">
              <Link href={`/leaderboard/${e.slug}`} className="grid grid-cols-[32px_1fr_34px] items-center gap-3 py-3">
                <span className="font-mono text-[11px] text-ink-mute">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate font-mono text-[13px] text-ink">{e.host}</span>
                  <span className="text-[11.5px] text-ink-mute">
                    {e.score} · {totalFindings} finding{totalFindings === 1 ? '' : 's'}
                  </span>
                </span>
                <span className={`g-grade g-grade-${e.grade}`}>{e.grade}</span>
              </Link>
            </li>
          )
        })}
      </ol>

      {unreachable}
    </>
  )
}

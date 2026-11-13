import type { Metadata } from 'next'
import Link from 'next/link'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const DATA_FILE = join(process.cwd(), 'data', 'impersonation-public.json')

export const runtime = 'nodejs'
export const revalidate = 3600

const TITLE = 'MCP Registry impersonation report · patchbay'
const DESCRIPTION =
  '313 brand-lookalike MCP servers, 7 same-host repo-owner mismatches and 3,633 cross-owner near-name pairs on the official MCP Registry. The first registry-wide impersonation audit for MCP.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/leaderboard/impersonation' },
  robots: { index: true, follow: true },
}

interface Entry {
  registryName: string
  repositoryUrl?: string
  description?: string
  editDistance: number
  signal: string
}

interface Pair {
  nameA: string
  nameB: string
  normalisedA: string
  normalisedB: string
  editDistance: number
  signal: string
  entryA: { name: string; remoteUrl: string; repositoryUrl?: string; description?: string }
  entryB: { name: string; remoteUrl: string; repositoryUrl?: string; description?: string }
}

interface Report {
  generatedAt: string
  entriesScanned: number
  totalBrandLookalikes: number
  totalPairFlags: number
  pairsBySignal: Record<string, number>
  brandCounts: Record<string, number>
  brandLookalikes: Record<string, Entry[]>
  sharpPairs: Pair[]
}

function loadReport(): Report | null {
  try { return JSON.parse(readFileSync(DATA_FILE, 'utf8')) as Report } catch { return null }
}

export default function ImpersonationPage() {
  const report = loadReport()
  if (!report) {
    return (
      <main style={{ maxWidth: 820, margin: '0 auto', padding: '2rem 1rem' }}>
        <h1>Impersonation report</h1>
        <p>Report not available in this build. Run <code>npx tsx scripts/detect-impersonation.ts</code> then redeploy.</p>
      </main>
    )
  }

  const brandRows = Object.entries(report.brandCounts).sort((a, b) => b[1] - a[1])
  const capturedDate = report.generatedAt.slice(0, 10)

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'ui-sans-serif, system-ui, sans-serif', lineHeight: 1.55 }}>
      <nav style={{ marginBottom: '1.5rem' }}>
        <Link href="/leaderboard" style={{ color: '#6366f1' }}>← Leaderboard</Link>
      </nav>

      <h1 style={{ fontSize: '2rem', margin: '0 0 0.25rem' }}>MCP Registry impersonation report</h1>
      <p style={{ color: '#6b7280', margin: '0 0 1rem' }}>
        Scanned {report.entriesScanned.toLocaleString()} unique servers on the official MCP Registry on {capturedDate}. Found <strong>{report.totalBrandLookalikes}</strong> brand-lookalike entries across 20 well-known brands, plus <strong>{(report.pairsBySignal['different-owner-and-host'] ?? 0).toLocaleString()}</strong> name pairs within edit distance 2 whose two entries come from different owners AND different hosts.
      </p>

      <section style={{ padding: '1rem', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, marginBottom: '1.5rem' }}>
        <strong>How to read this.</strong> Not every lookalike is malicious. Some orgs ship legitimate third-party wrappers of a brand&apos;s public API ({'"'}unofficial but useful{'"'}). Others look like typosquats designed to catch misreads. Our detector cannot tell the two apart — it surfaces the pattern so operators can decide. If you are a listed org and believe the flag is wrong, <a href="mailto:hello@patchbay-mcp.dev">email us</a> and we will add a note or delist.
      </section>

      <h2 style={{ fontSize: '1.25rem', marginTop: '1.5rem' }}>Brand impersonation by target</h2>
      <p style={{ color: '#6b7280' }}>
        How many registry entries use a well-known brand name without being published by that brand&apos;s legitimate org. For several of these brands, <strong>no official MCP exists</strong> on the registry at all — every entry you see is third-party.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.93rem', marginTop: '0.5rem' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '0.5rem 0.25rem' }}>Brand</th>
            <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>Unofficial MCPs in registry</th>
            <th style={{ padding: '0.5rem 0.25rem' }}>Examples</th>
          </tr>
        </thead>
        <tbody>
          {brandRows.map(([brand, count]) => {
            const samples = (report.brandLookalikes[brand] ?? []).slice(0, 2)
            return (
              <tr key={brand} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '0.5rem 0.25rem', fontWeight: 600, textTransform: 'capitalize' }}>{brand}</td>
                <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{count}</td>
                <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.85rem', color: '#4b5563' }}>
                  {samples.map((s) => (
                    <div key={s.registryName}>
                      <code style={{ fontSize: '0.85rem' }}>{s.registryName}</code>
                      {s.repositoryUrl && (
                        <> · <a href={s.repositoryUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#6b7280' }}>{s.repositoryUrl.replace('https://github.com/', '').slice(0, 40)}</a></>
                      )}
                    </div>
                  ))}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h2 style={{ fontSize: '1.25rem', marginTop: '2rem' }}>Cross-owner name pairs</h2>
      <p style={{ color: '#6b7280' }}>
        Top 50 registry entries whose names are within one or two character edits of another entry — AND whose repository owners and live-URL hosts both differ. Sharpest impersonation signal, lowest edit distance first.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', marginTop: '0.5rem' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '0.5rem 0.25rem' }}>Entry A</th>
            <th style={{ padding: '0.5rem 0.25rem' }}>Entry B</th>
            <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>Edit distance</th>
          </tr>
        </thead>
        <tbody>
          {report.sharpPairs.map((p) => (
            <tr key={p.nameA + '||' + p.nameB} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '0.4rem 0.25rem', fontSize: '0.85rem' }}>
                <code>{p.nameA}</code>
                {p.entryA.repositoryUrl && <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{p.entryA.repositoryUrl.replace('https://github.com/', '')}</div>}
              </td>
              <td style={{ padding: '0.4rem 0.25rem', fontSize: '0.85rem' }}>
                <code>{p.nameB}</code>
                {p.entryB.repositoryUrl && <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{p.entryB.repositoryUrl.replace('https://github.com/', '')}</div>}
              </td>
              <td style={{ padding: '0.4rem 0.25rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.editDistance}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section style={{ marginTop: '2rem', padding: '1rem', background: '#f9fafb', borderRadius: 8, fontSize: '0.9rem', color: '#4b5563' }}>
        <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Methodology</h2>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          <li>Source: the {report.entriesScanned.toLocaleString()} unique MCP servers listed on <a href="https://registry.modelcontextprotocol.io" target="_blank" rel="noopener noreferrer">registry.modelcontextprotocol.io</a> on {capturedDate}, one row per server name.</li>
          <li>Pairs: Levenshtein distance ≤ 2 on the normalised entry name (lowercase, punctuation stripped). We only keep pairs where the two entries have different repository owners AND different live-URL hosts.</li>
          <li>Brand lookalikes: for 20 well-known brands, we flag any entry whose name matches or contains the brand token when the repository owner is not from the brand&apos;s legit GitHub org.</li>
          <li>False positives: legitimate third-party wrappers of a brand&apos;s public API will show up here. We do not label individual entries as malicious; we surface the pattern and link the source.</li>
          <li>Code: <a href="https://github.com/GodSmasher/patchbay/blob/main/scripts/detect-impersonation.ts">scripts/detect-impersonation.ts</a></li>
        </ul>
      </section>
    </main>
  )
}

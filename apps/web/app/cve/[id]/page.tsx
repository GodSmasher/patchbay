import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadAllCves, loadCve, viewForPublic, isEmbargoActive, type CveSeverity } from '@/lib/cve'

export const runtime = 'nodejs'
export const revalidate = 300

export function generateStaticParams() {
  return loadAllCves().map((e) => ({ id: e.id }))
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const raw = loadCve(params.id)
  if (!raw) return { title: 'CVE not found · patchbay' }
  const e = viewForPublic(raw)
  return {
    title: e.id + ' · ' + e.title + ' · patchbay',
    description: e.summary ?? e.description ?? e.title,
    alternates: { canonical: '/cve/' + e.id },
    robots: { index: true, follow: true },
  }
}

const SEV_COLOR: Record<CveSeverity, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#6b7280',
  info: '#6b7280',
}

export default function CveDetailPage({ params }: { params: { id: string } }) {
  const raw = loadCve(params.id)
  if (!raw) notFound()
  const e = viewForPublic(raw)
  const embargoActive = isEmbargoActive(raw)

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'ui-sans-serif, system-ui, sans-serif', lineHeight: 1.6 }}>
      <nav style={{ marginBottom: '1.5rem' }}>
        <Link href="/cve" style={{ color: '#6366f1' }}>← CVE database</Link>
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <span style={{ padding: '0.15rem 0.5rem', borderRadius: 4, background: SEV_COLOR[e.severity], color: 'white', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>{e.severity}</span>
        <code style={{ fontFamily: 'monospace', color: '#6b7280' }}>{e.id}</code>
        <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>· {e.status}</span>
      </div>

      <h1 style={{ fontSize: '1.8rem', margin: '0 0 1rem' }}>{e.title}</h1>

      {embargoActive && (
        <section style={{ padding: '1rem', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          <strong>This advisory is under a coordinated-disclosure embargo until {raw.embargoUntil?.slice(0, 10)}.</strong> The server name, repository URL and evidence are withheld while the operator has time to rotate / patch. The finding category, severity and generic fix are published so other operators can proactively check their own systems.
        </section>
      )}

      {e.summary && <p style={{ fontSize: '1.05rem', color: '#374151' }}>{e.summary}</p>}

      <section style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem' }}>Finding</h2>
        <p>
          Check <Link href={`/docs/${e.findingId.toLowerCase()}`} style={{ color: '#6366f1', fontFamily: 'monospace' }}>{e.findingId}</Link>
          {e.severityRationale && <> · {e.severityRationale}</>}
        </p>
      </section>

      {e.serverName && (
        <section style={{ marginTop: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem' }}>Affected</h2>
          <p><code>{e.serverName}</code>{e.affectedVersions && <> · versions {e.affectedVersions}</>}</p>
          {e.repositoryUrl && <p style={{ fontSize: '0.9rem' }}><a href={e.repositoryUrl} target="_blank" rel="noopener noreferrer">{e.repositoryUrl}</a></p>}
        </section>
      )}

      {e.description && (
        <section style={{ marginTop: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem' }}>Description</h2>
          <p style={{ whiteSpace: 'pre-line' }}>{e.description}</p>
        </section>
      )}

      {e.impact && (
        <section style={{ marginTop: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem' }}>Impact</h2>
          <p style={{ whiteSpace: 'pre-line' }}>{e.impact}</p>
        </section>
      )}

      {e.evidence && (
        <section style={{ marginTop: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem' }}>Evidence</h2>
          <pre style={{ background: '#f3f4f6', padding: '0.75rem 1rem', borderRadius: 6, overflowX: 'auto', fontSize: '0.85rem' }}>{e.evidence}</pre>
        </section>
      )}

      <section style={{ marginTop: '1rem' }}>
        <h2 style={{ fontSize: '1.1rem' }}>Fix</h2>
        <p style={{ whiteSpace: 'pre-line' }}>{e.fix ?? e.genericFix}</p>
      </section>

      {e.references && e.references.length > 0 && (
        <section style={{ marginTop: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem' }}>References</h2>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {e.references.map((r) => (
              <li key={r}><a href={r} target="_blank" rel="noopener noreferrer">{r}</a></li>
            ))}
          </ul>
        </section>
      )}

      <section style={{ marginTop: '1rem', color: '#4b5563', fontSize: '0.9rem' }}>
        <h2 style={{ fontSize: '1rem' }}>Credit</h2>
        <p>
          {e.credit?.discovered && <>Discovered by: {e.credit.discovered}<br /></>}
          {(e.credit?.reportedBy ?? e.credit?.reported) && <>Reported by: {e.credit.reportedBy ?? e.credit.reported}</>}
        </p>
      </section>

      <section style={{ marginTop: '2rem', fontSize: '0.85rem', color: '#6b7280' }}>
        <p>Published {e.published.slice(0, 10)} · Last modified {e.lastModified.slice(0, 10)}</p>
        <p>Source: <a href={`https://github.com/GodSmasher/patchbay/blob/main/bench/cve/${e.id}.json`} target="_blank" rel="noopener noreferrer">bench/cve/{e.id}.json</a></p>
      </section>
    </main>
  )
}

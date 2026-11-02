import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DOCS, getDoc, type Severity } from '../_data'

export function generateStaticParams() {
  return DOCS.map((d) => ({ id: d.id }))
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const doc = getDoc(params.id)
  if (!doc) return { title: 'Not found' }
  return {
    title: `${doc.id.toUpperCase()} · ${doc.title} · patchbay`,
    description: doc.oneLiner,
  }
}

const SEV_COLOR: Record<Severity, string> = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/30',
  high: 'bg-red-500/10 text-red-400 border-red-500/30',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  low: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/30',
  info: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/30',
}

export default function DocPage({ params }: { params: { id: string } }) {
  const doc = getDoc(params.id)
  if (!doc) notFound()

  return (
    <main className="min-h-screen bg-black text-neutral-200 px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-10 text-sm text-neutral-500">
          <Link href="/" className="hover:text-neutral-200">patchbay</Link>
          <span className="mx-2">/</span>
          <Link href="/docs" className="hover:text-neutral-200">docs</Link>
          <span className="mx-2">/</span>
          <span className="text-neutral-300 font-mono">{doc.id}</span>
        </nav>

        <div className="flex items-center gap-3 mb-4">
          <span className={`inline-block rounded border px-2 py-0.5 text-xs font-mono ${SEV_COLOR[doc.severity]}`}>
            {doc.severity}
          </span>
          <span className="font-mono text-xs text-neutral-500">{doc.id.toUpperCase()}</span>
        </div>
        <h1 className="text-3xl font-semibold text-white mb-6">{doc.title}</h1>

        <p className="text-neutral-300 text-lg mb-10">{doc.oneLiner}</p>

        <section className="mb-10">
          <h2 className="text-sm uppercase tracking-wide text-neutral-500 mb-3">What it means</h2>
          <p className="text-neutral-300 whitespace-pre-line leading-relaxed">{doc.whatItMeans}</p>
        </section>

        <section className="mb-10">
          <h2 className="text-sm uppercase tracking-wide text-neutral-500 mb-3">How to fix</h2>
          <p className="text-neutral-300 whitespace-pre-line leading-relaxed">{doc.howToFix}</p>
        </section>

        {doc.spec && (
          <section className="mb-10">
            <h2 className="text-sm uppercase tracking-wide text-neutral-500 mb-3">Spec</h2>
            {doc.specUrl ? (
              <a href={doc.specUrl} target="_blank" rel="noopener noreferrer" className="text-neutral-200 hover:text-white underline-offset-4 hover:underline">
                {doc.spec}
              </a>
            ) : (
              <span className="text-neutral-300">{doc.spec}</span>
            )}
          </section>
        )}

        <section className="border-t border-neutral-900 pt-8 mt-16">
          <p className="text-sm text-neutral-500">
            Run the check against your own server:
          </p>
          <pre className="mt-3 rounded border border-neutral-800 bg-neutral-950 p-4 text-sm overflow-x-auto">
            <code>npx -y @patchbay-nebius/agent audit &lt;url-or-directory&gt;</code>
          </pre>
          <p className="mt-6 text-sm text-neutral-500">
            Disagree with this finding on your server?{' '}
            <a href="https://github.com/GodSmasher/patchbay/issues" target="_blank" rel="noopener noreferrer" className="text-neutral-300 hover:text-white underline-offset-4 hover:underline">
              Open an issue
            </a>{' '}
            with the --json output. False-positive reports are the most useful feedback.
          </p>
        </section>
      </div>
    </main>
  )
}

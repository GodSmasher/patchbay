import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SubscribeBox } from '@/components/subscribe-box'
import { DOCS, getDoc, type Severity } from '../_data'

export function generateStaticParams() {
  return DOCS.map((d) => ({ id: d.id }))
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const doc = getDoc(params.id)
  if (!doc) return { title: 'Not found' }
  return {
    title: `${doc.title} (${doc.id.toUpperCase()}) · MCP security check · patchbay`,
    description: doc.oneLiner,
    alternates: { canonical: `/docs/${doc.id}` },
  }
}

// Checks that have a longer write-up on the blog.
const WRITE_UPS: Record<string, { slug: string; title: string }> = {
  'auth-003': { slug: 'mcp-pkce-missing-from-oauth-metadata', title: 'MCP clients refuse to log in when PKCE is missing from your OAuth metadata' },
  'auth-005': { slug: 'mcp-dynamic-client-registration-missing', title: 'MCP server without a registration_endpoint: why clients cannot connect and how to fix it' },
  'auth-006': { slug: 'mcp-oauth-login-hangs-loopback-redirect', title: 'Why MCP OAuth login hangs after you click Allow and how to fix it' },
  'audience-001': { slug: 'mcp-token-audience-validation', title: 'Audience validation for MCP servers' },
  'manifest-001': { slug: 'mcp-tools-change-after-approval', title: 'An MCP server can change its tools after you approved it' },
}

const SEV_COLOR: Record<Severity, string> = {
  critical: 'bg-warn-soft text-warn border-warn/30',
  high: 'bg-warn-soft text-warn border-warn/30',
  medium: 'bg-warn-soft text-warn border-warn/30',
  low: 'bg-neutral-500/10 text-ink-mute border-neutral-500/30',
  info: 'bg-neutral-500/10 text-ink-mute border-neutral-500/30',
}

export default function DocPage({ params }: { params: { id: string } }) {
  const doc = getDoc(params.id)
  if (!doc) notFound()
  const writeUp = WRITE_UPS[doc.id]

  return (
    <main className="min-h-screen bg-paper text-ink px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-10 text-sm text-ink-mute">
          <Link href="/scan" className="hover:text-ink">patchbay</Link>
          <span className="mx-2">/</span>
          <Link href="/docs" className="hover:text-ink">docs</Link>
          <span className="mx-2">/</span>
          <span className="text-ink-soft font-mono">{doc.id}</span>
        </nav>

        <div className="flex items-center gap-3 mb-4">
          <span className={`inline-block rounded border px-2 py-0.5 text-xs font-mono ${SEV_COLOR[doc.severity]}`}>
            {doc.severity}
          </span>
          <span className="font-mono text-xs text-ink-mute">{doc.id.toUpperCase()}</span>
        </div>
        <h1 className="text-3xl font-semibold text-ink mb-6">{doc.title}</h1>

        <p className="text-ink-soft text-lg mb-10">{doc.oneLiner}</p>

        <section className="mb-10">
          <h2 className="text-sm uppercase tracking-wide text-ink-mute mb-3">What it means</h2>
          <p className="text-ink-soft whitespace-pre-line leading-relaxed">{doc.whatItMeans}</p>
        </section>

        <section className="mb-10">
          <h2 className="text-sm uppercase tracking-wide text-ink-mute mb-3">How to fix</h2>
          <p className="text-ink-soft whitespace-pre-line leading-relaxed">{doc.howToFix}</p>
        </section>

        {doc.spec && (
          <section className="mb-10">
            <h2 className="text-sm uppercase tracking-wide text-ink-mute mb-3">Spec</h2>
            {doc.specUrl ? (
              <a href={doc.specUrl} target="_blank" rel="noopener noreferrer" className="text-ink hover:text-ink underline-offset-4 hover:underline">
                {doc.spec}
              </a>
            ) : (
              <span className="text-ink-soft">{doc.spec}</span>
            )}
          </section>
        )}

        {writeUp && (
          <section className="mb-10">
            <h2 className="text-sm uppercase tracking-wide text-ink-mute mb-3">Background</h2>
            <Link href={`/blog/${writeUp.slug}`} className="text-ink underline underline-offset-4 hover:text-ink">
              {writeUp.title}
            </Link>
          </section>
        )}

        <section className="border-t border-paper-line pt-8 mt-16">
          <p className="text-sm text-ink-mute">
            Run the check against your own server:
          </p>
          <pre className="mt-3 rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto">
            <code>npx -y @patchbay-nebius/agent audit &lt;url-or-directory&gt;</code>
          </pre>
          <p className="mt-4 text-sm text-ink-mute">
            No install:{' '}
            <Link href="/scan" className="text-ink-soft hover:text-ink underline-offset-4 hover:underline">
              scan an MCP server in the browser
            </Link>{' '}
            and get a shareable report.
          </p>
          <p className="mt-6 text-sm text-ink-mute">
            Disagree with this finding on your server?{' '}
            <a href="https://github.com/GodSmasher/patchbay/issues" target="_blank" rel="noopener noreferrer" className="text-ink-soft hover:text-ink underline-offset-4 hover:underline">
              Open an issue
            </a>{' '}
            with the --json output. False-positive reports are the most useful feedback.
          </p>
        </section>

        <SubscribeBox page={`/docs/${doc.id}`} />
      </div>
    </main>
  )
}

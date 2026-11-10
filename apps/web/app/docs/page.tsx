import type { Metadata } from 'next'
import Link from 'next/link'
import { DOCS, type Severity } from './_data'

export const metadata: Metadata = {
  title: 'MCP server security checks: findings reference · patchbay audit',
  description: 'What each patchbay audit finding means, why it fires, and how to fix it: OAuth 2.1, PKCE, scopes, secrets, transport and redirect checks for MCP servers.',
  alternates: { canonical: '/docs' },
}

const SEV_COLOR: Record<Severity, string> = {
  critical: 'text-red-500',
  high: 'text-warn',
  medium: 'text-warn',
  low: 'text-ink-mute',
  info: 'text-ink-mute',
}

const SEV_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }

export default function DocsIndex() {
  const sorted = [...DOCS].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.id.localeCompare(b.id))
  return (
    <main className="min-h-screen bg-paper text-ink px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-10 text-sm text-ink-mute">
          <Link href="/" className="hover:text-ink">patchbay</Link>
          <span className="mx-2">/</span>
          <span className="text-ink-soft">docs</span>
        </nav>

        <h1 className="text-3xl font-semibold text-ink mb-4">patchbay audit findings</h1>
        <p className="text-ink-mute mb-10">
          Every finding patchbay surfaces has an id. This page explains what each one means,
          when it fires, and how to fix it. The scanner is in <code className="text-ink">packages/audit-core</code>.
        </p>

        <div className="rounded border border-paper-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-paper-line text-ink-mute text-left">
                <th className="px-4 py-3 font-normal">ID</th>
                <th className="px-4 py-3 font-normal">Severity</th>
                <th className="px-4 py-3 font-normal">What it catches</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => (
                <tr key={d.id} className="border-b border-paper-line last:border-0 hover:bg-paper">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link href={`/docs/${d.id}`} className="text-ink hover:text-ink underline-offset-4 hover:underline">
                      {d.id.toUpperCase()}
                    </Link>
                  </td>
                  <td className={`px-4 py-3 ${SEV_COLOR[d.severity]} text-xs`}>{d.severity}</td>
                  <td className="px-4 py-3 text-ink-soft">{d.oneLiner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-10 text-sm text-ink-mute">
          Run the auditor:{' '}
          <code className="text-ink">npx -y @patchbay-nebius/agent audit &lt;url-or-directory&gt;</code>
        </p>
      </div>
    </main>
  )
}

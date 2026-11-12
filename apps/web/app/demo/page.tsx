import type { Metadata } from 'next'
import Link from 'next/link'

export const runtime = 'nodejs'
export const revalidate = 3600

const TITLE = 'patchbay demo MCP server · intentionally vulnerable'
const DESCRIPTION =
  'A live MCP server we host for demo scans. Every bug here is on purpose, so you can run patchbay audit against a URL and see what each finding looks like without pointing the tool at a real third-party server.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: true, follow: true },
  alternates: { canonical: '/demo' },
}

export default function DemoPage() {
  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'ui-sans-serif, system-ui, sans-serif', lineHeight: 1.55 }}>
      <nav style={{ marginBottom: '1.5rem' }}>
        <Link href="/" style={{ color: '#6366f1' }}>← patchbay</Link>
      </nav>

      <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>Demo MCP server</h1>
      <p style={{ color: '#6b7280', margin: '0 0 1.25rem' }}>
        Intentionally vulnerable. Scan it to see what each finding looks like.
      </p>

      <section style={{ padding: '1rem', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, marginBottom: '1.5rem' }}>
        <strong>Do not point real clients at this.</strong> The <code>/authorize</code> endpoint accepts any <code>redirect_uri</code> and hands back fake tokens. It exists so <code>patchbay audit</code> has something safe to demonstrate findings against without probing third-party servers.
      </section>

      <h2 style={{ fontSize: '1.25rem', marginTop: '1.5rem' }}>Try it</h2>
      <pre style={{ background: '#f3f4f6', padding: '0.75rem 1rem', borderRadius: 6, overflowX: 'auto', fontSize: '0.9rem' }}>
{`npx -y @patchbay-nebius/agent audit https://patchbay-mcp.dev/demo/mcp
# or with the opt-in headless OAuth battery:
npx -y @patchbay-nebius/agent audit https://patchbay-mcp.dev/demo/mcp --probe-headless-oauth`}
      </pre>

      <h2 style={{ fontSize: '1.25rem', marginTop: '1.5rem' }}>Bugs this server ships on purpose</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '0.5rem 0.25rem' }}>Check</th>
            <th style={{ padding: '0.5rem 0.25rem' }}>What&apos;s wrong</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid #f3f4f6' }}><td style={{ padding: '0.4rem 0.25rem' }}><code>AUTH-001</code></td><td style={{ padding: '0.4rem 0.25rem' }}><code>tools/list</code> succeeds without credentials</td></tr>
          <tr style={{ borderBottom: '1px solid #f3f4f6' }}><td style={{ padding: '0.4rem 0.25rem' }}><code>AUTH-003</code></td><td style={{ padding: '0.4rem 0.25rem' }}>OAuth metadata lists only <code>plain</code> PKCE, no S256</td></tr>
          <tr style={{ borderBottom: '1px solid #f3f4f6' }}><td style={{ padding: '0.4rem 0.25rem' }}><code>AUTH-005</code></td><td style={{ padding: '0.4rem 0.25rem' }}>No CIMD, no DCR registration endpoint</td></tr>
          <tr style={{ borderBottom: '1px solid #f3f4f6' }}><td style={{ padding: '0.4rem 0.25rem' }}><code>RESOURCE-001</code></td><td style={{ padding: '0.4rem 0.25rem' }}>Protected Resource Metadata missing <code>authorization_servers</code></td></tr>
          <tr style={{ borderBottom: '1px solid #f3f4f6' }}><td style={{ padding: '0.4rem 0.25rem' }}><code>SCOPE-001</code></td><td style={{ padding: '0.4rem 0.25rem' }}>Every tool uses one scope (<code>read</code>)</td></tr>
          <tr style={{ borderBottom: '1px solid #f3f4f6' }}><td style={{ padding: '0.4rem 0.25rem' }}><code>SCOPE-002</code></td><td style={{ padding: '0.4rem 0.25rem' }}><code>delete_everything</code> shares scope with reads</td></tr>
          <tr style={{ borderBottom: '1px solid #f3f4f6' }}><td style={{ padding: '0.4rem 0.25rem' }}><code>HEADERS-001</code></td><td style={{ padding: '0.4rem 0.25rem' }}>Wildcard CORS with credentials, no HSTS, no X-Frame, no nosniff</td></tr>
          <tr style={{ borderBottom: '1px solid #f3f4f6' }}><td style={{ padding: '0.4rem 0.25rem' }}><code>POISONING-001</code></td><td style={{ padding: '0.4rem 0.25rem' }}>Zero-width Unicode and <code>&lt;SYSTEM&gt;</code> marker in a tool description</td></tr>
          <tr style={{ borderBottom: '1px solid #f3f4f6' }}><td style={{ padding: '0.4rem 0.25rem' }}><code>ISS-001</code></td><td style={{ padding: '0.4rem 0.25rem' }}><code>authorization_response_iss_parameter_supported: false</code></td></tr>
          <tr style={{ borderBottom: '1px solid #f3f4f6' }}><td style={{ padding: '0.4rem 0.25rem' }}><code>PKCE-001</code></td><td style={{ padding: '0.4rem 0.25rem' }}><code>/authorize</code> issues a code with no <code>code_challenge</code> (opt-in probe)</td></tr>
          <tr style={{ borderBottom: '1px solid #f3f4f6' }}><td style={{ padding: '0.4rem 0.25rem' }}><code>PKCE-002</code></td><td style={{ padding: '0.4rem 0.25rem' }}>Plain PKCE accepted (opt-in probe)</td></tr>
          <tr style={{ borderBottom: '1px solid #f3f4f6' }}><td style={{ padding: '0.4rem 0.25rem' }}><code>IMPLICIT-001</code></td><td style={{ padding: '0.4rem 0.25rem' }}><code>response_type=token</code> honoured (opt-in probe)</td></tr>
          <tr><td style={{ padding: '0.4rem 0.25rem' }}><code>REDIRECT-002</code></td><td style={{ padding: '0.4rem 0.25rem' }}>Unregistered <code>redirect_uri</code> accepted (opt-in probe)</td></tr>
        </tbody>
      </table>

      <h2 style={{ fontSize: '1.25rem', marginTop: '1.5rem' }}>Endpoints</h2>
      <ul>
        <li><code>/demo/mcp</code> — MCP endpoint (POST JSON-RPC, GET info)</li>
        <li><code>/demo/.well-known/oauth-authorization-server</code> — AS metadata</li>
        <li><code>/demo/.well-known/oauth-protected-resource</code> — PRM</li>
        <li><code>/demo/authorize</code> — crafted-request-accepting auth endpoint</li>
        <li><code>/demo/token</code> — fake token endpoint</li>
      </ul>

      <p style={{ marginTop: '2rem', color: '#6b7280', fontSize: '0.9rem' }}>
        Source lives in <code>apps/web/app/demo</code> in the patchbay repo. Every bug is annotated with the check ID it triggers.
      </p>
    </main>
  )
}

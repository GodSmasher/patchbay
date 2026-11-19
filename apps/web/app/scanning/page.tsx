import Link from 'next/link'

export const metadata = {
  title: 'Scanning methodology · patchbay',
  description: 'What patchbay scans on public MCP servers, how, and what we never do without consent.',
}

export default function ScanningPage() {
  return (
    <main className="min-h-screen bg-paper text-ink px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <nav className="mb-10 text-sm text-ink-mute">
          <Link href="/scan" className="hover:text-ink">patchbay</Link>
          <span className="mx-2">/</span>
          <span className="text-ink">scanning</span>
        </nav>

        <h1 className="text-3xl font-semibold text-ink mb-2">How patchbay scans public MCP servers</h1>
        <p className="text-ink-mute text-sm mb-10">Last updated 2026-11-19.</p>

        <section className="space-y-8 text-ink-soft">
          <p>
            patchbay runs a passive security auditor against public Model Context Protocol (MCP) servers. This page
            explains what we scan, how we scan it, and what we never do without consent.
          </p>

          <div>
            <h2 className="text-xl font-semibold text-ink mb-3">What we scan</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>OAuth 2.1 Authorization Server Metadata (RFC 8414): <code>/.well-known/oauth-authorization-server</code></li>
              <li>Protected Resource Metadata (RFC 9728): <code>/.well-known/oauth-protected-resource</code></li>
              <li>MCP <code>tools/list</code>, <code>resources/list</code>, <code>prompts/list</code> via the MCP JSON-RPC endpoint, without authenticated calls</li>
              <li>Transport-security headers on discovery endpoints (HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Content-Security-Policy)</li>
              <li>TLS certificate metadata read from the TLS handshake</li>
            </ul>
            <p className="mt-3">
              We read only what a browser or a casual integrator would see. We follow the host&apos;s <code>robots.txt</code> if
              present. Scanner timeout per host is 30 seconds. Rate limit per host is 1 request per second.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink mb-3">What we never do</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>We never call authenticated tools.</li>
              <li>We never attempt credential enumeration, brute-force, or fuzzing.</li>
              <li>We never upload or infer private data.</li>
              <li>We never store request payloads beyond what is needed to produce a finding record.</li>
              <li>We never retain scan traffic longer than 30 days.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink mb-3">How findings are labeled</h2>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>source-confirmed</strong> — we observed the issue directly in a response the server returned to us. Reproducible with curl.</li>
              <li><strong>runtime-verified</strong> — we observed a behaviour across repeated requests that confirms the condition.</li>
              <li><strong>potential-fp</strong> — the signal is present but the context is ambiguous. Marked as such.</li>
            </ul>
            <p className="mt-3">No finding is ever presented as a confirmed exploit. A finding is a signal to check.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink mb-3">Public scope</h2>
            <p>
              Our scan set includes public MCP server hosts that are listed on the public MCP registry, linked from a
              published Protected Resource Metadata document, or added via public submission.
            </p>
            <p className="mt-3">
              If your server is listed and you want it removed from the public scan set, email{' '}
              <a href="mailto:sarah@patchbay-mcp.dev" className="underline">sarah@patchbay-mcp.dev</a> with the host name
              and a brief statement that you are the operator. We will remove it within 48 hours. We publish a
              withdrawn set for retracted hosts so the public history stays honest.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink mb-3">Why this is lawful</h2>
            <p>
              We scan only public endpoints the host advertises for discovery or that are explicitly made available.
              We do not bypass authentication. We do not exceed what a casual integrator checking compatibility would
              do. Our legitimate interest basis under GDPR Article 6(1)(f) is documented at{' '}
              <Link href="/legitimate-interest-assessment" className="underline">/legitimate-interest-assessment</Link>.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink mb-3">Contact</h2>
            <p>
              <a href="mailto:sarah@patchbay-mcp.dev" className="underline">sarah@patchbay-mcp.dev</a>
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}

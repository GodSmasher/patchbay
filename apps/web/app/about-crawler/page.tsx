import type { Metadata } from 'next'
import Link from 'next/link'

export const runtime = 'nodejs'
export const revalidate = 3600

const TITLE = 'About the patchbay MCP crawler'
const DESCRIPTION =
  'patchbay-crawler scans every public MCP server listed in the official registry without authenticating against any third-party host. This page documents what the crawler does, what it never does, and how operators can opt out or claim their listing.'

export const metadata: Metadata = {
  title: TITLE + ' · patchbay',
  description: DESCRIPTION,
  alternates: { canonical: '/about-crawler' },
  robots: { index: true, follow: true },
}

export default function AboutCrawlerPage() {
  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'ui-sans-serif, system-ui, sans-serif', lineHeight: 1.6 }}>
      <nav style={{ marginBottom: '1.5rem' }}>
        <Link href="/leaderboard" style={{ color: '#6366f1' }}>← Leaderboard</Link>
      </nav>

      <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>About the patchbay crawler</h1>
      <p style={{ color: '#6b7280', margin: '0 0 1.5rem' }}>
        Who we are, what we send, and how to opt out.
      </p>

      <section>
        <h2 style={{ fontSize: '1.15rem' }}>What it is</h2>
        <p>
          The patchbay crawler (<code>User-Agent: patchbay-crawler/0.9.0 (+https://patchbay-mcp.dev/about-crawler)</code>) is a scheduled job that audits the public security posture of MCP servers listed in the <a href="https://registry.modelcontextprotocol.io" target="_blank" rel="noopener noreferrer">official MCP Registry</a>. The results feed the <Link href="/leaderboard">public leaderboard</Link>. Operators can opt out of live-URL probing at any time (see below) and their entries will still be graded from static source analysis of their public repository when one is linked in the registry.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: '1.15rem' }}>What the crawler sends</h2>
        <p>Against each registered MCP server URL, the live tier sends only requests that a spec-compliant unauthenticated MCP client would send on first contact:</p>
        <ul>
          <li><code>GET /.well-known/oauth-protected-resource</code> — public RFC 9728 metadata document.</li>
          <li><code>GET /.well-known/oauth-authorization-server</code> — public RFC 8414 metadata document.</li>
          <li><code>HEAD</code> and one <code>GET</code> on the MCP endpoint itself, reading only response headers.</li>
          <li>One unauthenticated <code>POST initialize</code> to classify transport and auth posture. The crawler stops here: it never sends <code>tools/list</code>, <code>tools/call</code>, DCR writes, or crafted <code>/authorize</code> requests to a server it does not own.</li>
        </ul>
        <p>The source tier operates entirely on a shallow clone of the <code>repository.url</code> listed in the registry, never on the server itself.</p>
      </section>

      <section>
        <h2 style={{ fontSize: '1.15rem' }}>What the crawler never does</h2>
        <ul>
          <li>No authentication attempts against third-party servers. No bearer tokens, no API keys, no OAuth login flows, no password guesses.</li>
          <li>No DCR writes or crafted <code>/authorize</code> requests. Those live only in our own demo server at <a href="https://demo.patchbay-mcp.dev">demo.patchbay-mcp.dev</a>.</li>
          <li>No <code>tools/call</code>. We never execute a single tool.</li>
          <li>No circumvention of login walls. A 401 is respected and recorded as "authentication required", nothing more.</li>
        </ul>
      </section>

      <section>
        <h2 style={{ fontSize: '1.15rem' }}>Rate and cadence</h2>
        <ul>
          <li>Maximum 2 requests per second per host, 10 requests per second across the entire crawl.</li>
          <li>Each host gets at most ~5 requests per weekly crawl.</li>
          <li><code>robots.txt</code> is honoured. A <code>Disallow: /.well-known/</code> in your robots file is treated as an opt-out and the live tier will skip your host.</li>
        </ul>
      </section>

      <section>
        <h2 style={{ fontSize: '1.15rem' }}>Opt-out</h2>
        <p>Email <a href="mailto:crawler-opt-out@patchbay-mcp.dev">crawler-opt-out@patchbay-mcp.dev</a> from an address on the same domain as the MCP endpoint, or add a <code>Disallow: /.well-known/</code> rule for <code>patchbay-crawler</code> in your <code>robots.txt</code>. Your live-URL probe will stop within 48 hours and will not resume unless you explicitly request it. Static source grading from your public repository continues unless you remove the repository from the registry.</p>
      </section>

      <section>
        <h2 style={{ fontSize: '1.15rem' }}>Claim your listing</h2>
        <p>Operators can claim their listing to get an "operator verified" badge and opt into authenticated scans (which cover the five checks the public crawler cannot reach). Verify ownership with a DNS TXT record <code>_patchbay=operator:&lt;your-email&gt;</code> on the MCP endpoint's domain, or a file at <code>/.well-known/patchbay-ownership.txt</code> served from the same origin as the MCP endpoint.</p>
      </section>

      <section style={{ marginTop: '2rem', padding: '1rem', background: '#f9fafb', borderRadius: 8, fontSize: '0.9rem', color: '#4b5563' }}>
        <strong>Contact:</strong> <a href="mailto:hello@patchbay-mcp.dev">hello@patchbay-mcp.dev</a> ·
        <strong style={{ marginLeft: '0.5rem' }}>Opt-out:</strong> <a href="mailto:crawler-opt-out@patchbay-mcp.dev">crawler-opt-out@patchbay-mcp.dev</a> ·
        <strong style={{ marginLeft: '0.5rem' }}>Source:</strong> <a href="https://github.com/GodSmasher/patchbay" target="_blank" rel="noopener noreferrer">github.com/GodSmasher/patchbay</a>
      </section>
    </main>
  )
}

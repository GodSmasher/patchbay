import Link from 'next/link'

const A = 'text-ink underline underline-offset-4 hover:text-ink'
const H2 = 'text-xl font-semibold text-ink mt-12 mb-4'
const PRE = 'rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto my-4'

export function WhatAWellConfiguredMcpServerLooksLike() {
  return (
    <>
      <p>
        Most of what we publish on this blog is what went wrong — the DCR open redirect, the
        missing PKCE, the tool-description poisoning. That bias is real: patchbay exists to find
        gaps, so the content follows.
      </p>
      <p>
        Today a counter-example. Angelcam, the camera-stream platform at{' '}
        <a href="https://angelcam.com/" className={A}>angelcam.com</a>, shipped an MCP read-only
        server — <code>mcp.angelcam.com/readonly</code> — that lets AI assistants ask questions
        about your cameras and take snapshots on a schedule. A full patchbay scan returned two
        medium findings, both defence-in-depth, zero criticals and zero highs.
      </p>
      <p>
        Here is what that posture looks like, and the two places where even a well-configured
        server can tighten.
      </p>

      <h2 className={H2}>What we ran</h2>
      <pre className={PRE}>
{`npx -y @patchbay-nebius/agent audit https://mcp.angelcam.com/readonly`}
      </pre>
      <p>Read-only. No credentials. Standard public scan.</p>

      <h2 className={H2}>What came back clean</h2>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li><strong>AUTH-001</strong> — <code>tools/list</code> is auth-walled. No destructive tool reachable without authentication.</li>
        <li><strong>AUTH-002</strong> — OAuth 2.1 discovery served. No static-key fallback.</li>
        <li><strong>AUTH-003</strong> — PKCE S256 advertised.</li>
        <li><strong>AUTH-005</strong> — CIMD is advertised, not just DCR.</li>
        <li><strong>AUTH-007</strong> — Invalid bearer returns 401 per MCP 2026-07-28.</li>
        <li><strong>RESOURCE-001</strong> — <code>/.well-known/oauth-protected-resource</code> served with <code>authorization_servers</code> populated.</li>
        <li><strong>DUAL-RESOURCE-001</strong> — Our newest check: the WWW-Authenticate challenge and the well-known PRM document agree on the authorization server. No split-brain.</li>
        <li><strong>SCOPE-001 / SCOPE-002</strong> — Scopes declared. The readonly endpoint has no destructive tools at all — that is the right design for an AI-accessible camera view.</li>
        <li><strong>POISONING-001</strong> — Tool descriptions are clean. No zero-width characters, no hidden <code>&lt;SYSTEM&gt;</code> directives.</li>
        <li><strong>TRANSPORT-001</strong> — HTTPS only.</li>
      </ul>
      <p>
        The OAuth posture here is the shape you want when a human sign-in flow is genuinely
        gating access to private data: you sign in on Angelcam&apos;s own page, so your password
        never reaches the AI assistant.
      </p>

      <h2 className={H2}>Finding 1 — HEADERS-001 (medium)</h2>
      <p>Two transport-security header gaps on the first reachable response:</p>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li>No <code>X-Frame-Options</code> and no <code>frame-ancestors</code> directive in Content-Security-Policy. The response can be framed cross-origin.</li>
        <li><code>X-Content-Type-Options</code> is not <code>nosniff</code>. Error responses may be MIME-sniffed by the browser.</li>
      </ul>
      <p>
        Neither of these can be exploited to reach the OAuth-gated data. Both are belt-and-braces
        hardening. The fix is one line each:
      </p>
      <pre className={PRE}>
{`X-Frame-Options: DENY
X-Content-Type-Options: nosniff`}
      </pre>

      <h2 className={H2}>Finding 2 — IDENTITY-001 (medium)</h2>
      <p>
        The authorization server&apos;s metadata lists <code>authorization_code</code> and{' '}
        <code>refresh_token</code> under <code>grant_types_supported</code>, but not{' '}
        <a href="https://datatracker.ietf.org/doc/html/rfc8693" className={A}>RFC 8693</a> token
        exchange (<code>urn:ietf:params:oauth:grant-type:token-exchange</code>).
      </p>
      <p>
        Why this matters when an AI assistant is the client: without token exchange, every{' '}
        <code>tools/call</code> from the assistant carries only the assistant&apos;s identity — not
        the end user&apos;s. For a camera view this is mostly a loss of audit causality (who asked
        which question?) rather than an escalation path. For higher-stakes resources, it is both.
      </p>
      <p>
        Adding token exchange at the AS plus implementing RFC 8693 at the token endpoint lets the
        assistant exchange its own access token plus a user assertion for a token whose{' '}
        <code>sub</code> identifies the end user.
      </p>

      <h2 className={H2}>Why this post</h2>
      <p>
        Our content leans heavy on teardowns because defects make the specific points stick. But
        servers that get it right exist, and the right way to report them is the same discipline:
        name the thing, run the scan, show what fired and what did not, and point at the fixable
        parts without pretending the whole thing is broken.
      </p>
      <p>
        Angelcam ships a camera-platform with a native MCP endpoint and an OAuth story that
        matches the MCP 2026-07-28 revision. The two findings above are worth patching. They do
        not take anything away from the rest of the posture.
      </p>

      <h2 className={H2}>Run it yourself</h2>
      <pre className={PRE}>
{`npx -y @patchbay-nebius/agent audit <your-mcp-url>`}
      </pre>
      <p>
        Live leaderboard at{' '}
        <Link href="/leaderboard" className={A}>patchbay-mcp.dev/leaderboard</Link>. Audit code at{' '}
        <a href="https://github.com/GodSmasher/patchbay" className={A}>github.com/GodSmasher/patchbay</a>.
      </p>
    </>
  )
}

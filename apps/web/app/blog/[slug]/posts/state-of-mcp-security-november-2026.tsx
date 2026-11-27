import Link from 'next/link'

const A = 'text-ink underline underline-offset-4 hover:text-ink'
const H2 = 'text-xl font-semibold text-ink mt-12 mb-4'
const PRE = 'rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto my-4'

export function StateOfMcpSecurityNovember2026() {
  return (
    <>
      <p>
        6,225 public MCP endpoints scanned so far. This is the first wave. New sources get
        crawled weekly and the cohort keeps growing. Here&apos;s what the current snapshot looks
        like.
      </p>

      <p>Of those 6,225:</p>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li><strong>4,998 grade D or F</strong> on OAuth 2.1 posture (80.3%)</li>
        <li><strong>555 critical</strong>: heavy-write tools exposed without any authentication required</li>
        <li><strong>2,228 high</strong>: OAuth misconfigurations that block compliant clients from authenticating</li>
        <li><strong>11,276 medium</strong>: transport, headers, metadata, poisoning patterns</li>
        <li><strong>633 grade A</strong>, 342 B, 252 C</li>
      </ul>

      <p>
        The leaderboard breakdown is live at{' '}
        <Link href="/leaderboard" className={A}>patchbay-mcp.dev/leaderboard</Link>, re-crawled
        weekly.
      </p>

      <h2 className={H2}>how we got to 6,225</h2>
      <p>
        The cohort came from three sources: the official MCP registry at{' '}
        <code>registry.modelcontextprotocol.io</code>, GitHub code-search for imports of{' '}
        <code>@modelcontextprotocol/*</code> packages, and public sitemaps from MCP directories.
      </p>
      <p>
        Initial pass pulled over 6,800 reachable endpoints. After tightening the reachability
        check to require a valid JSON-RPC <code>protocolVersion</code> response (not just any
        HTTP 200), 452 non-MCP hosts dropped out. CDN pages, chat SaaS products hosting their
        sites on <code>mcp.*</code> subdomains, generic error-returning endpoints that happened
        to respond. The final number is what passed strict MCP-protocol validation.
      </p>
      <p>
        I&apos;m publishing this correction openly because the scanner was too loose before the
        fix. Anyone who caught a cached screenshot of the 6,800 figure in the last 48 hours:{' '}
        <strong>6,225 is the honest number</strong>.
      </p>

      <h2 className={H2}>the 555 critical findings</h2>
      <p>
        AUTH-001 fires when a server exposes tools whose names match heavy-write verbs (
        <code>delete</code>, <code>send</code>, <code>transfer</code>, <code>create</code>,{' '}
        <code>update</code>, <code>revoke</code>, <code>approve</code>, <code>archive</code>,{' '}
        <code>deploy</code>, <code>publish</code>, and ~15 others) via <code>tools/list</code>{' '}
        without requiring OAuth bearer authentication.
      </p>
      <p>
        For the critical bucket, I kept only tools matching heavy-write verbs with actual
        state-mutation semantics. Tools exposed intentionally public (SDK docs, scaffolding
        helpers, read-only guidance) are excluded. A separate severity matrix downgrades those to
        high (scaffolding-only mutation) or info (read-only).
      </p>
      <p>
        The pattern across the 555: a client with no credentials can call tools that would, if
        executed, mutate state the operator cares about. Whether that state is a database row,
        an outbound email, a transfer of funds, or a published artifact depends on the tool.
      </p>

      <h2 className={H2}>what fails most often in the D/F bucket</h2>
      <p>Three patterns show up on nearly every failing server:</p>
      <ol className="list-decimal list-inside space-y-3 my-4 text-ink-soft">
        <li>
          <strong>No Protected Resource Metadata document.</strong>{' '}
          <code>/.well-known/oauth-protected-resource</code> is mandatory per the MCP
          Authorization spec (July 2026 revision, following RFC 9728 which became required in
          mid-2025). Without it, compliant MCP clients can&apos;t discover which authorization
          server issues tokens for the resource.
        </li>
        <li>
          <strong>PKCE S256 not advertised.</strong>{' '}
          <code>code_challenge_methods_supported</code> missing from{' '}
          <code>/.well-known/oauth-authorization-server</code>. Even if the server enforces PKCE
          S256 at runtime, spec-compliant clients refuse to proceed because the discovery
          metadata doesn&apos;t advertise support.
        </li>
        <li>
          <strong>Dynamic Client Registration without the modern replacement.</strong> Server
          advertises <code>registration_endpoint</code> (RFC 7591 DCR) but doesn&apos;t advertise{' '}
          <code>client_id_metadata_document_supported</code>. The July 2026 spec deprecated DCR
          in favor of OAuth Client ID Metadata Documents (CIMD). Many servers haven&apos;t
          migrated.
        </li>
      </ol>
      <p>
        Each of these is a 10-100 line config fix on most OAuth stacks (Auth0, Clerk, WorkOS,
        Keycloak, raw Express/Fastify). None of them are hard problems. They&apos;re
        deploy-and-forget problems.
      </p>

      <h2 className={H2}>what I&apos;m deliberately not publishing</h2>
      <p>
        A handful of the initial scan&apos;s critical findings landed on vendor-brand subdomains.
        Some genuine, some mislabeled. One concrete example: a subdomain on a known security
        vendor&apos;s apex domain turned out to host a restaurant-management demo, not the
        vendor&apos;s actual product. The server&apos;s <code>serverInfo.name</code> field
        returned <code>restaurant-api</code>, the tools were <code>list_restaurants</code> and{' '}
        <code>get_menu</code>, not anything resembling observability or security tooling. If
        we&apos;d published that finding under the vendor&apos;s name, the story would have been
        the mislabel, not the security posture.
      </p>
      <p>
        Before any named-vendor publication, we re-verify the server actually belongs to the
        vendor via <code>serverInfo.name</code>, <code>websiteUrl</code>, and corroborating
        signals. Anything still ambiguous stays on the public leaderboard under the host slug,
        but doesn&apos;t get named-callout attention.
      </p>
      <p>
        For specific operators with real criticals, we send private notice first with a 90-day
        disclosure window. Standard security research practice. The current outreach is small
        and manual. Scaling that pipeline is Q1 2027 work.
      </p>

      <h2 className={H2}>what we&apos;re working on next</h2>
      <p>
        Current checks are mostly metadata-tier: they read what the server advertises and
        compare against spec requirements. That catches a lot. The 4,998 D/F bucket is real. But
        it misses behaviors where the server advertises correctly and misbehaves at runtime, or
        advertises conservatively and actually enforces strictly.
      </p>
      <p>
        Moving to behavioral-tier checks is the Q1 priority. First target: HEADERS-001 upgrades
        from presence-only to value-validation (<code>X-Frame-Options: ALLOWALL</code> currently
        passes the presence check, should fail because the value is broken). The same pattern
        applies to RESOURCE-001 (schema + authorization-server reachability), PKCE-001 (actual
        enforcement test, not just metadata), and AUTH-001 (behavioral verification with
        side-effect safeguards for destructive tools).
      </p>
      <p>Depth comes before pressure. We&apos;re not running a shaming operation.</p>

      <h2 className={H2}>comparison to adjacent ecosystems</h2>
      <p>
        If you&apos;ve been in API security for a while, the current MCP state looks like REST
        APIs circa 2015: the spec exists, early adopters implement it correctly, the long tail
        ships shortcuts that look fine until a scanner probes them. API security hardened over
        5-8 years driven by compliance frameworks (SOC2, PCI) and public breaches.
      </p>
      <p>
        MCP doesn&apos;t have either of those triggers yet. The public leaderboard was intended
        as a technical tool; it&apos;s becoming closer to the public scoreboard that eventually
        drove API compliance. Operators who show up at grade F start fixing within 1-2 weeks,
        without any legal or compliance pressure. Public visibility is doing the work.
      </p>

      <h2 className={H2}>what&apos;s shipping</h2>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li>
          <strong>Hosted v1</strong>, January 1, 2027. Scheduled rescans, drift alerts, grade
          history per endpoint, private-MCP scanning for teams who don&apos;t want their
          endpoints on a public leaderboard. Founding-100 plan: $149/year, limited to the first
          100 teams.
        </li>
        <li>
          <strong>HEADERS-001 depth upgrade</strong>, this week. Per-header value-validation,
          not just presence.
        </li>
        <li>
          <strong>Coordinated disclosure pipeline</strong>, Q1 2027. Automated 30/60/90-day
          disclosure clock for operators we&apos;ve notified, with public write-ups for
          non-responders after the window expires.
        </li>
      </ul>

      <h2 className={H2}>scan your own server</h2>
      <pre className={PRE}>{`npx -y @patchbay-nebius/agent audit https://your-server.example.com`}</pre>
      <p>
        Or paste a URL at <Link href="/audit" className={A}>patchbay-mcp.dev/audit</Link> for the
        browser version. The CLI is MIT-licensed, runs locally, no telemetry.
      </p>
      <p>GitHub Action for CI integration:</p>
      <pre className={PRE}>{`- uses: patchbay-security/patchbay-audit@v1
  with:
    url: https://your-mcp-server.example.com
    fail-on-grade: C`}</pre>
      <p>
        Methodology page with per-check specifications:{' '}
        <Link href="/docs" className={A}>patchbay-mcp.dev/docs</Link>.
      </p>
      <p>
        Questions, corrections, or methodology disagreements go to{' '}
        <a href="mailto:sarah@patchbay-mcp.dev" className={A}>sarah@patchbay-mcp.dev</a>. If I
        got something wrong about the check logic or a finding or a classification, I want to
        know before someone else notices.
      </p>

      <hr className="my-10 border-paper-line" />

      <p className="text-sm text-ink-soft">
        <strong>Changelog for this post:</strong> 2026-11-27 published. Cohort size 6,225 (prior
        draft had 6,348 before the reachability-check tightening dropped 452 non-MCP hosts).
      </p>
    </>
  )
}

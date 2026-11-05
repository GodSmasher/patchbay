export function StateOfMcpAuthNov2026() {
  return (
    <>
      <p>
        MCP (Model Context Protocol) has an auth story on paper: OAuth 2.1 with PKCE, dynamic client
        registration, resource indicators per RFC 8707. In practice I kept running into servers that
        were missing most of it. So I spent a week building <code>patchbay audit</code>, a free CLI
        that pokes an MCP server and reports what it finds. Then I pointed it at 25 public endpoints
        I could find.
      </p>
      <p>Here&apos;s what I learned.</p>

      <h2 className="text-xl font-semibold text-ink mt-12 mb-4">The numbers</h2>
      <p>
        25 servers scanned on 2026-11-02. All are publicly listed in community directories or vendor
        docs. The URL list is in{' '}
        <a href="https://github.com/GodSmasher/patchbay/blob/main/bench/mcp-sweep-targets.txt" className="text-ink underline underline-offset-4 hover:text-ink">
          bench/mcp-sweep-targets.txt
        </a>
        .
      </p>

      <div className="my-6 overflow-x-auto rounded border border-paper-line">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-neutral-900">
            <Row label="Reachable" value="20 / 25" />
            <Row label="Enforce authentication" value="12 / 25" />
            <Row label="Reachable + public (no auth)" value="8 / 20" />
            <Row label="Of those public: expose a mutating tool" value="2 / 8" emphasised />
            <Row label="Advertise OAuth 2.1 discovery metadata" value="2 / 20" />
            <Row label="Advertise resource_indicators_supported (RFC 8707)" value="2 / 20" />
            <Row label="Advertise PKCE S256 in code_challenge_methods_supported" value="2 / 20" />
          </tbody>
        </table>
      </div>

      <p>
        Three servers surfaced findings I thought were critical. All three got a responsible-disclosure
        email with a 90-day embargo before any public write-up names them. One of them (Chainflip&apos;s
        broker-as-a-service MCP) came back within hours with a link to their public AI documentation:
        the broker tools are intentionally no-auth because the actual value transfer is signed on-chain
        by the user, not initiated server-side. Public-by-design, documented, correctly scoped. So
        that one is off the critical list.
      </p>

      <h2 className="text-xl font-semibold text-ink mt-12 mb-4">The reachability problem nobody is talking about</h2>
      <p>
        Here is what actually happened with the other two critical findings: the emails bounced. Not
        a &quot;no such mailbox&quot; bounce, but Gmail&apos;s SMTP layer timing out against the
        vendor&apos;s own mail server for 48 hours straight. Three days later, still not delivered.
      </p>
      <p>
        I then went looking for any other way to reach them:
      </p>
      <ul className="list-disc list-inside space-y-1 my-4 text-ink-soft">
        <li>Neither vendor publishes a <code>/.well-known/security.txt</code>. Both return 404.</li>
        <li>Neither has a public <code>/contact</code> or <code>/about</code> page. Both return 404.</li>
        <li>Neither links a GitHub organisation, a LinkedIn, or a company X/Twitter from their homepage.</li>
        <li>Neither publishes a founder name I could track down.</li>
        <li>RDAP / WHOIS for both domains returns registry handles, no contact email. Privacy-protected by default.</li>
      </ul>
      <p>
        So the responsible-disclosure loop collapses at the first step: there is no one to tell. Both
        vendors ship a live MCP endpoint that accepts mutating tool calls without a credential, and
        neither has a channel that accepts a security report.
      </p>
      <p>
        I am going to keep the 90-day embargo running (public naming earliest Jan 31 2027) and try
        the remaining weak channels — contact forms if any JS-rendered page reveals one, abuse
        notifications to the registrar — but the actionable observation here is not about these two
        companies. It is about the MCP ecosystem: <strong>zero of 145 top MCP servers I scanned this
        week publish a security.txt.</strong> The spec does not require it. The registries that list
        them do not require it. So when a scanner finds something real, the finding has nowhere to go.
      </p>
      <p>
        This is why patchbay is a CLI first and a disclosure workflow second. The primary users are:
      </p>
      <ul className="list-disc list-inside space-y-1 my-4 text-ink-soft">
        <li>MCP server authors auditing their own server before it ships</li>
        <li>Security teams gating which MCPs their agents are allowed to call</li>
        <li>Everybody else who wants to see a report card before adding a server to their Claude Desktop config</li>
      </ul>
      <p>
        The shareable report URLs (<code>--publish</code> flag, landed in 0.4.0) are the escape
        hatch for when email disclosure fails: a public report page with a score badge the vendor
        eventually finds via their own brand monitoring, if not via responsible disclosure. Not
        ideal. Also the reality we are in.
      </p>
      <p>
      <p>
        Public-by-design servers like DeepWiki and Chainflip are now flagged as{' '}
        <em>info, public read-only or user-signed pattern</em> rather than critical. That distinction
        matters more than it sounds: the first version of my tool called DeepWiki &quot;critical no
        auth required&quot;, which would have made the whole post indefensible on day one. The
        Chainflip response is the second lesson: when a server links a <code>/.well-known/ai-catalog.json</code>{' '}
        or an AI-documentation page explicitly saying &quot;no auth required&quot;, the audit should
        read that first and downgrade.
      </p>

      <h2 className="text-xl font-semibold text-ink mt-12 mb-4">What the tool actually does</h2>
      <p>
        <code>patchbay audit &lt;url&gt;</code> runs 13 checks grouped roughly like this:
      </p>
      <h3 className="text-lg font-medium text-ink mt-6 mb-2">Auth presence (AUTH-001, AUTH-002)</h3>
      <p>
        Does the server accept <code>tools/list</code> without credentials? If yes, do any tool names
        look mutating (create / delete / send / execute / start-...)? Critical only when both are
        true. Public read-only servers are explicitly recognised as a legitimate pattern.
      </p>
      <h3 className="text-lg font-medium text-ink mt-6 mb-2">OAuth metadata completeness (AUTH-003 / 004 / 005)</h3>
      <p>
        If the server serves <code>/.well-known/oauth-authorization-server</code>, we read it and
        check for PKCE S256 advertisement, resource indicators, and a dynamic client registration
        endpoint. These are &quot;not advertised&quot; findings with confidence medium. A server
        can enforce the behaviour without exposing the metadata, so we only flag the metadata gap.
      </p>
      <h3 className="text-lg font-medium text-ink mt-6 mb-2">Scopes (SCOPE-001, SCOPE-002)</h3>
      <p>
        If the server advertises OAuth, do its tools declare per-tool scopes? Do write and read tools
        share a scope (so revoking write access also revokes reads)?
      </p>
      <h3 className="text-lg font-medium text-ink mt-6 mb-2">Secrets and transport</h3>
      <p>
        The directory-mode checks for hardcoded <code>sk-...</code> / <code>ghp_...</code> /{' '}
        <code>AKIA...</code> patterns in source files (skipping test fixtures and example patterns).
        Remote-mode checks whether the endpoint accepts plain HTTP, accepts a spoofed <code>Origin</code>{' '}
        header, and treats <code>localhost</code> consistently with <code>127.0.0.1</code> on the
        token endpoint.
      </p>
      <h3 className="text-lg font-medium text-ink mt-6 mb-2">Honest probe failures (PROBE-001)</h3>
      <p>
        If the probe can&apos;t learn anything (server is behind auth, uses an unknown transport, or
        just doesn&apos;t respond), we say so explicitly instead of returning &quot;0 findings, all
        clean&quot;. That silent-false-negative trap is a real risk when scanning diverse servers.
      </p>

      <p className="mt-6">
        The architecture is deliberately boring: <code>packages/audit-core</code> has zero I/O inside
        the check functions. Probing collects a <code>TargetSnapshot</code> object (what tools the
        server advertises, what headers it accepts, what&apos;s in its OAuth metadata, what secret
        regexes matched in a directory). Checks are <code>(snapshot) =&gt; Finding[]</code>. That
        makes them trivially unit-testable with fixture snapshots and lets me run them against a
        cached scan without re-probing the network.
      </p>

      <p>Run it like this:</p>
      <pre className="rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto my-4">
        <code>
{`npx -y @patchbay-nebius/agent audit https://mcp.example.com/mcp
npx -y @patchbay-nebius/agent audit ./my-mcp-server --json
npx -y @patchbay-nebius/agent audit ./my-mcp-server --sarif > out.sarif`}
        </code>
      </pre>
      <p>
        <code>--ci</code> makes it exit non-zero on critical / high so your GitHub Action fails the
        build.
      </p>

      <h2 className="text-xl font-semibold text-ink mt-12 mb-4">What I think is actually going on</h2>
      <p>
        The MCP 2025-03-26 Streamable HTTP spec is new enough that most server implementations are
        catching up to it. The 2024-11-05 spec and the Legacy SSE transport are what most servers
        still ship. Discovery metadata is optional in both, so vendors that already have working
        OAuth (because they already run OAuth-protected APIs for other reasons: Linear, Notion,
        Supabase, Sentry) tend to require auth but not necessarily serve the MCP-specific discovery
        documents.
      </p>
      <p>
        The servers I&apos;d worry about are the public ones with mutating tools and no documented
        reason for being public. Those are startups and solo projects shipping MCP endpoints that look
        like read-only wiki queries but include <code>create_...</code> or <code>update_...</code>{' '}
        tools in the list, with no AI-catalog entry saying this is intentional. The developer who
        shipped them might not have realised there&apos;s no auth gate.
      </p>
      <p>
        If you&apos;re building an MCP server right now, the fastest wins are:
      </p>
      <ol className="list-decimal list-inside space-y-2 my-4 text-ink-soft">
        <li>serve <code>/.well-known/oauth-protected-resource</code> so clients can discover your auth server,</li>
        <li>advertise <code>code_challenge_methods_supported: [&quot;S256&quot;]</code> and <code>resource_indicators_supported: true</code> in your authorization server metadata,</li>
        <li>give each tool its own scope and reject calls whose token lacks it.</li>
      </ol>
      <p>
        OAuth 2.1 with PKCE and resource indicators is the whole spec; if you implement those three,
        you&apos;re ahead of most of this list.
      </p>

      <h2 className="text-xl font-semibold text-ink mt-12 mb-4">Limitations and things I&apos;ll fix</h2>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li>
          <s>Can&apos;t audit auth-walled servers deeper than &quot;auth-walled&quot;</s>{' '}
          Shipped in 0.1.4 the same day. <code>patchbay audit &lt;url&gt; --auth=&lt;token&gt;</code>{' '}
          (or <code>PATCHBAY_AUDIT_TOKEN=...</code> env var) sends the bearer on every probe
          request, so Linear, Notion, Supabase, Sentry and your own OAuth-protected MCP get the
          full audit instead of &quot;auth-walled, not audited&quot;.
        </li>
        <li>
          <s>Checks only hit the discovery metadata, cannot verify behaviour (e.g. does the server actually validate the <code>aud</code> claim per RFC 8707?)</s>{' '}
          Shipping in 0.4.0: AUDIENCE-001. Pass <code>--probe-audience=&lt;token-with-wrong-aud&gt;</code>{' '}
          and patchbay sends a tools/list call with that token. If the server accepts it, the
          server is not validating the audience claim and any sibling resource at the same auth
          server can replay its tokens. Credit: @Bloqarl on r/mcp.
        </li>
        <li>SCOPE-002 is name-regex heuristics on tool names. Will produce occasional false positives on names like <code>post_user</code> (meaning &quot;the user who posted&quot; vs. &quot;HTTP POST a user&quot;).</li>
        <li>The probe tries the given URL, <code>/mcp</code>, <code>/sse</code>, <code>/messages</code>, and <code>/</code>. It won&apos;t find endpoints at unusual paths.</li>
        <li>
          <s>Stdio transport servers (local MCP) are out of scope for probing</s>{' '}
          Shipping in 0.4.0: <code>patchbay audit --stdio &quot;npx -y @foo/mcp /path&quot;</code>{' '}
          spawns the server as a child process, speaks MCP JSON-RPC over stdin/stdout, and
          hands the tool list to MANIFEST-001. Finally makes Claude Desktop configs auditable.
          OAuth-family checks (AUTH-*, AUDIENCE-001) still only apply to HTTP targets because
          stdio has no HTTP surface.
        </li>
        <li>
          <s>Doesn&apos;t yet have <code>--pr-draft</code></s>{' '}
          Shipped in 0.1.3 the same day. <code>patchbay audit &lt;target&gt; --pr-draft --out
          PATCHBAY_AUDIT.md</code> renders a PR-body-ready markdown report (summary table,
          grouped by severity, reproducer per finding). The example GitHub Action now posts
          it as a PR comment automatically.
        </li>
        <li>
          <s>Doesn&apos;t yet read <code>/.well-known/ai-catalog.json</code></s>{' '}
          Shipped in 0.1.2 the same day as this post. When a server publishes an ai-catalog
          declaring no-auth intentionally (<code>authentication: &quot;none&quot;</code>,{' '}
          <code>auth_required: false</code>, <code>public: true</code>, or similar), AUTH-001
          now auto-downgrades to info with evidence pointing at the declaring field.
        </li>
      </ul>

      <h2 className="text-xl font-semibold text-ink mt-12 mb-4">Try it</h2>
      <pre className="rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto my-4">
        <code>npx -y @patchbay-nebius/agent audit &lt;your-server-or-repo&gt;</code>
      </pre>
      <p>
        In CI, drop{' '}
        <a href="https://github.com/GodSmasher/patchbay/blob/main/examples/github-action/patchbay-audit.yml" className="text-ink underline underline-offset-4 hover:text-ink">
          examples/github-action/patchbay-audit.yml
        </a>{' '}
        into your own repo as <code>.github/workflows/patchbay-audit.yml</code>. It runs on every
        push and PR, fails the build on critical or high findings and uploads SARIF to the GitHub
        Code Scanning tab.
      </p>
      <p>
        If it flags something and you think it&apos;s wrong, open an issue with the output.
        False-positive reports are the most useful feedback right now. The severity recalibration
        between first and second version came entirely from running the tool on known-good servers
        and finding where it was too alarmist.
      </p>
      <p>
        Repo:{' '}
        <a href="https://github.com/GodSmasher/patchbay" className="text-ink underline underline-offset-4 hover:text-ink">
          GodSmasher/patchbay
        </a>
        . MIT. No tracking, no backend, no account. Just a CLI.
      </p>

      <h2 className="text-xl font-semibold text-ink mt-12 mb-4">What is next</h2>
      <p>
        The CLI stays free and MIT forever. For teams that do not want to run the CI integration
        themselves, I am planning a hosted version for Q1 2027: scheduled scans against a list of
        MCP endpoints, diff alerts when something changes (new finding, severity escalation, tool
        manifest change), delivery via email, Slack or webhook.
      </p>
      <p>
        Interested? Two ways to signal:
      </p>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li>
          Public interest check (react with 👍 / 👎 / 🚀, or comment with your use case):{' '}
          <a href="https://github.com/GodSmasher/patchbay/discussions/2" className="text-ink underline underline-offset-4 hover:text-ink">
            github.com/GodSmasher/patchbay/discussions/2
          </a>
        </li>
        <li>
          Email waitlist (so you hear when it launches):{' '}
          <a href="https://tally.so/r/yXMQjd" className="text-ink underline underline-offset-4 hover:text-ink">
            tally.so/r/yXMQjd
          </a>
        </li>
      </ul>
    </>
  )
}

function Row({ label, value, emphasised }: { label: string; value: string; emphasised?: boolean }) {
  return (
    <tr>
      <td className="px-4 py-3 text-ink-mute">{label}</td>
      <td className={`px-4 py-3 text-right font-mono ${emphasised ? 'text-warn font-semibold' : 'text-ink'}`}>{value}</td>
    </tr>
  )
}

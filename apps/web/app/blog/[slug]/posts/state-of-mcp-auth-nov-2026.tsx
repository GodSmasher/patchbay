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

      <h2 className="text-xl font-semibold text-white mt-12 mb-4">The numbers</h2>
      <p>
        25 servers scanned on 2026-11-02. All are publicly listed in community directories or vendor
        docs. The URL list is in{' '}
        <a href="https://github.com/GodSmasher/patchbay/blob/main/bench/mcp-sweep-targets.txt" className="text-neutral-100 underline underline-offset-4 hover:text-white">
          bench/mcp-sweep-targets.txt
        </a>
        .
      </p>

      <div className="my-6 overflow-x-auto rounded border border-neutral-800">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-neutral-900">
            <Row label="Reachable" value="20 / 25" />
            <Row label="Enforce authentication" value="12 / 25" />
            <Row label="Reachable + public (no auth)" value="8 / 20" />
            <Row label="Of those public: expose a mutating tool" value="3 / 8" emphasised />
            <Row label="Advertise OAuth 2.1 discovery metadata" value="2 / 20" />
            <Row label="Advertise resource_indicators_supported (RFC 8707)" value="2 / 20" />
            <Row label="Advertise PKCE S256 in code_challenge_methods_supported" value="2 / 20" />
          </tbody>
        </table>
      </div>

      <p>
        Three servers surfaced critical findings. All three got a responsible-disclosure email with a
        90-day embargo before any public write-up names them. If you&apos;re one of them and you fix
        the issue, I&apos;ll cite the fixed state here.
      </p>
      <p>
        Public-by-design servers like DeepWiki are correctly flagged as{' '}
        <em>info, public read-only server (documented pattern)</em> rather than critical. That
        distinction matters more than it sounds: the first version of my tool called DeepWiki
        &quot;critical no auth required&quot;, which would have made the whole post indefensible on
        day one.
      </p>

      <h2 className="text-xl font-semibold text-white mt-12 mb-4">What the tool actually does</h2>
      <p>
        <code>patchbay audit &lt;url&gt;</code> runs 13 checks grouped roughly like this:
      </p>
      <h3 className="text-lg font-medium text-neutral-100 mt-6 mb-2">Auth presence (AUTH-001, AUTH-002)</h3>
      <p>
        Does the server accept <code>tools/list</code> without credentials? If yes, do any tool names
        look mutating (create / delete / send / execute / start-...)? Critical only when both are
        true. Public read-only servers are explicitly recognised as a legitimate pattern.
      </p>
      <h3 className="text-lg font-medium text-neutral-100 mt-6 mb-2">OAuth metadata completeness (AUTH-003 / 004 / 005)</h3>
      <p>
        If the server serves <code>/.well-known/oauth-authorization-server</code>, we read it and
        check for PKCE S256 advertisement, resource indicators, and a dynamic client registration
        endpoint. These are &quot;not advertised&quot; findings with confidence medium. A server
        can enforce the behaviour without exposing the metadata, so we only flag the metadata gap.
      </p>
      <h3 className="text-lg font-medium text-neutral-100 mt-6 mb-2">Scopes (SCOPE-001, SCOPE-002)</h3>
      <p>
        If the server advertises OAuth, do its tools declare per-tool scopes? Do write and read tools
        share a scope (so revoking write access also revokes reads)?
      </p>
      <h3 className="text-lg font-medium text-neutral-100 mt-6 mb-2">Secrets and transport</h3>
      <p>
        The directory-mode checks for hardcoded <code>sk-...</code> / <code>ghp_...</code> /{' '}
        <code>AKIA...</code> patterns in source files (skipping test fixtures and example patterns).
        Remote-mode checks whether the endpoint accepts plain HTTP, accepts a spoofed <code>Origin</code>{' '}
        header, and treats <code>localhost</code> consistently with <code>127.0.0.1</code> on the
        token endpoint.
      </p>
      <h3 className="text-lg font-medium text-neutral-100 mt-6 mb-2">Honest probe failures (PROBE-001)</h3>
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
      <pre className="rounded border border-neutral-800 bg-neutral-950 p-4 text-sm overflow-x-auto my-4">
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

      <h2 className="text-xl font-semibold text-white mt-12 mb-4">What I think is actually going on</h2>
      <p>
        The MCP 2025-03-26 Streamable HTTP spec is new enough that most server implementations are
        catching up to it. The 2024-11-05 spec and the Legacy SSE transport are what most servers
        still ship. Discovery metadata is optional in both, so vendors that already have working
        OAuth (because they already run OAuth-protected APIs for other reasons: Linear, Notion,
        Supabase, Sentry) tend to require auth but not necessarily serve the MCP-specific discovery
        documents.
      </p>
      <p>
        The servers I&apos;d worry about are the public ones with mutating tools. Those are startups
        and solo projects shipping MCP endpoints that look like read-only wiki queries but include{' '}
        <code>start_swap</code> or <code>create_...</code> tools in the list. The developer who
        shipped them might not have realised there&apos;s no auth gate.
      </p>
      <p>
        If you&apos;re building an MCP server right now, the fastest wins are:
      </p>
      <ol className="list-decimal list-inside space-y-2 my-4 text-neutral-300">
        <li>serve <code>/.well-known/oauth-protected-resource</code> so clients can discover your auth server,</li>
        <li>advertise <code>code_challenge_methods_supported: [&quot;S256&quot;]</code> and <code>resource_indicators_supported: true</code> in your authorization server metadata,</li>
        <li>give each tool its own scope and reject calls whose token lacks it.</li>
      </ol>
      <p>
        OAuth 2.1 with PKCE and resource indicators is the whole spec; if you implement those three,
        you&apos;re ahead of most of this list.
      </p>

      <h2 className="text-xl font-semibold text-white mt-12 mb-4">Limitations and things I&apos;ll fix</h2>
      <ul className="list-disc list-inside space-y-2 my-4 text-neutral-300">
        <li>Can&apos;t audit auth-walled servers deeper than &quot;auth-walled&quot;. A future <code>--auth</code> flag will take a token.</li>
        <li>SCOPE-002 is name-regex heuristics on tool names. Will produce occasional false positives on names like <code>post_user</code> (meaning &quot;the user who posted&quot; vs. &quot;HTTP POST a user&quot;).</li>
        <li>The probe tries the given URL, <code>/mcp</code>, <code>/sse</code>, <code>/messages</code>, and <code>/</code>. It won&apos;t find endpoints at unusual paths.</li>
        <li>Stdio transport servers (local MCP) are out of scope; audit the HTTP side.</li>
        <li>Doesn&apos;t yet have <code>--pr-draft</code> to write a markdown findings doc into the target repo. That ships next.</li>
      </ul>

      <h2 className="text-xl font-semibold text-white mt-12 mb-4">Try it</h2>
      <pre className="rounded border border-neutral-800 bg-neutral-950 p-4 text-sm overflow-x-auto my-4">
        <code>npx -y @patchbay-nebius/agent audit &lt;your-server-or-repo&gt;</code>
      </pre>
      <p>
        If it flags something and you think it&apos;s wrong, open an issue with the output.
        False-positive reports are the most useful feedback right now. The severity recalibration
        between first and second version came entirely from running the tool on known-good servers
        and finding where it was too alarmist.
      </p>
      <p>
        Repo:{' '}
        <a href="https://github.com/GodSmasher/patchbay" className="text-neutral-100 underline underline-offset-4 hover:text-white">
          GodSmasher/patchbay
        </a>
        . MIT. No tracking, no backend, no account. Just a CLI.
      </p>
    </>
  )
}

function Row({ label, value, emphasised }: { label: string; value: string; emphasised?: boolean }) {
  return (
    <tr>
      <td className="px-4 py-3 text-neutral-400">{label}</td>
      <td className={`px-4 py-3 text-right font-mono ${emphasised ? 'text-red-400 font-semibold' : 'text-neutral-100'}`}>{value}</td>
    </tr>
  )
}

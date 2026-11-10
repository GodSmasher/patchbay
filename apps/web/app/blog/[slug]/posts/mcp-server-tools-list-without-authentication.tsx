import Link from 'next/link'

const A = 'text-ink underline underline-offset-4 hover:text-ink'
const H2 = 'text-xl font-semibold text-ink mt-12 mb-4'
const PRE = 'rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto my-4'

export function McpServerToolsListWithoutAuthentication() {
  return (
    <>
      <p>
        Send an MCP server a <code>tools/list</code> request with no credentials. Either it
        answers with 401 or it hands you the names and descriptions of everything it can do.
      </p>
      <p>
        The second case is not always a bug. Some servers are public on purpose. The question that
        matters is what is on the list.
      </p>

      <h2 className={H2}>Authentication is optional in MCP</h2>
      <p>
        The{' '}
        <a
          href="https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization"
          className={A}
        >
          MCP authorization spec
        </a>{' '}
        says authorization is optional. A server that searches public documentation or returns
        public data has no reason to ask for a login. Anyone can read that data anyway.
      </p>
      <p>
        That changes the moment one tool does something on behalf of an account. A tool that
        creates a record, sends a message or deletes a file acts with the permissions of whoever
        runs the server. If the server does not ask who is calling, everyone who finds the URL is
        that person.
      </p>

      <h2 className={H2}>Try it on your own server</h2>
      <pre className={PRE}>
        <code>
{`curl -s -X POST https://mcp.example.com/mcp \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}
        </code>
      </pre>
      <p>
        A protected server answers with <code>401</code> and a <code>WWW-Authenticate</code> header
        that points to its resource metadata. An open server answers with a JSON list of tools.
        Some servers expect an <code>initialize</code> request first, so an error here does not
        prove the server is protected.
      </p>

      <h2 className={H2}>What I saw on public servers</h2>
      <p>
        In a sweep of 277 public MCP server URLs on 2026-11-06, 264 were reachable. 209 asked for
        authentication. 55 answered without it and 34 of those returned a complete tool list.
      </p>
      <p>
        6 of the 34 had at least one tool whose name reads like a write operation. That number
        needs context. Three are still under manual review. One is public by design. Two were
        confirmed and reported to the operators, which is why no server is named here.
      </p>

      <h2 className={H2}>How the check decides</h2>
      <pre className={PRE}>
        <code>npx -y @patchbay-nebius/agent audit https://mcp.example.com/mcp</code>
      </pre>
      <p>
        The finding is{' '}
        <Link href="/docs/auth-001" className={A}>
          AUTH-001
        </Link>
        . It needs no flags and the{' '}
        <Link href="/scan" className={A}>
          browser scanner
        </Link>{' '}
        runs it too. The check asks for the tool list without an <code>Authorization</code> or{' '}
        <code>x-api-key</code> header and then looks at the tool names.
      </p>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li>
          Critical if a name contains a word like <code>create</code>, <code>delete</code>,{' '}
          <code>send</code>, <code>execute</code> or <code>deploy</code>.
        </li>
        <li>
          Info if every name looks like a read, for example <code>get</code>, <code>list</code> or{' '}
          <code>search</code>.
        </li>
        <li>
          Info if the server publishes <code>/.well-known/ai-catalog.json</code> and declares there
          that it is public on purpose.
        </li>
        <li>
          Info if the host belongs to a cloud platform that enforces its own identity layer on
          every call, such as Google Cloud, AWS or Azure.
        </li>
      </ul>

      <h2 className={H2}>What the check cannot tell you</h2>
      <p>
        It never calls a tool. A scanner that runs <code>delete_user</code> on a stranger&apos;s
        server to see what happens would be an attack. So the check knows that the list is open. It
        does not know whether a call would go through. Some servers show the list to everyone and
        still reject every call without a token.
      </p>
      <p>
        It also judges by name. A tool called <code>run_report</code> is flagged although it only
        reads. A tool called <code>sync</code> is not flagged although it may write. Treat a
        critical result as a reason to look, not as proof.
      </p>

      <h2 className={H2}>The fix</h2>
      <ol className="list-decimal list-inside space-y-2 my-4 text-ink-soft">
        <li>
          Decide whether the server is meant to be public. If it is, make sure no tool can write
          and say so in your docs.
        </li>
        <li>
          If it is not, protect <code>tools/call</code> first. Hiding the list while calls stay open
          fixes nothing.
        </li>
        <li>
          Answer every unauthenticated request with <code>401</code> and a{' '}
          <code>WWW-Authenticate</code> header. That includes <code>initialize</code> and{' '}
          <code>tools/list</code>.
        </li>
        <li>
          Publish <code>/.well-known/oauth-protected-resource</code> so clients can find your
          authorization server without being configured by hand.
        </li>
        <li>
          Validate every token on every request. A session that was authenticated once is not a
          credential.
        </li>
      </ol>
      <p>
        If you connect agents to servers you do not run, the same test works from the other side.
        A server that hands its write tools to anyone hands them to your agent and to everyone
        else. The list can also{' '}
        <Link href="/blog/mcp-tools-change-after-approval" className={A}>
          change after you approved it
        </Link>
        .
      </p>
    </>
  )
}

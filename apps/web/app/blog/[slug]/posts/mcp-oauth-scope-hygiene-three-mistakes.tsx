import Link from 'next/link'

const A = 'text-ink underline underline-offset-4 hover:text-ink'
const H2 = 'text-xl font-semibold text-ink mt-12 mb-4'
const PRE = 'rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto my-4'

export function McpOauthScopeHygieneThreeMistakes() {
  return (
    <>
      <p>
        You wire an agent to an MCP server that exposes three tools: <code>list_users</code>,{' '}
        <code>get_user</code>, <code>delete_user</code>. The server protects all three with one
        OAuth scope. The agent gets that scope and now has permission to delete any user it ever
        looked up.
      </p>
      <p>
        That is not a bug in the agent. That is a choice the server made when it designed its
        scopes. Three checks in patchbay look at that choice from three angles. Taken together
        they are the shortest audit of scope hygiene you can run on an MCP server.
      </p>

      <h2 className={H2}>Mistake 1: one scope for everything</h2>
      <p>
        <Link href="/docs/scope-001" className={A}>
          SCOPE-001
        </Link>{' '}
        fires when every tool on the server sits behind the same scope. A client that needs to
        read a single record has to request the same permission as a client that needs to delete
        the database. The user, if asked at all, sees one consent screen and clicks through.
      </p>
      <p>
        The fix is to give each tool its own scope string. It does not have to be elegant.{' '}
        <code>mcp:users.read</code> and <code>mcp:users.delete</code> is enough. What matters is
        that a client can request the first without the second.
      </p>

      <h2 className={H2}>Mistake 2: read and write share a scope</h2>
      <p>
        <Link href="/docs/scope-002" className={A}>
          SCOPE-002
        </Link>{' '}
        is the softer version. Scopes exist, each tool has one, but read and write operations are
        grouped together. <code>mcp:users</code> covers both <code>get_user</code> and{' '}
        <code>delete_user</code>. A client that only needs to read now gets write permission as a
        side effect, because scope hygiene stopped one level above where it needed to.
      </p>
      <p>
        The pattern that works is a <code>.read</code> and <code>.write</code> suffix on every
        resource. Read-only agents request only the first. Write-capable agents request both. The
        server can tell at a glance what a token was granted for.
      </p>

      <h2 className={H2}>Mistake 3: no OAuth at all</h2>
      <p>
        <Link href="/docs/auth-002" className={A}>
          AUTH-002
        </Link>{' '}
        fires when the server accepts a bearer token or API key but serves no OAuth metadata at
        all. There is no discovery, no scopes, no audience, no rotation. Every client has to be
        configured out of band with a static credential that was shared somewhere once and has
        been in your <code>.env</code> file ever since.
      </p>
      <p>
        This is the mistake that makes the other two moot. If every client ends up with the same
        long-lived token, no amount of per-tool scope strings in the metadata matters. Static
        credentials are the ceiling on how fine-grained your authorization can get.
      </p>

      <h2 className={H2}>How the three findings combine</h2>
      <p>
        You can pass any one of the three checks and still have a server that is hard to secure.
        You have to pass all three for scope hygiene to mean anything in practice.
      </p>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li>
          <strong>AUTH-002 passes, SCOPE-001 fires:</strong> OAuth is there, but the scope string
          is identical for every tool. A client that gets any scope gets all permissions.
        </li>
        <li>
          <strong>AUTH-002 passes, SCOPE-001 passes, SCOPE-002 fires:</strong> Per-tool scopes
          exist, but read and write share. Agents that should be read-only get write quietly.
        </li>
        <li>
          <strong>AUTH-002 fires:</strong> Nothing above matters. Scopes are a property of OAuth
          and the server does not use OAuth.
        </li>
      </ul>

      <h2 className={H2}>How to run the three together</h2>
      <pre className={PRE}>
        <code>npx -y @patchbay-nebius/agent audit https://mcp.example.com/mcp</code>
      </pre>
      <p>
        All three are passive. SCOPE-001 and SCOPE-002 read the tool manifest and the authorization
        server metadata, no credentials needed. AUTH-002 fires when a dummy bearer token comes
        back accepted and no OAuth discovery is served. One run covers all three.
      </p>
      <p>
        For CI, the right gate is <code>--fail-on=high</code>. That catches AUTH-002 as high and
        SCOPE-002 as high. SCOPE-001 is medium and will show up in the report without blocking a
        deploy, which matches what the finding is about: a design review, not a production
        emergency.
      </p>

      <h2 className={H2}>Why this is worth the design work</h2>
      <p>
        MCP servers end up installed on machines that run agents with broad latitude. The user
        clicks approve once, at install, on a consent screen that lists tools they will never read
        in detail. After that the scope string is the only thing standing between a well-meaning
        agent and a mistake that deletes a table. Give the server operator as many ways to
        grant the smaller permission as you can.
      </p>
      <p>
        If you are updating the server anyway, do the three in one pass. They share the same
        metadata document and the same handler for <code>tools/list</code>.
      </p>
    </>
  )
}

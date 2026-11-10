import Link from 'next/link'

const A = 'text-ink underline underline-offset-4 hover:text-ink'
const H2 = 'text-xl font-semibold text-ink mt-12 mb-4'
const PRE = 'rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto my-4'

export function McpOauthLoginHangsLoopbackRedirect() {
  return (
    <>
      <p>
        You add a remote MCP server to Claude Code, Claude Desktop or another native client. The
        browser opens, you sign in, you click <strong>Allow</strong>. Then nothing. The client keeps
        waiting, or the browser shows an <code>invalid_redirect_uri</code> error, and the server
        never shows up as connected.
      </p>
      <p>
        If the server uses OAuth, the most likely cause is on the server side: its authorization
        server does not accept loopback redirect URIs with an arbitrary port. This post explains
        why that breaks every native client, how to confirm it in one command, and what to change.
      </p>

      <h2 className={H2}>Why native clients need a loopback redirect</h2>
      <p>
        A web app finishes the OAuth authorization code flow on a public HTTPS callback URL. A CLI
        or desktop app has no such URL. Instead it opens a temporary HTTP listener on the local
        machine and tells the authorization server to redirect there:
      </p>
      <pre className={PRE}>
        <code>http://127.0.0.1:53124/callback</code>
      </pre>
      <p>
        The port is assigned by the operating system when the login starts, so it is different
        every time. The client cannot know it in advance and cannot pre-register it.
      </p>
      <p>
        <a href="https://datatracker.ietf.org/doc/html/rfc8252#section-7.3" className={A}>
          RFC 8252 section 7.3
        </a>{' '}
        covers exactly this case. It says the authorization server <strong>must</strong> allow any
        port to be specified at the time of the request for loopback IP redirect URIs, so that
        clients can use an ephemeral port. OAuth 2.1 carries the same rule forward.
      </p>

      <h2 className={H2}>Where it goes wrong</h2>
      <p>
        Many authorization servers validate redirect URIs by exact string match. That is the right
        default for web clients, and it is wrong for loopback. There are two places it bites:
      </p>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li>
          <strong>At registration.</strong> MCP clients register themselves through Dynamic Client
          Registration (RFC 7591). If the registration endpoint rejects{' '}
          <code>http://127.0.0.1:PORT/callback</code> outright, the client never gets a{' '}
          <code>client_id</code> and the flow stops before the browser opens.
        </li>
        <li>
          <strong>At authorization.</strong> Registration succeeds with one port, but the next
          login uses a different one. Exact matching now fails, and the user sees the error only
          after clicking Allow.
        </li>
      </ul>
      <p>
        Both look the same from the outside: login does not complete in any CLI or desktop client,
        while the same server may work fine from a web-based client with a fixed callback URL.
      </p>

      <h2 className={H2}>Confirm it in one command</h2>
      <p>
        <code>patchbay audit</code> has an opt-in probe for this. It attempts a client registration
        with loopback redirect URIs and reports whether the server accepted them:
      </p>
      <pre className={PRE}>
        <code>npx -y @patchbay-nebius/agent audit https://mcp.example.com/mcp --probe-dcr-loopback</code>
      </pre>
      <p>
        If the registration endpoint refuses loopback URIs you get finding{' '}
        <Link href="/docs/auth-006" className={A}>
          AUTH-006
        </Link>{' '}
        at high severity, with the HTTP status the server returned. The probe is opt-in because it
        sends a real registration request, so run it against servers you operate or have
        permission to test. If the server has no registration endpoint at all, that is a different
        finding,{' '}
        <Link href="/docs/auth-005" className={A}>
          AUTH-005
        </Link>
        .
      </p>
      <p>
        For the checks that need no flags, you can also paste the URL into the{' '}
        <Link href="/scan" className={A}>
          browser scanner
        </Link>
        .
      </p>

      <h2 className={H2}>The fix</h2>
      <p>The rule to implement in redirect URI validation is short:</p>
      <ol className="list-decimal list-inside space-y-2 my-4 text-ink-soft">
        <li>
          If the registered redirect URI has scheme <code>http</code> and host{' '}
          <code>127.0.0.1</code> or <code>[::1]</code>, compare scheme, host and path, and ignore
          the port.
        </li>
        <li>
          Accept those URIs in Dynamic Client Registration, with any port.
        </li>
        <li>
          Keep exact matching for everything else, and keep rejecting plain <code>http://</code>{' '}
          for every non-loopback host.
        </li>
      </ol>
      <p>
        On <code>localhost</code>: RFC 8252 section 8.3 recommends the IP literal over the hostname,
        because <code>localhost</code> can resolve to something unexpected. Many clients still send{' '}
        <code>http://localhost:PORT/callback</code>, so in practice you want to accept both forms
        and treat them the same. A server that accepts one and rejects the other is its own interop
        bug, covered by{' '}
        <Link href="/docs/redirect-001" className={A}>
          REDIRECT-001
        </Link>
        .
      </p>
      <p>
        If you use a hosted identity provider, look for a setting named something like
        &quot;native application&quot;, &quot;loopback redirect&quot; or &quot;allow any
        port&quot; before writing custom validation. Most providers support this; it is often just
        not enabled for clients created through dynamic registration.
      </p>

      <h2 className={H2}>If it is not your server</h2>
      <p>
        As a user you cannot work around this from the client side. What helps the maintainer most
        is a precise report: the client you used, the fact that login hangs after consent, and a
        link to RFC 8252 section 7.3. If you run the audit with <code>--publish</code>, you get a
        report URL you can attach to the issue.
      </p>

      <h2 className={H2}>Keep it from regressing</h2>
      <p>
        Redirect validation tends to get tightened again during later security reviews. Put the
        audit in CI so the build fails if loopback registration stops working:
      </p>
      <pre className={PRE}>
        <code>npx -y @patchbay-nebius/agent audit https://mcp.example.com/mcp --probe-dcr-loopback --ci --fail-on=high</code>
      </pre>
      <p>
        The CLI is MIT licensed and runs locally:{' '}
        <a href="https://github.com/GodSmasher/patchbay" className={A}>
          github.com/GodSmasher/patchbay
        </a>
        . The full list of checks is in the{' '}
        <Link href="/docs" className={A}>
          findings reference
        </Link>
        .
      </p>
    </>
  )
}

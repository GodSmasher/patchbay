import Link from 'next/link'

const A = 'text-ink underline underline-offset-4 hover:text-ink'
const H2 = 'text-xl font-semibold text-ink mt-12 mb-4'
const PRE = 'rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto my-4'

export function McpDynamicClientRegistrationMissing() {
  return (
    <>
      <p>
        You point an MCP client at a remote server that uses OAuth. Instead of a login page you get
        an error along the lines of &quot;server does not support dynamic client registration&quot;,
        or a prompt asking for a client ID you were never given. The server is up, its OAuth
        metadata loads and still no client can connect on its own.
      </p>
      <p>
        The cause is one missing field in the authorization server metadata:{' '}
        <code>registration_endpoint</code>.
      </p>

      <h2 className={H2}>What the field does</h2>
      <p>
        Before an OAuth client can send a user to the login page, it needs a{' '}
        <code>client_id</code> that the authorization server recognises. On the classic web, a
        developer gets one by filling in a form in a dashboard. That does not work for MCP. The
        client is whatever the user happens to run, the server has never heard of it and nobody is
        going to file a ticket with every server operator.
      </p>
      <p>
        <a href="https://datatracker.ietf.org/doc/html/rfc7591" className={A}>
          RFC 7591
        </a>{' '}
        (Dynamic Client Registration) solves this. The client sends a POST with its name and
        redirect URIs to the registration endpoint and receives a <code>client_id</code> in the
        response. The MCP authorization spec points to it as the way clients are expected to
        onboard. The client discovers where to register from the metadata document:
      </p>
      <pre className={PRE}>
        <code>
{`GET /.well-known/oauth-authorization-server

{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "registration_endpoint": "https://auth.example.com/register"
}`}
        </code>
      </pre>
      <p>
        If the last line is absent, a client that has no pre-issued <code>client_id</code> has
        nowhere to go.
      </p>

      <h2 className={H2}>How common it is</h2>
      <p>
        In a sweep of 277 public MCP server URLs on 2026-11-06, 264 were reachable and 5 of them
        served OAuth metadata without a registration endpoint. That is a small number and it only
        counts servers whose metadata could be read without credentials. It is also the kind of
        gap that is invisible to the operator: their own first-party client has a hard-coded{' '}
        <code>client_id</code> and works fine.
      </p>

      <h2 className={H2}>Check your server</h2>
      <pre className={PRE}>
        <code>npx -y @patchbay-nebius/agent audit https://mcp.example.com/mcp</code>
      </pre>
      <p>
        A server that advertises OAuth without a registration endpoint gets finding{' '}
        <Link href="/docs/auth-005" className={A}>
          AUTH-005
        </Link>{' '}
        at high severity. No flags are needed and the{' '}
        <Link href="/scan" className={A}>
          browser scanner
        </Link>{' '}
        runs the same check.
      </p>

      <h2 className={H2}>The fix</h2>
      <ol className="list-decimal list-inside space-y-2 my-4 text-ink-soft">
        <li>
          Expose a registration endpoint that accepts client metadata (at least{' '}
          <code>client_name</code> and <code>redirect_uris</code>) and returns a{' '}
          <code>client_id</code>. Public clients such as CLIs and desktop apps do not get a secret;
          they authenticate the flow with PKCE.
        </li>
        <li>
          Advertise it as <code>registration_endpoint</code> in{' '}
          <code>/.well-known/oauth-authorization-server</code>.
        </li>
        <li>
          Accept loopback redirect URIs at registration, or the next step fails for every native
          client. That is its own finding,{' '}
          <Link href="/blog/mcp-oauth-login-hangs-loopback-redirect" className={A}>
            covered here
          </Link>
          .
        </li>
      </ol>
      <p>
        Most hosted identity providers support dynamic registration but ship with it switched off.
        Look for that setting before writing an endpoint yourself.
      </p>

      <h2 className={H2}>Open registration is not open access</h2>
      <p>
        A common objection is that letting anyone register a client weakens security. Registration
        only hands out an identifier. The user still has to sign in and approve the request and
        the server still decides what each token may do. What you should add is abuse control on
        the endpoint itself: rate limiting, a cap on redirect URIs per client and expiry for
        clients that never complete a login.
      </p>
      <p>
        If you cannot offer open registration, document how a client obtains a{' '}
        <code>client_id</code> and say so where users will see it. A server that advertises OAuth
        and gives third-party clients no way in is the case this check exists for.
      </p>
    </>
  )
}

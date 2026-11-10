import Link from 'next/link'

const A = 'text-ink underline underline-offset-4 hover:text-ink'
const H2 = 'text-xl font-semibold text-ink mt-12 mb-4'
const PRE = 'rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto my-4'

export function McpPkceMissingFromOauthMetadata() {
  return (
    <>
      <p>
        Your authorization server supports PKCE. You tested it. A client still refuses to start the
        login against your MCP server and reports that the server does not support PKCE.
      </p>
      <p>
        The usual cause is not the PKCE implementation. It is one field missing from the metadata
        document that clients read before they do anything else.
      </p>

      <h2 className={H2}>Why a missing field stops the login</h2>
      <p>
        PKCE protects the authorization code. The client creates a secret, sends a hash of it with
        the authorization request and proves it knows the secret when it exchanges the code for a
        token. A stolen code is useless without that secret.
      </p>
      <p>
        OAuth has no way for a client to ask whether a server supports PKCE. The only signal is the
        authorization server metadata. The{' '}
        <a
          href="https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization"
          className={A}
        >
          MCP authorization spec
        </a>{' '}
        is strict about what follows from that. Clients must verify PKCE support before they
        proceed. If <code>code_challenge_methods_supported</code> is absent from the metadata, the
        spec says the authorization server does not support PKCE and the client must refuse to
        proceed.
      </p>
      <p>
        So a server that enforces PKCE perfectly but does not say so looks the same to a compliant
        client as a server without PKCE. The client stops before the browser opens.
      </p>

      <h2 className={H2}>What the metadata has to say</h2>
      <pre className={PRE}>
        <code>
{`GET /.well-known/oauth-authorization-server

{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "code_challenge_methods_supported": ["S256"]
}`}
        </code>
      </pre>
      <p>
        The value matters too. MCP clients must use the <code>S256</code> method. A server that
        only lists <code>plain</code> gives them nothing they are allowed to use. The same rule
        applies if your server publishes OpenID Connect discovery instead: the field has to be in
        that document.
      </p>

      <h2 className={H2}>How common it is</h2>
      <p>
        In a sweep of 277 public MCP server URLs on 2026-11-06, 264 were reachable and 3 of them
        served OAuth metadata without <code>S256</code> in{' '}
        <code>code_challenge_methods_supported</code>. That only counts servers whose metadata
        could be read without credentials.
      </p>

      <h2 className={H2}>Check your server</h2>
      <pre className={PRE}>
        <code>npx -y @patchbay-nebius/agent audit https://mcp.example.com/mcp</code>
      </pre>
      <p>
        If the metadata does not list <code>S256</code> you get finding{' '}
        <Link href="/docs/auth-003" className={A}>
          AUTH-003
        </Link>{' '}
        at high severity. No flags are needed and the{' '}
        <Link href="/scan" className={A}>
          browser scanner
        </Link>{' '}
        runs the same check. The check reads the metadata. It does not run a login, so it cannot
        tell you whether the server enforces PKCE at runtime.
      </p>

      <h2 className={H2}>The fix</h2>
      <ol className="list-decimal list-inside space-y-2 my-4 text-ink-soft">
        <li>
          Add <code>&quot;code_challenge_methods_supported&quot;: [&quot;S256&quot;]</code> to the
          authorization server metadata.
        </li>
        <li>
          Reject authorization requests that come without a <code>code_challenge</code>. Advertising
          PKCE while still accepting requests without it protects nobody.
        </li>
        <li>
          Do not accept <code>plain</code>. MCP clients are required to use <code>S256</code>.
        </li>
      </ol>
      <p>
        With a hosted identity provider this is usually a per application setting called something
        like &quot;require PKCE&quot;. Check the metadata document again after you change it.
      </p>
      <p>
        PKCE is one of several fields a client reads from the same document. If you are fixing the
        metadata anyway, look at{' '}
        <Link href="/blog/mcp-dynamic-client-registration-missing" className={A}>
          client registration
        </Link>{' '}
        and the{' '}
        <Link href="/docs/auth-004" className={A}>
          resource indicators flag
        </Link>{' '}
        in the same pass.
      </p>
    </>
  )
}

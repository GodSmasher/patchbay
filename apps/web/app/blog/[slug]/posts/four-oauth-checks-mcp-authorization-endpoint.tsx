import Link from 'next/link'

const A = 'text-ink underline underline-offset-4 hover:text-ink'
const H2 = 'text-xl font-semibold text-ink mt-12 mb-4'
const PRE = 'rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto my-4'

export function FourOauthChecksMcpAuthorizationEndpoint() {
  return (
    <>
      <p>
        OAuth 2.1 removed four things from OAuth 2.0 and marked them not safe to keep. An
        authorization server that still ships them is out of spec. MCP inherits OAuth 2.1 verbatim,
        so an MCP server that sits behind such an authorization server is out of spec too.
      </p>
      <p>
        You cannot see any of this in the metadata document. The metadata says what the server
        supports, not what it refuses. The only way to tell is to send a request and see what comes
        back. That is what the four new checks do.
      </p>

      <h2 className={H2}>What OAuth 2.1 took out</h2>
      <p>
        OAuth 2.1 is a consolidation of OAuth 2.0 best current practice into one spec. Four items
        from 2.0 did not survive.
      </p>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li>
          PKCE is now required on every authorization code flow, not just on public clients. OAuth
          2.0 allowed confidential clients to skip it. OAuth 2.1 does not.
        </li>
        <li>
          The <code>plain</code> code challenge method is gone. Only <code>S256</code> is allowed.
        </li>
        <li>
          The implicit grant (<code>response_type=token</code>) is removed. Access tokens delivered
          in a URL fragment leak into browser history and referer headers.
        </li>
        <li>
          Redirect URIs are compared by exact string match. Prefix match or host-only match turns
          the authorization server into an open redirector for code exfiltration.
        </li>
      </ul>

      <h2 className={H2}>Why metadata does not tell you</h2>
      <p>
        You can look at the authorization server metadata all day and never know whether these
        rules are enforced. <code>code_challenge_methods_supported</code> says the server knows
        about PKCE. It does not say the server rejects a request that comes without a challenge.
        There is no metadata field that says <em>I removed the implicit grant</em>. There is no
        field that says <em>I enforce exact-match redirect_uri comparison</em>.
      </p>
      <p>
        The MCP authorization spec makes PKCE mandatory, but only the authorization server can
        answer whether it actually applies the rule. So you have to ask it.
      </p>

      <h2 className={H2}>How the probe works</h2>
      <p>
        The new checks are opt-in because they write to the authorization server. Run them with
        one flag on an MCP server you operate:
      </p>
      <pre className={PRE}>
        <code>npx -y @patchbay-nebius/agent audit https://mcp.example.com/mcp --probe-headless-oauth</code>
      </pre>
      <p>The flag does three things, in this order:</p>
      <ol className="list-decimal list-inside space-y-2 my-4 text-ink-soft">
        <li>
          Register a throw-away client via Dynamic Client Registration with{' '}
          <code>redirect_uri=http://127.0.0.1:33419/callback</code>. The client has
          <code>application_type: native</code> and <code>token_endpoint_auth_method: none</code>.
        </li>
        <li>
          Send four crafted <code>/authorize</code> requests with that client_id, one per OAuth
          2.1 rule to test. The requests follow redirects in manual mode, so the scanner can read
          the <code>Location</code> header.
        </li>
        <li>
          Decide, for each request, whether the server rejected it (good), accepted it (bad) or
          produced a response the scanner cannot judge from the outside.
        </li>
      </ol>
      <p>
        No tool is ever called. No access token is ever redeemed. The probe stops at the
        authorization response and never touches the token endpoint.
      </p>

      <h2 className={H2}>What each check looks for</h2>
      <p>
        <Link href="/docs/pkce-001" className={A}>
          PKCE-001
        </Link>{' '}
        sends an <code>/authorize</code> request with no <code>code_challenge</code>. If the server
        responds with a redirect that carries an authorization code, PKCE is not enforced. Fires
        critical.
      </p>
      <p>
        <Link href="/docs/pkce-002" className={A}>
          PKCE-002
        </Link>{' '}
        sends a request with <code>code_challenge_method=plain</code>. If a code comes back, the
        server still accepts the removed method. Fires high.
      </p>
      <p>
        <Link href="/docs/implicit-001" className={A}>
          IMPLICIT-001
        </Link>{' '}
        sends a request with <code>response_type=token</code>. If the response delivers an access
        token in the URL fragment, the implicit grant is still on. Fires critical.
      </p>
      <p>
        <Link href="/docs/redirect-002" className={A}>
          REDIRECT-002
        </Link>{' '}
        registers the client with <code>http://127.0.0.1:33419/callback</code> and then asks for
        a redirect to <code>https://attacker.example.com/callback</code>. If the server redirects
        there or issues a code, it does not compare the URI by exact match. Fires critical.
      </p>

      <h2 className={H2}>Why you should run this on your own server</h2>
      <p>
        Most of the checks patchbay has had so far look at what a server publishes. These four
        look at what it actually does when a client hands it a bad request. That is a different
        class of bug. A server can publish perfect metadata and still issue codes without PKCE on
        an old code path that was never updated, because the OAuth library upstream had a
        permissive default. The metadata will not catch that. These checks will.
      </p>
      <p>
        If you run an MCP server that uses a hosted identity provider, run the probe against your
        own setup once. The flag only writes one client registration and does not leak anything
        to anyone. The alternative is to find out the hard way on the next penetration test, or
        after the one that finds a stolen code.
      </p>
      <p>
        The full list of what the scanner now runs is on{' '}
        <Link href="/scan" className={A}>
          the scan page
        </Link>
        . 26 checks live, one retired. The four new ones are opt-in; the other 22 run by default.
      </p>
    </>
  )
}

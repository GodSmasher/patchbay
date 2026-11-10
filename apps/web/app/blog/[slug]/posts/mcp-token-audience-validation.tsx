import Link from 'next/link'

const A = 'text-ink underline underline-offset-4 hover:text-ink'
const H2 = 'text-xl font-semibold text-ink mt-12 mb-4'
const PRE = 'rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto my-4'

export function McpTokenAudienceValidation() {
  return (
    <>
      <p>
        Your MCP server checks that every request carries a valid bearer token: the signature
        verifies, the issuer is your authorization server, the token has not expired. That sounds
        complete. It leaves one question unasked: was this token issued <em>for this server</em>?
      </p>
      <p>
        If the answer is never checked, a token issued for any other service behind the same
        authorization server works on your MCP server too.
      </p>

      <h2 className={H2}>The setup that makes this matter</h2>
      <p>
        One authorization server usually issues tokens for several resources. A company runs an
        internal API, a public API, a billing service and more recently an MCP server, all
        trusting the same issuer. Every token carries an <code>aud</code> (audience) claim naming
        the resource it was meant for:
      </p>
      <pre className={PRE}>
        <code>
{`{
  "iss": "https://auth.example.com",
  "aud": "https://billing.example.com",
  "sub": "user-4821",
  "exp": 1794400000
}`}
        </code>
      </pre>
      <p>
        That token is genuine. Its signature is valid and its issuer is the one your MCP server
        trusts. If the MCP server does not compare <code>aud</code> against its own identifier, it
        accepts the token and the holder can call your tools with a credential that was only ever
        meant for billing.
      </p>
      <p>
        The practical consequence is that your MCP server is as hard to get into as the least
        protected service sharing its issuer. A token leaked from a log file of a low-value
        service, or obtained by a client that was only granted access to that service, becomes a
        key to an endpoint that can run tools.
      </p>

      <h2 className={H2}>What the specs require</h2>
      <p>
        <a href="https://datatracker.ietf.org/doc/html/rfc8707" className={A}>
          RFC 8707
        </a>{' '}
        (Resource Indicators) lets a client name the resource it wants a token for, so the
        authorization server can set the audience accordingly.{' '}
        <a href="https://datatracker.ietf.org/doc/html/rfc9068#section-4" className={A}>
          RFC 9068
        </a>
        , the JWT profile for access tokens, requires the resource server to check that{' '}
        <code>aud</code> contains its own identifier and to reject the token if it does not. The
        MCP authorization spec makes both mandatory from{' '}
        <a href="https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization" className={A}>
          revision 2025-06-18
        </a>
        : clients must send the <code>resource</code> parameter and servers must only accept
        tokens issued for themselves. The earlier 2025-03-26 revision does not mention audience,
        so a server built against it may never have added the check.
      </p>

      <h2 className={H2}>Why metadata does not tell you</h2>
      <p>
        A server can advertise <code>resource_indicators_supported: true</code> and still skip the
        comparison at runtime. The reverse also happens: validation is in place and the metadata
        does not mention it. Missing metadata is a separate, weaker signal (
        <Link href="/docs/auth-004" className={A}>
          AUTH-004
        </Link>
        ). The only way to know is to present a token with the wrong audience and see what comes
        back.
      </p>

      <h2 className={H2}>Test it</h2>
      <p>
        <code>patchbay audit</code> does this as an opt-in probe. You supply a token that is valid
        on the same authorization server and was issued for a <em>different</em> resource:
      </p>
      <pre className={PRE}>
        <code>npx -y @patchbay-nebius/agent audit https://mcp.example.com/mcp --probe-audience=&lt;token&gt;</code>
      </pre>
      <p>
        The probe sends <code>tools/list</code> with that token. A 401 or 403 means the server
        rejected it and the check passes. If the request succeeds you get{' '}
        <Link href="/docs/audience-001" className={A}>
          AUDIENCE-001
        </Link>{' '}
        at critical severity. Anything else is reported as inconclusive. The token can also be
        passed through the <code>PATCHBAY_PROBE_AUDIENCE_TOKEN</code> environment variable, which
        keeps it out of shell history and CI logs.
      </p>
      <p>
        Because the probe needs a token you are entitled to hold, it is not part of public sweeps
        and there is no ecosystem-wide number for this finding. Run it against servers you operate.
      </p>

      <h2 className={H2}>The fix</h2>
      <ol className="list-decimal list-inside space-y-2 my-4 text-ink-soft">
        <li>
          Decide on one canonical resource identifier for the MCP server, normally its public URL,
          and publish it as <code>resource</code> in{' '}
          <code>/.well-known/oauth-protected-resource</code>.
        </li>
        <li>
          On every request, compare the token&apos;s <code>aud</code> claim with that identifier.{' '}
          <code>aud</code> may be a string or an array; accept the token only if your identifier is
          in it.
        </li>
        <li>
          Reject everything else with HTTP 401. Do not fall back to accepting tokens that have no{' '}
          <code>aud</code> at all.
        </li>
        <li>
          If you use opaque tokens, the same rule applies to the audience returned by token
          introspection.
        </li>
      </ol>
      <p>
        Most JWT libraries take the expected audience as a verification option and do nothing with
        the claim unless you pass it. It is worth checking that the option is set in the code path
        your MCP endpoint actually uses.
      </p>
    </>
  )
}

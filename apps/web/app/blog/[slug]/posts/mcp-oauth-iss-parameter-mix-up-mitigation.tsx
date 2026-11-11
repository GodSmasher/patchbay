import Link from 'next/link'

const A = 'text-ink underline underline-offset-4 hover:text-ink'
const H2 = 'text-xl font-semibold text-ink mt-12 mb-4'
const PRE = 'rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto my-4'

export function McpOauthIssParameterMixUpMitigation() {
  return (
    <>
      <p>
        There is a one-field flag in your authorization server metadata that decides whether a
        whole class of OAuth attacks is still possible against your MCP server. Most MCP
        authorization servers do not set it. The check for it is low severity today. It will not
        stay that way.
      </p>

      <h2 className={H2}>Mix-up attacks in one paragraph</h2>
      <p>
        Suppose your MCP client talks to two authorization servers. The user starts a login at
        server A. An attacker, in the middle somewhere, tricks the client into sending the
        authorization code to server B instead. Server B happily issues a token the client thinks
        came from server A. Now the attacker controls what the user signed in with.
      </p>
      <p>
        This is not theoretical. It is the attack{' '}
        <a href="https://datatracker.ietf.org/doc/html/rfc9207" className={A}>
          RFC 9207
        </a>{' '}
        was written for. The mitigation is a single parameter named <code>iss</code> that the
        authorization server echoes back on every response. The client checks that the{' '}
        <code>iss</code> value matches the server it thought it was talking to. If it does not, it
        aborts.
      </p>

      <h2 className={H2}>Where metadata comes in</h2>
      <p>
        A client cannot validate a parameter it does not know to look for. Authorization servers
        signal that they will send <code>iss</code> on every response by setting one field in
        their metadata:
      </p>
      <pre className={PRE}>
        <code>
{`{
  "issuer": "https://auth.example.com",
  "authorization_response_iss_parameter_supported": true,
  "code_challenge_methods_supported": ["S256"]
}`}
        </code>
      </pre>
      <p>
        If the field is <em>not</em> there, a spec-compliant client has no reason to validate{' '}
        <code>iss</code> on anything. The mix-up mitigation is off by default because the client
        cannot assume support.
      </p>

      <h2 className={H2}>Where MCP sits</h2>
      <p>
        The MCP authorization spec revision 2026-07-28 makes the server side a SHOULD: an MCP
        authorization server <em>should</em> set the flag and <em>should</em> include{' '}
        <code>iss</code> on every authorization response. The spec also says explicitly that a
        future revision is expected to raise this to a MUST. So the check is low severity today
        because the spec says SHOULD. The grade impact will grow.
      </p>

      <h2 className={H2}>What the check does</h2>
      <pre className={PRE}>
        <code>npx -y @patchbay-nebius/agent audit https://mcp.example.com/mcp</code>
      </pre>
      <p>
        <Link href="/docs/iss-001" className={A}>
          ISS-001
        </Link>{' '}
        reads the authorization server metadata that was already fetched. If
        <code> authorization_response_iss_parameter_supported</code> is not the boolean{' '}
        <code>true</code>, the check fires low. If it is, the check stays silent.
      </p>
      <p>
        No active probe. No request to the authorization endpoint. The whole thing is a
        metadata-only verification, like PKCE-S256 advertisement or the RFC 9728 Protected
        Resource Metadata presence check.
      </p>

      <h2 className={H2}>The fix</h2>
      <p>
        One line in your authorization server metadata:
      </p>
      <pre className={PRE}>
        <code>{`"authorization_response_iss_parameter_supported": true`}</code>
      </pre>
      <p>
        And then make sure every authorization response the server emits actually carries the
        parameter, including error responses. Hosted identity providers usually have this as a
        setting on the app or tenant level. Self-hosted libraries sometimes have it as a
        configuration flag, sometimes as a code change.
      </p>
      <p>
        If you also published the{' '}
        <Link href="/blog/mcp-pkce-missing-from-oauth-metadata" className={A}>
          PKCE S256 advertisement
        </Link>{' '}
        and a{' '}
        <Link href="/docs/resource-001" className={A}>
          Protected Resource Metadata
        </Link>{' '}
        document, add this one in the same pass. All three live in the same place and clients
        read all three on the same request.
      </p>
    </>
  )
}

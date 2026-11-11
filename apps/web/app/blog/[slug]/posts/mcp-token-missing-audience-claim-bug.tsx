import Link from 'next/link'

const A = 'text-ink underline underline-offset-4 hover:text-ink'
const H2 = 'text-xl font-semibold text-ink mt-12 mb-4'
const PRE = 'rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto my-4'

export function McpTokenMissingAudienceClaimBug() {
  return (
    <>
      <p>
        Here is a two-line audience check from an MCP server that was written to be strict:
      </p>
      <pre className={PRE}>
        <code>
{`if (aud && aud !== me) {
  return reject(401)
}`}
        </code>
      </pre>
      <p>
        It rejects any token issued for a different resource. It passes{' '}
        <Link href="/docs/audience-001" className={A}>
          AUDIENCE-001
        </Link>{' '}
        cleanly. It still has a critical bug.
      </p>
      <p>
        A token whose JWT payload has no <code>aud</code> claim at all makes the first condition
        false. The <code>reject</code> never runs. The server accepts the token.
      </p>

      <h2 className={H2}>Where this comes from</h2>
      <p>
        A reader on the MCP subreddit raised it as a follow-up to the first audience post. The
        pattern reads defensively. It looks like a tightening of a looser check written earlier.
        The author almost got it right. The one case they did not cover is also the one that is
        easiest to produce: mint a token on the authorization server without a <code>resource</code>{' '}
        parameter.
      </p>
      <p>
        That is not an exotic token. Many authorization servers issue tokens without an aud claim
        by default when the client does not request one, because the aud claim is optional in the
        base OAuth 2.0 token response. OAuth 2.1 and MCP make it mandatory on the resource server
        side, but a lot of legacy code checks like the snippet above.
      </p>

      <h2 className={H2}>What the spec actually says</h2>
      <p>
        <a href="https://datatracker.ietf.org/doc/html/rfc9068#section-4" className={A}>
          RFC 9068 Section 4
        </a>{' '}
        covers JWT access tokens. The requirement for a resource server is one sentence: the
        server MUST reject any JWT whose <code>aud</code> claim does not contain its own resource
        identifier. The spec is explicit that &quot;does not contain&quot; includes &quot;is not
        there at all&quot;. A missing aud is not a neutral state. It is a wrong value.
      </p>

      <h2 className={H2}>Why the first audience check misses it</h2>
      <p>
        <Link href="/docs/audience-001" className={A}>
          AUDIENCE-001
        </Link>{' '}
        sends a token minted for a sibling resource. The server with the two-line check sees
        <code>aud = &quot;https://other-service&quot;</code>, enters the condition and rejects.
        Pass. The scanner moves on.
      </p>
      <p>
        AUDIENCE-002 sends a token with no aud at all. Same server, same code path, different
        branch: <code>aud = undefined</code>, condition false, reject never runs. Accepted.
        Critical finding.
      </p>
      <p>
        One check without the other would miss this class of server entirely. The two cover a
        small matrix together.
      </p>

      <h2 className={H2}>How to run it</h2>
      <pre className={PRE}>
        <code>{`npx -y @patchbay-nebius/agent audit https://mcp.example.com/mcp \\
  --probe-missing-aud=$NO_AUD_TOKEN`}</code>
      </pre>
      <p>
        You mint <code>NO_AUD_TOKEN</code> on your own authorization server by requesting a token
        without a <code>resource</code> parameter. The token must be signed by the same
        authorization server the MCP server trusts. patchbay sends one <code>tools/list</code>{' '}
        with that token in the <code>Authorization</code> header and records what the server does.
      </p>
      <p>
        If the server returns 401 or 403, it passed. If it returns 200 with a tools list, it
        accepts tokens without an aud claim.{' '}
        <Link href="/docs/audience-002" className={A}>
          AUDIENCE-002
        </Link>{' '}
        fires critical.
      </p>

      <h2 className={H2}>The fix</h2>
      <p>
        Rewrite the check so a missing claim is a reject, not a pass-through:
      </p>
      <pre className={PRE}>
        <code>
{`// single-string aud
if (aud !== me) return reject(401)

// array aud
if (!Array.isArray(aud) || !aud.includes(me)) return reject(401)`}
        </code>
      </pre>
      <p>
        If your authorization server has a way to require the <code>resource</code> parameter on
        every token request, enable it. That removes the ability to issue aud-less tokens at the
        source and gives you a second line of defence in case a future resource server slips
        again.
      </p>

      <h2 className={H2}>Why probes like this stay opt-in</h2>
      <p>
        The check needs a real signed token. patchbay does not have your authorization server&apos;s
        signing key and should not. That is the whole point of an opt-in probe: the person running
        the audit mints a single short-lived token on their own authorization server, passes it in
        by flag. The probe reuses it for one request.
      </p>
      <p>
        If you ship an MCP server and your <code>tools/list</code> is behind authentication, pass
        a bearer token in with <code>--auth</code> as well so the rest of the checks can see the
        same surface the authenticated client sees. Then the missing-aud probe is one more flag
        next to it.
      </p>
      <p>
        The other follow-up probe this unlocked is the headless OAuth 2.1 conformance battery,
        which tests what the <code>/authorize</code> endpoint accepts in practice. If you run one,
        consider running the other.{' '}
        <Link href="/blog/four-oauth-checks-mcp-authorization-endpoint" className={A}>
          That post is here
        </Link>
        .
      </p>
    </>
  )
}

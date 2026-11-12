import Link from 'next/link'

const A = 'text-ink underline underline-offset-4 hover:text-ink'
const H2 = 'text-xl font-semibold text-ink mt-12 mb-4'
const TD = 'border border-paper-line px-3 py-2 text-left align-top'
const TH = 'border border-paper-line px-3 py-2 text-left bg-paper-card text-ink'

export function McpTransportSecurityOneWeekLater() {
  return (
    <>
      <p>
        Last week I scanned 277 public MCP servers and{' '}
        <Link href="/blog/state-of-mcp-auth-nov-2026" className={A}>
          wrote about the OAuth 2.1 posture
        </Link>
        . The post focused on what the authorization story looked like. It did not look at
        transport. This week it does, because the scanner now has four new passive checks that
        read the response headers and the authorization server metadata without sending a single
        extra request.
      </p>
      <p>
        I re-scanned the same host list. 130 servers were reachable in both the earlier sweep and
        today&apos;s. Those 130 are the cohort for everything below. The number that surprised me
        is not small.
      </p>

      <h2 className={H2}>One check, 121 of 125 reachable servers</h2>
      <p>
        <Link href="/docs/headers-001" className={A}>
          HEADERS-001
        </Link>{' '}
        fires when the initialize response is missing one of four standard transport-security
        headers: Strict-Transport-Security on HTTPS, X-Frame-Options or a Content-Security-Policy
        frame-ancestors directive, X-Content-Type-Options nosniff, or a wildcard Access-Control
        combination.
      </p>
      <p>
        121 of the 125 servers that were reachable this week trigger at least one of those four.
        That is 96.8 percent. Only 4 servers had clean transport-security headers. 5 servers were
        not reachable this time and could not be evaluated, which is why the denominator is 125
        and not 130.
      </p>
      <p>
        These are not checks that cost anything. Each header is one line of configuration on the
        reverse proxy or in the server&apos;s response code. The reason the number is this high
        is that nobody is used to treating an MCP endpoint as a web service that lives in a
        browser threat model. Agents do not live in browsers today, but the endpoint is still
        reachable from one and the defences cost nothing to add.
      </p>

      <h2 className={H2}>The three smaller surprises</h2>
      <table className="w-full border-collapse my-4 text-sm">
        <thead>
          <tr>
            <th className={TH}>Check</th>
            <th className={TH}>Last week</th>
            <th className={TH}>This week</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={TD}>
              <Link href="/docs/resource-001" className={A}>RESOURCE-001</Link>{' '}
              (Protected Resource Metadata missing)
            </td>
            <td className={TD}>0</td>
            <td className={TD}>6</td>
          </tr>
          <tr>
            <td className={TD}>
              <Link href="/docs/iss-001" className={A}>ISS-001</Link>{' '}
              (RFC 9207 iss parameter not advertised)
            </td>
            <td className={TD}>0</td>
            <td className={TD}>6</td>
          </tr>
          <tr>
            <td className={TD}>
              <Link href="/docs/auth-007" className={A}>AUTH-007</Link>{' '}
              (invalid bearer returns wrong HTTP status)
            </td>
            <td className={TD}>0</td>
            <td className={TD}>3</td>
          </tr>
        </tbody>
      </table>
      <p>
        These three are low cost to fix and low ceiling: they catch the narrower end of what the
        spec requires or recommends. The reason the counts are low is that the servers this
        catches are a specific class. RESOURCE-001 fires only on servers that advertise OAuth and
        still omit the Protected Resource Metadata document. ISS-001 only on servers whose
        metadata is otherwise clean enough to read. AUTH-007 only on servers that bother to reject
        an invalid token at all. Each count is a count of near misses, not a count of broken
        servers.
      </p>

      <h2 className={H2}>Ten hosts lost a grade purely from the new signals</h2>
      <p>
        No new check fires on code these servers did not already have. The grade shift below is
        only the four passive signals that used to be invisible to the scanner.
      </p>
      <table className="w-full border-collapse my-4 text-sm">
        <thead>
          <tr>
            <th className={TH}>Host</th>
            <th className={TH}>Last week</th>
            <th className={TH}>This week</th>
          </tr>
        </thead>
        <tbody>
          <tr><td className={TD}>api.githubcopilot.com/mcp</td><td className={TD}>A</td><td className={TD}>C</td></tr>
          <tr><td className={TD}>mcp.sentry.io</td><td className={TD}>A</td><td className={TD}>C</td></tr>
          <tr><td className={TD}>crashstory.com/mcp</td><td className={TD}>A</td><td className={TD}>C</td></tr>
          <tr><td className={TD}>mcp.supabase.com/mcp</td><td className={TD}>A</td><td className={TD}>B</td></tr>
          <tr><td className={TD}>mcp.sentry.dev/mcp</td><td className={TD}>A</td><td className={TD}>B</td></tr>
          <tr><td className={TD}>mcp.deepwiki.com/mcp</td><td className={TD}>A</td><td className={TD}>B</td></tr>
          <tr><td className={TD}>mcp.semgrep.ai/mcp</td><td className={TD}>A</td><td className={TD}>B</td></tr>
          <tr><td className={TD}>mcp-server.egnyte.com/sse</td><td className={TD}>A</td><td className={TD}>B</td></tr>
          <tr><td className={TD}>game.spacemolt.com/mcp</td><td className={TD}>A</td><td className={TD}>B</td></tr>
          <tr><td className={TD}>mcp.roundtable.now/mcp</td><td className={TD}>D</td><td className={TD}>F</td></tr>
        </tbody>
      </table>
      <p>
        The pattern is consistent: the grade shift is HEADERS-001 for almost everyone, plus
        RESOURCE-001 or AUTH-007 for the ones that drop two notches. None of these servers have
        broken something they had working. The scanner got a new eye.
      </p>

      <h2 className={H2}>What this is not</h2>
      <p>
        These numbers are not a benchmark of MCP server quality. They are a measurement of what
        four cheap checks catch on a public cohort today. A grade is an aggregate: a server with
        strong authentication and weak transport headers ends up next to a server with weak
        authentication and strong transport headers. The report page for each host is where the
        details live.
      </p>
      <p>
        The scan also did not run the four new active checks against anyone. Those probes register
        clients and send crafted <code>/authorize</code> requests; they are safe against your own
        server and rude against someone else&apos;s. The{' '}
        <Link href="/blog/four-oauth-checks-mcp-authorization-endpoint" className={A}>
          headless OAuth battery
        </Link>{' '}
        is opt-in for a reason and I kept it off for this sweep.
      </p>

      <h2 className={H2}>Run your own</h2>
      <p>If your MCP server is in that list of ten, or it is not and you want to be sure:</p>
      <pre className="rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto my-4">
        <code>npx -y @patchbay-nebius/agent audit https://mcp.example.com/mcp</code>
      </pre>
      <p>
        No credentials, no flags, no account. The scan takes eight seconds and the report page is
        public for 90 days, which makes it easy to send to the person on your team who owns the
        reverse proxy.
      </p>
      <p>
        Next sweep is next week. I will keep the same host list so the week-over-week comparison
        stays honest.
      </p>
    </>
  )
}

import Link from 'next/link'

const A = 'text-ink underline underline-offset-4 hover:text-ink'
const H2 = 'text-xl font-semibold text-ink mt-12 mb-4'
const PRE = 'rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto my-4'

export function WhyYourMcpServerGotAnFDcrOpenRedirect() {
  return (
    <>
      <p>
        Part 1 of 6. The single most common F-trigger in our 23 Nov 2026 sweep of 1,379 reachable
        public MCP servers (of 1,455 total).
      </p>

      <h2 className={H2}>What the finding looks like</h2>
      <p>
        Your MCP server advertises Dynamic Client Registration per RFC 7591. An agent POSTs a
        client registration to <code>/oauth/register</code> with some redirect URIs and gets back a{' '}
        <code>client_id</code> plus <code>client_secret</code>. That is the spec.
      </p>
      <p>
        The failure mode: <code>/oauth/register</code> accepts any <code>https://</code> redirect
        URI without allowlist or operator review.
      </p>
      <p>
        Patchbay verifies live during a scan by POSTing a controlled test URI (
        <code>https://evil-phishing-site-fake.tld/stolen-codes</code>) against the registration
        endpoint. If the response comes back <code>201 Created</code> with full client credentials,
        the server has shipped open DCR.
      </p>

      <h2 className={H2}>Why patchbay grades this an F</h2>
      <p>
        Open DCR is RFC 7591-compliant. A strictly-compliant checker would not flag it. Patchbay
        does, because in production this is the shape of the attack it enables:
      </p>
      <ol className="list-decimal list-inside space-y-2 my-4 text-ink-soft">
        <li>
          Attacker calls <code>/oauth/register</code> on your server with{' '}
          <code>redirect_uri = https://attacker.example</code>. Gets back a valid{' '}
          <code>client_id</code>.
        </li>
        <li>
          Attacker sends a victim a link to your real <code>/authorize</code> endpoint, with the
          attacker's <code>client_id</code>. The consent screen looks legitimate because it IS on
          your domain.
        </li>
        <li>
          Victim consents, the auth code redirects to <code>https://attacker.example</code>.
        </li>
        <li>
          Attacker exchanges the code for a token with real scope against your API.
        </li>
      </ol>
      <p>
        The victim never left your domain until the final redirect. Browser history shows your
        legitimate OAuth flow. This is a phishing path that bypasses every "check the URL bar" rule
        a user ever learned.
      </p>

      <h2 className={H2}>The fix is four lines</h2>
      <p>Pseudo-code for the DCR handler:</p>
      <pre className={PRE}>
{`if (!isAllowedRedirectPattern(req.body.redirect_uris)) {
  return http400({ error: "invalid_redirect_uri" })
}
if (isNewClientName(req.body.client_name)) {
  queueOperatorApproval(req.body)
  return http202({ status: "pending_operator_approval" })
}`}
      </pre>
      <p>Specifics that matter:</p>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li>
          Allowlist entries are exact prefixes on YOUR domain(s), not wildcard subdomains
        </li>
        <li>
          Operator-approval queue can be a Linear ticket, a Slack notification, or a dashboard
          button
        </li>
        <li>
          The consent UI MUST display the exact <code>client_name</code> and <code>logo_uri</code>{' '}
          from the registration so the victim sees "Attacker App wants access" not just your logo
        </li>
      </ul>

      <h2 className={H2}>What happens on next rescan</h2>
      <p>
        Patchbay reruns passively against every public MCP server weekly. The fix lands, your grade
        updates the following Monday. On the hosted plan you get a diff email the day it changes.
      </p>
      <p>
        <Link
          href="/early-access?ref=blog-f-series-01"
          className={A}
        >
          Join the Founding 100 waitlist
        </Link>{' '}
        to get the diff email the week your server flips F to C.
      </p>

      <h2 className={H2}>Real public examples from the Nov 2026 sweep</h2>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li>
          <strong>DoneThat</strong> (<code>mcp.donethat.ai</code>): flagged, team responded same
          week confirming it was on their roadmap.{' '}
          <a href="https://patchbay-mcp.dev/report/d0h6NZbvAh" className={A}>
            Public report
          </a>
          .
        </li>
        <li>
          <strong>Angelcam</strong> (<code>mcp.angelcam.com/readonly</code>): flagged, their
          AngelBot (an AI agent) forwarded the finding to their API team.{' '}
          <a href="https://patchbay-mcp.dev/report/WkXytg3hbM" className={A}>
            Public report
          </a>
          .
        </li>
      </ul>

      <h2 className={H2}>Audit your own server right now</h2>
      <pre className={PRE}>
{`npx -y @patchbay-nebius/agent audit https://your-mcp.example.com/mcp`}
      </pre>
      <p>
        The DCR-OPEN-REDIRECT check runs automatically. Grade + SARIF + markdown report in under 20
        seconds. MIT licensed. Report URL stays private until you publish it.
      </p>
      <p>
        Star the repo to track upcoming checks:{' '}
        <a href="https://github.com/GodSmasher/patchbay" className={A}>
          github.com/GodSmasher/patchbay
        </a>
        .
      </p>
      <p>
        Next in this series: SCOPE-001, why <code>mcp:write</code> for every tool is also an F.
      </p>
    </>
  )
}

import Link from 'next/link'

const A = 'text-ink underline underline-offset-4 hover:text-ink'
const H2 = 'text-xl font-semibold text-ink mt-12 mb-4'
const PRE = 'rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto my-4'

export function McpServerTransportSecurityHeaders() {
  return (
    <>
      <p>
        An MCP server over HTTP is a web service. Any browser that can reach it inherits the same
        attack surface every other web service has. That surface is shaped by four response
        headers you can set in under an hour and most MCP servers I scanned did not.
      </p>
      <p>
        The new HEADERS-001 check reads the response headers from the initialize probe and
        reports one finding per gap. Four gaps to know about.
      </p>

      <h2 className={H2}>Wildcard CORS plus credentials</h2>
      <p>
        If your server replies with <code>Access-Control-Allow-Origin: *</code> together with{' '}
        <code>Access-Control-Allow-Credentials: true</code>, every modern browser rejects the
        combination. The reason: it would let any page on the internet read authenticated
        responses from your server through the user&apos;s cookies. Browsers block it at the
        client, but a server that advertises it anyway is signalling that it did not think about
        this. Often the pairing sits under an authentication bypass that treats requests from any
        origin as trusted.
      </p>
      <p>
        <code>Access-Control-Allow-Origin: *</code> on its own is milder. It opens the server to
        any browser origin that wants to read responses that do not carry credentials. That is
        fine for a fully public read-only endpoint and misleading for everything else.
      </p>

      <h2 className={H2}>No Strict-Transport-Security on HTTPS</h2>
      <p>
        HSTS tells browsers to never talk to your host over plain HTTP again. Without the header,
        the first connection a user ever makes to your MCP server over HTTPS is still open to a
        downgrade attack if someone can intercept it. The fix is one header on the first response:
      </p>
      <pre className={PRE}>
        <code>Strict-Transport-Security: max-age=15552000; includeSubDomains</code>
      </pre>
      <p>
        15552000 seconds is 180 days. Adjust to your taste; one week is the lower bound at which
        the protection is worth having.
      </p>

      <h2 className={H2}>No X-Frame-Options and no frame-ancestors</h2>
      <p>
        An MCP server that returns an error page or a status page can be embedded in a hidden
        iframe on an attacker&apos;s site. If the error page shows anything a signed-in user would
        see, a clickjacking overlay can steer them into actions on your site. The fix is either
        of:
      </p>
      <pre className={PRE}>
        <code>X-Frame-Options: DENY</code>
      </pre>
      <pre className={PRE}>
        <code>{`Content-Security-Policy: frame-ancestors 'none'`}</code>
      </pre>
      <p>
        The check passes if either one is restrictive. A Content-Security-Policy whose{' '}
        <code>frame-ancestors</code> directive is literally <code>*</code> does not count; that is
        no restriction at all.
      </p>

      <h2 className={H2}>No X-Content-Type-Options</h2>
      <p>
        Without <code>X-Content-Type-Options: nosniff</code> the browser can MIME-sniff a response
        and treat it as a different type than the Content-Type header said. A JSON error body can
        be sniffed as HTML and script tags inside it can run. This is a one-line fix that costs
        nothing, so the check fires if the header is absent or not <code>nosniff</code>.
      </p>

      <h2 className={H2}>How the check runs</h2>
      <pre className={PRE}>
        <code>npx -y @patchbay-nebius/agent audit https://mcp.example.com/mcp</code>
      </pre>
      <p>
        <Link href="/docs/headers-001" className={A}>
          HEADERS-001
        </Link>{' '}
        is passive. It uses the response headers that the initialize probe already captured, so no
        extra request goes to your server. Any gap aggregates into a single finding at medium
        severity with a bulleted evidence block, so your report does not fragment into four
        separate lines.
      </p>
      <p>
        The check skips HSTS on plain-HTTP targets because{' '}
        <Link href="/docs/transport-001" className={A}>
          TRANSPORT-001
        </Link>{' '}
        already catches those. And it stays silent on servers that are not reachable at all.
      </p>

      <h2 className={H2}>What the check does not catch</h2>
      <p>
        Headers are shallow. A server can set all four correctly and still mishandle cookies,
        still accept a CSRF token on any origin, still serve mixed-content assets. HEADERS-001
        catches the low-hanging fruit. For a thorough browser-side review you want a dedicated
        tool like <a href="https://securityheaders.com" className={A}>securityheaders.com</a> or
        Mozilla Observatory in addition. The point of patchbay is that one audit run touches the
        transport posture at all, so a server that misses the basics does not pass the eye by
        default.
      </p>
      <p>
        One consequence: if your MCP server is called only by server-to-server clients and never
        by a browser, the four gaps carry less weight. The check still fires because it cannot
        tell from the outside who your callers are. Read the evidence block and decide.
      </p>
    </>
  )
}

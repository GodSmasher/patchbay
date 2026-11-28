import Link from 'next/link'

const A = 'text-ink underline underline-offset-4 hover:text-ink'
const H2 = 'text-xl font-semibold text-ink mt-12 mb-4'
const PRE = 'rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto my-4'
const TABLE = 'w-full my-4 text-sm'

export function Headers001DepthUpgrade() {
  return (
    <>
      <p>
        Shipped the first depth-upgrade of patchbay&apos;s Q1 roadmap today. HEADERS-001 now
        checks response-header VALUES, not just whether a header is set at all. This post
        explains what changed, why it matters, and what the cohort re-scan is going to look like.
      </p>

      <h2 className={H2}>the gap the old check had</h2>
      <p>
        Old HEADERS-001 was a presence check: if the server sent back <code>X-Frame-Options</code>{' '}
        (any value), the check passed. The same for <code>X-Content-Type-Options</code>,{' '}
        <code>Strict-Transport-Security</code>, and the CORS wildcard+credentials pair.
      </p>
      <p>
        That meant a server shipping <code>X-Frame-Options: ALLOWALL</code> passed because the
        header was there. Browsers don&apos;t recognise <code>ALLOWALL</code>. The header is
        effectively missing. The server is as framable as one with no{' '}
        <code>X-Frame-Options</code> at all, but our old scan called it fine.
      </p>
      <p>
        This is the shape Adam Johns at trigger.dev spotted a different version of on{' '}
        <Link href="/leaderboard" className={A}>/leaderboard</Link> yesterday. The underlying
        pattern is the same: patchbay was pattern-matching on structure without looking at the
        content. One class of credibility bug for the whole posture-checker category.
      </p>

      <h2 className={H2}>what the new check does</h2>
      <p>11 sub-findings, one per concrete gap, each with its own severity:</p>
      <table className={TABLE}>
        <thead>
          <tr className="border-b border-paper-line text-left">
            <th className="py-2">Sub</th>
            <th className="py-2">What it fires on</th>
            <th className="py-2">Severity</th>
          </tr>
        </thead>
        <tbody className="text-ink-soft">
          <tr className="border-b border-paper-line"><td className="py-2">HEADERS-001.1</td><td className="py-2">X-Frame-Options missing AND no restrictive CSP frame-ancestors</td><td className="py-2">medium</td></tr>
          <tr className="border-b border-paper-line"><td className="py-2">HEADERS-001.2</td><td className="py-2">X-Frame-Options value not exactly <code>DENY</code> or <code>SAMEORIGIN</code></td><td className="py-2">medium</td></tr>
          <tr className="border-b border-paper-line"><td className="py-2">HEADERS-001.3</td><td className="py-2">X-Content-Type-Options missing</td><td className="py-2">medium</td></tr>
          <tr className="border-b border-paper-line"><td className="py-2">HEADERS-001.4</td><td className="py-2">X-Content-Type-Options value not <code>nosniff</code></td><td className="py-2">medium</td></tr>
          <tr className="border-b border-paper-line"><td className="py-2">HEADERS-001.5</td><td className="py-2">Strict-Transport-Security missing on HTTPS</td><td className="py-2"><strong>high</strong></td></tr>
          <tr className="border-b border-paper-line"><td className="py-2">HEADERS-001.6</td><td className="py-2">HSTS max-age below 10,368,000 seconds (120 days, OWASP floor)</td><td className="py-2">medium</td></tr>
          <tr className="border-b border-paper-line"><td className="py-2">HEADERS-001.7</td><td className="py-2">HSTS missing includeSubDomains</td><td className="py-2">low</td></tr>
          <tr className="border-b border-paper-line"><td className="py-2">HEADERS-001.8</td><td className="py-2">CSP contains <code>unsafe-inline</code> without a nonce, hash, or strict-dynamic exception</td><td className="py-2">medium</td></tr>
          <tr className="border-b border-paper-line"><td className="py-2">HEADERS-001.9</td><td className="py-2">CSP contains <code>unsafe-eval</code></td><td className="py-2">medium</td></tr>
          <tr className="border-b border-paper-line"><td className="py-2">HEADERS-001.10</td><td className="py-2">Referrer-Policy weak (unsafe-url, no-referrer-when-downgrade, origin-when-cross-origin)</td><td className="py-2">low</td></tr>
          <tr className="border-b border-paper-line"><td className="py-2">HEADERS-001.11</td><td className="py-2">CORS <code>Access-Control-Allow-Origin: *</code> with <code>Access-Control-Allow-Credentials: true</code></td><td className="py-2"><strong>critical</strong></td></tr>
        </tbody>
      </table>
      <p>
        The severity for each sub-finding stays conservative. HSTS missing is high (first-contact
        TLS stripping is a real primitive). CORS wildcard with credentials is critical
        (browser-rejected anti-pattern that almost always signals a real auth-bypass misconfig).
        The rest are medium or low depending on actual exploit primitive.
      </p>

      <h2 className={H2}>what the sample re-scan found</h2>
      <p>
        Pre-full-cohort re-scan, we ran the new check against a 100-host sample from the current
        6,225. 98 reachable. Per-sub-finding fire rate:
      </p>
      <pre className={PRE}>{`HEADERS-001.1  (XFO missing)                70
HEADERS-001.2  (XFO invalid value)           2   ← new gap, old check missed
HEADERS-001.3  (XCTO missing)               60
HEADERS-001.4  (XCTO invalid value)          3   ← new gap, old check missed
HEADERS-001.5  (HSTS missing HTTPS)         59
HEADERS-001.7  (HSTS no includeSubDomains)   8
HEADERS-001.8  (CSP unsafe-inline)          10
HEADERS-001.9  (CSP unsafe-eval)             1
HEADERS-001.10 (Referrer weak)               1
HEADERS-001.11 (CORS *+credentials)          1   ← same gap, severity upgraded to critical`}</pre>
      <p>
        6 hosts in this sample (2 XFO-invalid + 3 XCTO-invalid + 1 CORS) would have passed the
        old presence-only check. They fire sub-findings now.
      </p>
      <p>
        Extrapolated to the full cohort of 6,225, the shape we expect post-full-rescan:
      </p>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li>~127 new medium findings from invalid X-Frame-Options values</li>
        <li>~190 new medium findings from invalid X-Content-Type-Options values</li>
        <li>~63 new critical findings from the CORS wildcard+credentials pattern that was previously surfaced as medium</li>
      </ul>
      <p>
        These are projections from a small sample. Sunday&apos;s weekly cron does the full-cohort
        re-scan and we&apos;ll post the exact numbers in next week&apos;s digest.
      </p>

      <h2 className={H2}>why grades are going to shift</h2>
      <p>
        Hosts that previously had one aggregated HEADERS-001 medium finding may now accumulate
        3-5 separate findings. The scoring impact per host grows from -5 points to -15 to -25
        depending on the header stack.
      </p>
      <p>Expected direction of the grade shift:</p>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li>Hosts at B or C with multiple sub-gaps may drop one letter</li>
        <li>Hosts with the CORS wildcard+credentials pattern jump from medium contribution to critical, which can move the host multiple letters</li>
        <li>Hosts that had their headers correct stay exactly where they were</li>
        <li>Hosts already at F stay at F</li>
      </ul>
      <p>
        This is a scoring methodology change, not a change in the threat model. The hosts
        haven&apos;t gotten worse. The scanner started measuring the actual severity of the
        header posture instead of the presence of configuration.
      </p>
      <p>
        If you operate an MCP server and see your grade drop in Monday&apos;s digest, the
        per-check detail page shows which sub-finding fired and how to fix it. The fixes are the
        same one-line header value corrections they always were.
      </p>

      <h2 className={H2}>what&apos;s next in the depth-upgrade pass</h2>
      <p>HEADERS-001 is the first of four Q1 targets. Same methodology applies to:</p>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li><strong>RESOURCE-001</strong> (Protected Resource Metadata): schema validation + authorization-server reachability test, not just file presence</li>
        <li><strong>PKCE-001</strong>: actual OAuth-flow enforcement test with broken PKCE params, not just metadata advertisement</li>
        <li><strong>AUTH-001</strong> (heavy-write unauth): behavioural verification with side-effect safeguards. This is the biggest one and needs a careful dry-run-first design so patchbay doesn&apos;t accidentally mutate state on servers it scans.</li>
      </ul>
      <p>
        Rough timeline: RESOURCE-001 next, PKCE-001 after that, AUTH-001 last and most carefully.
      </p>

      <h2 className={H2}>scope we deliberately didn&apos;t cover</h2>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li>
          <strong>Semantic CSP analysis</strong> (whether a given policy is actually restrictive
          for the operator&apos;s use case, nonce-vs-tag verification) belongs in a separate
          HEADERS-002 check if there&apos;s demand
        </li>
        <li>
          <strong>Browser-behavioural testing</strong> (does Chrome actually honour this
          X-Frame-Options value) stays out of scope. The scanner stays deterministic and runs
          without a browser instance
        </li>
        <li>
          <strong>Permissions-Policy</strong> sub-finding isn&apos;t included because the browser
          default when the header is absent is already restrictive. Missing the header
          isn&apos;t a security gap. If an operator sets it to something permissive that would
          be a different check
        </li>
      </ul>
      <p>
        If you see a header-posture issue you think patchbay should catch and currently
        doesn&apos;t, send it to{' '}
        <a href="mailto:sarah@patchbay-mcp.dev" className={A}>sarah@patchbay-mcp.dev</a>.
        HEADERS-002 scope is open.
      </p>

      <h2 className={H2}>scan your own server</h2>
      <pre className={PRE}>{`npx -y @patchbay-nebius/agent audit https://your-server.example.com`}</pre>
      <p>
        The CLI ships the same checks as the public leaderboard. Per-sub-finding detail is in
        the output. MIT licensed, runs locally, no telemetry.
      </p>
      <p>
        Leaderboard: <Link href="/leaderboard" className={A}>patchbay-mcp.dev/leaderboard</Link>.
        Per-check docs: <Link href="/docs" className={A}>patchbay-mcp.dev/docs</Link>.
      </p>
      <p>
        Corrections, pushback on methodology, or sub-findings you&apos;d design differently all
        go to <a href="mailto:sarah@patchbay-mcp.dev" className={A}>sarah@patchbay-mcp.dev</a>.
      </p>
    </>
  )
}

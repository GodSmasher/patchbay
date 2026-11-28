import Link from 'next/link'

const A = 'text-ink underline underline-offset-4 hover:text-ink'
const H2 = 'text-xl font-semibold text-ink mt-12 mb-4'
const TABLE = 'w-full my-4 text-sm'

export function UnauthWriteToolsBreakdown() {
  return (
    <>
      <p>
        In the <Link href="/blog/state-of-mcp-security-november-2026" className={A}>State of MCP
        Security</Link> post last week we said 555 public MCP servers exposed at least one
        heavy-write tool over <code>tools/list</code> without authentication. Deep (
        <a href="https://x.com/deeponailabs" target="_blank" rel="noopener noreferrer" className={A}>@deeponailabs</a>)
        asked a fair follow-up on X: name the tools. That list is the useful part.
      </p>
      <p>
        This post does that. 565 hosts in the current cohort (the 555 figure from the X-post
        grew by 10 when a late sweep landed before we published{' '}
        <Link href="/cve/CVE-PATCHBAY-2026-0002" className={A}>CVE-PATCHBAY-2026-0002</Link>),
        matched against a 26-verb vocabulary. Verb counts, five sample tool names per verb,
        no host identifiers. The embargo on operator identifiers runs until 2027-02-26 per
        the coordinated-disclosure window on the CVE; this breakdown stays on the tool side.
      </p>

      <h2 className={H2}>what the scanner actually looks at</h2>
      <p>
        AUTH-001 fires critical when a server returns a non-empty <code>tools/list</code> to
        an unauthenticated JSON-RPC call and at least one tool name token-matches a heavy-write
        verb. The 26 verbs: <code>delete</code>, <code>send</code>, <code>transfer</code>,{' '}
        <code>create</code>, <code>update</code>, <code>publish</code>, <code>deploy</code>,{' '}
        <code>revoke</code>, <code>approve</code>, <code>remove</code>, <code>cancel</code>,{' '}
        <code>refund</code>, <code>invite</code>, <code>archive</code>, <code>restore</code>,{' '}
        <code>destroy</code>, <code>pay</code>, <code>charge</code>, <code>write</code>,{' '}
        <code>post</code>, <code>push</code>, <code>merge</code>, <code>close</code>,{' '}
        <code>open</code>, <code>assign</code>, <code>grant</code>.
      </p>
      <p>
        Tool names split on non-word boundaries then compared as whole tokens. A tool called{' '}
        <code>create_order</code> matches <code>create</code>. A tool called{' '}
        <code>get_recreated_date</code> does not (<code>recreated</code> is one token, not
        <code>create</code>). Of the 565-host cohort, 559 returned a usable{' '}
        <code>tools/list</code> on re-scan and 556 of those had at least one heavy-verb match.
      </p>
      <p>
        The scanner never issues a <code>tools/call</code>. What follows is name-pattern
        inference about tool behaviour, which is a weaker claim than observed behaviour.
        We explain where that matters below.
      </p>

      <h2 className={H2}>the ten verbs with unambiguous mutation intent</h2>
      <p>
        Ordered by host-count. &quot;Hosts&quot; = unique hosts in the cohort that expose at
        least one tool whose name contains the verb as a whole token. The same host can appear
        in several rows.
      </p>
      <table className={TABLE}>
        <thead>
          <tr>
            <th className="text-left pb-2 pr-4">verb</th>
            <th className="text-right pb-2 pr-4">hosts</th>
            <th className="text-left pb-2">three sample tool names</th>
          </tr>
        </thead>
        <tbody>
          <tr><td className="pr-4 py-1"><code>delete</code></td><td className="text-right pr-4">118</td><td><code>delete_webhook, delete_monitor, delete_project</code></td></tr>
          <tr><td className="pr-4 py-1"><code>send</code></td><td className="text-right pr-4">111</td><td><code>send_message, send_feedback, send_email</code></td></tr>
          <tr><td className="pr-4 py-1"><code>cancel</code></td><td className="text-right pr-4">65</td><td><code>cancel_booking, cancel_order, cancel_request</code></td></tr>
          <tr><td className="pr-4 py-1"><code>publish</code></td><td className="text-right pr-4">51</td><td><code>publish_post, publish_page, publish_app</code></td></tr>
          <tr><td className="pr-4 py-1"><code>revoke</code></td><td className="text-right pr-4">20</td><td><code>revoke_api_key, revoke_project_invite, revoke_oauth_grant</code></td></tr>
          <tr><td className="pr-4 py-1"><code>transfer</code></td><td className="text-right pr-4">19</td><td><code>create_transfer_order, subaccount_transfer, check_transfer_order</code></td></tr>
          <tr><td className="pr-4 py-1"><code>approve</code></td><td className="text-right pr-4">19</td><td><code>approve_post, approve, approve_conversion</code></td></tr>
          <tr><td className="pr-4 py-1"><code>deploy</code></td><td className="text-right pr-4">10</td><td><code>deploy, deploy_site, wait_for_deploy</code></td></tr>
          <tr><td className="pr-4 py-1"><code>refund</code></td><td className="text-right pr-4">7</td><td><code>refund_buyer, process_refund, submit_refund</code></td></tr>
          <tr><td className="pr-4 py-1"><code>charge</code></td><td className="text-right pr-4">1</td><td><code>charge_saved_card</code></td></tr>
        </tbody>
      </table>
      <p>
        <code>send</code> and <code>delete</code> together cover roughly 40% of the cohort.
        <code> cancel</code> and <code>publish</code> together another 20%. <code>charge</code>
        {' '}only surfaces on one host, which matches the broader pattern: payment-side servers
        are rare in public MCP discovery registries, and the ones that exist mostly expose
        read-only lookup tools rather than tools named <code>charge_*</code>.
      </p>

      <h2 className={H2}>the fifteen verbs where token-match is less clean</h2>
      <p>
        These verbs fire the scanner but the tool is sometimes named around a read action.
        <code> create_pay_link</code> is a mutation; <code>how_to_pay</code> is not.{' '}
        <code>post_message</code> is a mutation; <code>get_taiwan_post</code> is not. The
        cohort counts and samples are honest about this.
      </p>
      <table className={TABLE}>
        <thead>
          <tr>
            <th className="text-left pb-2 pr-4">verb</th>
            <th className="text-right pb-2 pr-4">hosts</th>
            <th className="text-left pb-2">three sample tool names</th>
          </tr>
        </thead>
        <tbody>
          <tr><td className="pr-4 py-1"><code>create</code></td><td className="text-right pr-4">337</td><td><code>create_checkout, create_project, create_order</code></td></tr>
          <tr><td className="pr-4 py-1"><code>update</code></td><td className="text-right pr-4">145</td><td><code>update_profile, update_task, update_project</code></td></tr>
          <tr><td className="pr-4 py-1"><code>post</code></td><td className="text-right pr-4">102</td><td><code>post_message, create_post, post_tweet</code></td></tr>
          <tr><td className="pr-4 py-1"><code>remove</code></td><td className="text-right pr-4">52</td><td><code>remove_member, remove_background, remove_domain</code></td></tr>
          <tr><td className="pr-4 py-1"><code>open</code></td><td className="text-right pr-4">42</td><td><code>open_dispute, open_quotes, open_image_editor</code></td></tr>
          <tr><td className="pr-4 py-1"><code>write</code></td><td className="text-right pr-4">27</td><td><code>memory_write, journal_write, files_write</code></td></tr>
          <tr><td className="pr-4 py-1"><code>pay</code></td><td className="text-right pr-4">25</td><td><code>create_pay_link, pay_subscription, how_to_pay</code></td></tr>
          <tr><td className="pr-4 py-1"><code>invite</code></td><td className="text-right pr-4">24</td><td><code>invite_member, create_invite, send_invite</code></td></tr>
          <tr><td className="pr-4 py-1"><code>archive</code></td><td className="text-right pr-4">24</td><td><code>archive_task, search_archive, archive_app</code></td></tr>
          <tr><td className="pr-4 py-1"><code>close</code></td><td className="text-right pr-4">18</td><td><code>close_poll, close_session, close_room</code></td></tr>
          <tr><td className="pr-4 py-1"><code>restore</code></td><td className="text-right pr-4">17</td><td><code>restore_version, restore_task, restore_revision</code></td></tr>
          <tr><td className="pr-4 py-1"><code>merge</code></td><td className="text-right pr-4">9</td><td><code>merge_pdf, merge_persons, merge_terms</code></td></tr>
          <tr><td className="pr-4 py-1"><code>push</code></td><td className="text-right pr-4">5</td><td><code>push_quote, push_live_app, push_plan</code></td></tr>
          <tr><td className="pr-4 py-1"><code>assign</code></td><td className="text-right pr-4">5</td><td><code>assign_label, assign_moderator, assign_thread</code></td></tr>
          <tr><td className="pr-4 py-1"><code>grant</code></td><td className="text-right pr-4">5</td><td><code>grant_propose, grant_transition, set_display_grant</code></td></tr>
        </tbody>
      </table>
      <p>
        <code>create</code> is where overcounting is most visible. 337 of 559 reachable hosts
        exposed at least one <code>create_*</code> tool, and many of those are legitimate
        scaffolding verbs (<code>create_setup_link</code>, <code>create_api_key</code>) rather
        than live financial or user-facing mutations. The severity-matrix in AUTH-001 already
        downgrades scaffolding-only tools to high rather than critical; servers only reach
        this cohort when at least one tool carries one of the ten unambiguous verbs above or
        one of these fifteen in a mutation-shaped name.
      </p>

      <h2 className={H2}>why the severity is critical even for a CRUD-only server</h2>
      <p>
        A tool exposed over <code>tools/list</code> without authentication can be invoked by
        any client that knows the endpoint URL. An MCP host app (Claude, Cursor, Gemini CLI)
        will typically prompt the user before invoking a tool. An attacker will not use a host
        app. They will use any MCP client, including a curl one-liner, and the prompt never
        runs.
      </p>
      <p>
        The exposure is the credential boundary, not the prompt. <code>create_order</code>{' '}
        with no auth lets any internet caller create orders attributed to whoever owns the
        server&apos;s downstream credentials. <code>send_message</code> with no auth lets any
        internet caller send messages from the server&apos;s connected accounts.{' '}
        <code>deploy_site</code> with no auth lets any internet caller trigger a deploy.
      </p>
      <p>
        Scaffolding-only tools like <code>create_api_key</code> for an ephemeral dev session
        are a narrower blast radius. The severity-matrix handles that: those stay high, not
        critical. The 565-host cohort in this breakdown specifically failed the matrix and
        landed in critical.
      </p>

      <h2 className={H2}>fix</h2>
      <p>
        Gate <code>tools/list</code> behind the same credential required for{' '}
        <code>tools/call</code>. Return 401 with a <code>WWW-Authenticate</code> challenge to
        unauthenticated requests. OAuth 2.1 bearer with a published{' '}
        <code>/.well-known/oauth-protected-resource</code> document (RFC 9728) is the
        compliant mechanism. The <Link href="/mcp-oauth-checklist" className={A}>MCP OAuth
        checklist</Link> covers the full discovery + PKCE + registration setup; the{' '}
        <Link href="/docs/auth-001" className={A}>AUTH-001 docs page</Link> has the recipe
        against common auth stacks (Auth0, Clerk, WorkOS, Fastify, Express).
      </p>
      <p>
        If the server is intentionally public (tools are read-only helpers, no side effects),
        publish <code>/.well-known/ai-catalog.json</code> declaring the no-auth posture; the
        severity-matrix will downgrade the finding to info rather than critical. Transport-layer
        IAM (Google SA, AWS SigV4, Azure AAD) is also recognised and treated as auth.
      </p>

      <h2 className={H2}>self-check</h2>
      <p>
        If you operate an MCP server and want to know whether yours is in this cohort,{' '}
        <Link href="/scan" className={A}>run the browser scan</Link> against your endpoint.
        Takes about 10 seconds. AUTH-001 critical means you&apos;re in the cohort and the clock
        is ticking toward 2027-02-26.
      </p>
      <p>
        <Link href="/methodology" className={A}>Methodology</Link> for the scoring convention
        and confidence tiers; <Link href="/cve/CVE-PATCHBAY-2026-0002" className={A}>
        CVE-PATCHBAY-2026-0002</Link> for the full embargo text and generic fix.
      </p>
    </>
  )
}

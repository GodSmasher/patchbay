import Link from 'next/link'

export const metadata = {
  title: 'Legitimate Interest Assessment · patchbay',
  description: 'GDPR Art 6(1)(f) assessment for direct outreach to MCP server operators.',
}

export default function LIAPage() {
  return (
    <main className="min-h-screen bg-paper text-ink px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <nav className="mb-10 text-sm text-ink-mute">
          <Link href="/scan" className="hover:text-ink">patchbay</Link>
          <span className="mx-2">/</span>
          <span className="text-ink">legitimate-interest-assessment</span>
        </nav>

        <h1 className="text-3xl font-semibold text-ink mb-2">GDPR Legitimate Interest Assessment (LIA)</h1>
        <p className="text-ink-mute text-sm mb-10">Grundlage: Art 6(1)(f) DSGVO. Stand: 2026-11-23.</p>

        <section className="space-y-8 text-ink-soft">
          <div>
            <h2 className="text-xl font-semibold text-ink mb-2">1. Purpose</h2>
            <p>
              patchbay operates a public security audit service for Model Context Protocol (MCP) servers. As part of
              this service we contact operators of public MCP servers to inform them of our findings and offer
              remediation guidance. This LIA covers that direct outreach.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink mb-2">2. Legitimate interest claimed</h2>
            <p>
              Our interest: running a security audit service that creates public benefit by raising the baseline
              security of the MCP ecosystem, and sustaining that service through operator subscriptions and design
              partnerships. Public-interest alignment: operators of MCP servers are generally interested in knowing
              about security issues affecting their service.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink mb-2">3. Necessity</h2>
            <p>
              Publishing findings alone is insufficient: operators do not always monitor our leaderboard. Direct
              outreach is the only reliable mechanism to inform the responsible technical decision maker in a timely
              manner.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink mb-2">4. Balancing test</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>We contact only business email addresses associated with professional roles (CTO, security lead, engineering lead, founder).</li>
              <li>We do not contact private individuals in a personal capacity.</li>
              <li>We contact each recipient only in connection with their professional responsibility for the MCP server we have audited.</li>
              <li>We include a clear opt-out link in every outreach mail and honour unsubscribes immediately.</li>
              <li>We limit cadence: at most 3 follow-ups per recipient over 14 days, then a 90-day cooling-off period.</li>
              <li>We retain outreach records for 24 months after last contact for compliance verification, then delete.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink mb-2">5. Transparency measures</h2>
            <p>
              Scanning methodology public at{' '}
              <Link href="/scanning" className="underline">/scanning</Link>. Every outreach mail names patchbay by
              domain, Sarah Vogel by legal name, and links back to the LIA page and the privacy notice. Every outreach
              mail names the exact finding and the public evidence source.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink mb-2">6. Data categories processed</h2>
            <p>Business email address, professional role (title, company), public findings about the server they are responsible for.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink mb-2">7. Data sources</h2>
            <p>YC batch pages (public), press releases (public), company websites (public), LinkedIn profiles (public), GitHub profiles (public).</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink mb-2">8. Right to object</h2>
            <p>
              Recipients can object at any time by replying &quot;unsubscribe&quot; or &quot;stop&quot; to any outreach
              mail, emailing <a href="mailto:sarah@patchbay-mcp.dev" className="underline">sarah@patchbay-mcp.dev</a>,
              or using the one-click unsubscribe link in the mail footer. Objections honoured immediately. Email
              addresses added to the suppression list and never contacted again.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink mb-2">9. Review</h2>
            <p>This LIA is reviewed every 6 months, or whenever we change our outreach scope.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink mb-2">10. Data controller</h2>
            <p>Sarah Vogel (Leipzig, Germany). Contact: <a href="mailto:sarah@patchbay-mcp.dev" className="underline">sarah@patchbay-mcp.dev</a>.</p>
          </div>
        </section>
      </div>
    </main>
  )
}

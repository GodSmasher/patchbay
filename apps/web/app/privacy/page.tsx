import Link from 'next/link'

export const metadata = {
  title: 'Privacy · patchbay',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-paper text-ink px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <nav className="mb-10 text-sm text-ink-mute">
          <Link href="/scan" className="hover:text-ink">patchbay</Link>
          <span className="mx-2">/</span>
          <span className="text-ink">privacy</span>
        </nav>

        <h1 className="text-3xl font-semibold text-ink mb-2">Privacy</h1>
        <p className="text-ink-mute text-sm mb-10">Last updated 2026-11-06.</p>

        <section className="space-y-6 text-ink-soft">
          <div>
            <h2 className="text-xl font-semibold text-ink mb-2">What we collect</h2>
            <p>Only two things ever leave your browser or your terminal to our servers:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>The MCP server URL you ask us to scan.</strong> Public endpoints only. We never scan anything behind a login.</li>
              <li><strong>Your email, only if you explicitly click Watch</strong> on a report, or submit the early-access form on a blog or docs page (we also store which page the form was on). Nothing on the <code>/scan</code> form is submitted before you press a button.</li>
            </ul>
            <p className="mt-2">We do not run analytics, trackers, third-party scripts, or session recorders on this site. No cookies beyond what Vercel serves for routing.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink mb-2">Where it is stored</h2>
            <p>Both items go into Vercel KV (a hosted Redis). The region is EU-West. We keep scan reports for 90 days and emails on the watch list for 365 days, then both are purged automatically.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink mb-2">Who sees it</h2>
            <p>Sarah Vogel (the founder). No employees, no shared access, no third-party processors beyond the infrastructure vendors needed to run the site (Vercel for hosting, Upstash for KV storage). We do not share your email with anyone, do not sell it and will not ever.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink mb-2">Unsubscribe</h2>
            <p>Every email we send carries a one-click unsubscribe link in the footer. After clicking, your address is marked permanently and we cannot re-add you. If you want your record deleted entirely instead of just flagged, email <a href="mailto:hello@patchbay-mcp.dev" className="text-ink underline underline-offset-4">hello@patchbay-mcp.dev</a> and we will purge it within 7 days.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink mb-2">GDPR requests</h2>
            <p>You have the right to request a copy of what we store about you, correction, or deletion. Email <a href="mailto:hello@patchbay-mcp.dev" className="text-ink underline underline-offset-4">hello@patchbay-mcp.dev</a>. We will respond within 30 days.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink mb-2">The scan itself</h2>
            <p>Running a scan sends one HTTP request chain to the target MCP endpoint. Patchbay does not attempt to exploit, tool-call, or exfiltrate anything. It reads <code>tools/list</code>, probes for OAuth metadata and inspects headers. Nothing destructive.</p>
          </div>
        </section>

        <div className="mt-16 pt-8 border-t border-paper-line">
          <Link href="/scan" className="text-sm text-ink underline underline-offset-4">Back to the scanner</Link>
        </div>
      </div>
    </main>
  )
}

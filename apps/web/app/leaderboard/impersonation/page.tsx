import type { Metadata } from 'next'
import Link from 'next/link'

export const runtime = 'nodejs'
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Registry name-overlap report (under methodology review) · patchbay',
  description: 'The patchbay MCP Registry name-overlap report is under methodology review. Earlier numbers suffered from edit-distance false positives and will be re-published after a stricter v2 pass completes verified spot-checks.',
  alternates: { canonical: '/leaderboard/impersonation' },
  robots: { index: false, follow: false },
}

export default function ImpersonationPage() {
  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'ui-sans-serif, system-ui, sans-serif', lineHeight: 1.6 }}>
      <nav style={{ marginBottom: '1.5rem' }}>
        <Link href="/leaderboard" style={{ color: '#6366f1' }}>← Leaderboard</Link>
      </nav>

      <h1 style={{ fontSize: '1.8rem', margin: '0 0 0.5rem' }}>Registry name-overlap report</h1>
      <p style={{ color: '#a16207', fontWeight: 600, margin: '0 0 1.5rem' }}>Under methodology review — do not cite these numbers.</p>

      <section style={{ padding: '1rem', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, marginBottom: '1.5rem' }}>
        <strong>What happened.</strong> An earlier pass of this report used Levenshtein edit distance 1-2 to flag MCP Registry entries whose names resembled well-known brands. On review, the method produced three classes of flags that were not cleanly separable:
        <ul style={{ marginTop: '0.5rem', marginBottom: 0 }}>
          <li>Real typosquats (e.g. a <code>linaer</code> entry targeting Linear). Legitimate signal.</li>
          <li>Independent products that happen to share a few letters with a brand (<code>openaq</code> is Open Air Quality, not OpenAI; <code>eigma</code> is a separate company, not Figma). False positive.</li>
          <li>Legitimate third-party wrappers that use the brand name as the product noun in a namespace they control (<code>com.hasdata/shopify</code> for HasData&apos;s Shopify client, <code>com.jocktaxes/claude</code> for a third-party Claude integration). These follow a standard Java-style reverse-DNS convention and are not impersonation. False positive.</li>
        </ul>
      </section>

      <p>
        We are rebuilding the detector with a stricter methodology (exact-match-only on brand strings, namespace ownership analysis, repository content signals) and running manual spot-checks before republishing. In the meantime the earlier aggregate numbers are not reliable and are not linked from the leaderboard.
      </p>

      <p>
        The underlying data — the full MCP Registry index and the dual-tier crawl results — stays unchanged and continues to feed the leaderboard and the <Link href="/cve" style={{ color: '#6366f1' }}>CVE database</Link>.
      </p>

      <p>
        If you are an operator whose entry was flagged in an earlier draft of this report and want to request an explicit delisting or add a &quot;third-party wrapper&quot; note, email <a href="mailto:hello@patchbay-mcp.dev">hello@patchbay-mcp.dev</a>.
      </p>

      <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '2rem' }}>
        Code: <a href="https://github.com/GodSmasher/patchbay/blob/main/scripts/detect-impersonation.ts">scripts/detect-impersonation.ts</a>
      </p>
    </main>
  )
}

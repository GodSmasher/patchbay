import Link from 'next/link'

const A = 'text-ink underline underline-offset-4 hover:text-ink'
const H2 = 'text-xl font-semibold text-ink mt-12 mb-4'
const PRE = 'rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto my-4'
const TABLE = 'w-full my-4 text-sm'

export function DepthPassWeek48() {
  return (
    <>
      <p>
        Two days ago patchbay&apos;s public leaderboard showed five scoring buckets:{' '}
        <code>HSTS-MISSING</code>, <code>XFO-MISSING</code>, <code>NOSNIFF-MISSING</code>,{' '}
        <code>DCR-OPEN-HTTPS</code>, <code>ISS-PARAM-MISSING</code>. 38 real checks lived in the{' '}
        <code>audit-core</code> package but the crawler ran its own homemade scorer that never
        called them.
      </p>
      <p>
        This week we closed that gap. Here&apos;s the short version of what shipped and what
        showed up.
      </p>

      <h2 className={H2}>What shipped</h2>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li>
          <strong>Phase A</strong>: crawler now calls <code>tools/list</code>,{' '}
          <code>resources/list</code>, <code>prompts/list</code> and captures{' '}
          <code>advertisedCapabilities</code> + <code>serverInfo</code>. POISONING-001/002/003,
          ANNOTATIONS-001, DEPRECATED-001, SAMPLING-001, URITEMPLATE-001, SDK-CVE-001 can finally
          fire.
        </li>
        <li>
          <strong>Phase B</strong>: DCR loopback probe for tier-2/3 servers. AUTH-006 populated
          at crawl scale.
        </li>
        <li>
          <strong>Phase C</strong>: golden-corpus validation harness. 13 hand-crafted{' '}
          <code>TargetSnapshot</code> cases, per-pipeline FP/FN measurement committed with every
          release.
        </li>
        <li>
          <strong>Phase D</strong>: POISONING-003 soft-imperative pattern. Catches{' '}
          &quot;first call X on Y&quot; tool-output injection that the previous regex set missed.
        </li>
        <li>
          <strong>Phase E</strong>: two new checks backed by real 2026 CVEs —{' '}
          SESSION-BINDING-001 (CVE-2026-52869) and UPSTREAM-IDENTITY-BYPASS-001
          (CVE-2026-110278/9). More detail in the{' '}
          <Link href="/blog/two-new-checks-two-cve-classes-eleven-live-hits" className={A}>
            companion post
          </Link>
          .
        </li>
      </ul>

      <h2 className={H2}>What the leaderboard looked like before vs. after</h2>
      <table className={TABLE}>
        <thead>
          <tr className="border-b border-paper-line text-left">
            <th className="py-2">Metric</th>
            <th className="py-2 text-right">Before (2026-11-23 morning)</th>
            <th className="py-2 text-right">After (2026-11-24 evening)</th>
          </tr>
        </thead>
        <tbody className="text-ink-soft">
          <tr className="border-b border-paper-line"><td className="py-2">Cohort</td><td className="py-2 text-right">1,455</td><td className="py-2 text-right">1,473</td></tr>
          <tr className="border-b border-paper-line"><td className="py-2">Grade A</td><td className="py-2 text-right">513</td><td className="py-2 text-right">633</td></tr>
          <tr className="border-b border-paper-line"><td className="py-2">Grade B</td><td className="py-2 text-right">179</td><td className="py-2 text-right">342</td></tr>
          <tr className="border-b border-paper-line"><td className="py-2">Grade C</td><td className="py-2 text-right">454</td><td className="py-2 text-right">252</td></tr>
          <tr className="border-b border-paper-line"><td className="py-2">Grade D</td><td className="py-2 text-right">126</td><td className="py-2 text-right">90</td></tr>
          <tr className="border-b border-paper-line"><td className="py-2">Grade F</td><td className="py-2 text-right">183</td><td className="py-2 text-right">156</td></tr>
          <tr className="border-b border-paper-line"><td className="py-2"><strong>D or F</strong></td><td className="py-2 text-right">309</td><td className="py-2 text-right"><strong>246</strong></td></tr>
          <tr className="border-b border-paper-line"><td className="py-2"><strong>high-severity findings</strong></td><td className="py-2 text-right">129</td><td className="py-2 text-right"><strong>424</strong></td></tr>
        </tbody>
      </table>
      <p>
        Fewer D/F, more A/B. More high-severity findings. That&apos;s not a contradiction —
        it&apos;s what honest grading looks like when the scorer finally has context.
      </p>
      <p>
        The old homebrew scorer applied blanket penalties: missing <code>X-Frame-Options</code>{' '}
        was −5 regardless of tier. <code>audit-core</code> is context-sensitive: XFO-MISSING on a
        public-by-design MCP endpoint isn&apos;t a real severity, so the server doesn&apos;t get
        dragged down for it. Fewer unfair D/F grades (−63).
      </p>
      <p>
        But the real OAuth posture and tool-metadata gaps that were silently invisible before —
        poisoning, annotations drift, deprecated capabilities, loopback-redirect rejection,
        session reuse — now get surfaced. 295 more high-severity findings across the 1,473-server
        cohort. That&apos;s not inflation. It&apos;s what we were supposed to be measuring all
        along.
      </p>

      <h2 className={H2}>New finding types with their first-ever hits</h2>
      <table className={TABLE}>
        <thead>
          <tr className="border-b border-paper-line text-left">
            <th className="py-2">Check</th>
            <th className="py-2 text-right">Hits</th>
            <th className="py-2">What it catches</th>
          </tr>
        </thead>
        <tbody className="text-ink-soft">
          <tr className="border-b border-paper-line"><td className="py-2"><code>ANNOTATIONS-001</code></td><td className="py-2 text-right">68</td><td className="py-2">Tool annotation drift (readOnly/destructive hint mismatch)</td></tr>
          <tr className="border-b border-paper-line"><td className="py-2"><code>DUAL-RESOURCE-001</code></td><td className="py-2 text-right">30</td><td className="py-2">Divergent PRM sources (Angelcam pattern)</td></tr>
          <tr className="border-b border-paper-line"><td className="py-2"><code>DEPRECATED-001</code></td><td className="py-2 text-right">25</td><td className="py-2">Servers still negotiating sampling / logging / roots capabilities</td></tr>
          <tr className="border-b border-paper-line"><td className="py-2"><code>AUTH-006</code></td><td className="py-2 text-right">20</td><td className="py-2">AS rejects loopback redirect (breaks native CLI auth)</td></tr>
          <tr className="border-b border-paper-line"><td className="py-2"><code>SESSION-BINDING-001</code></td><td className="py-2 text-right">11</td><td className="py-2">Server reuses the same MCP session ID across inits</td></tr>
          <tr className="border-b border-paper-line"><td className="py-2"><code>POISONING-001</code></td><td className="py-2 text-right">6</td><td className="py-2">Hidden U+200B / bidi in tool descriptions</td></tr>
        </tbody>
      </table>

      <h2 className={H2}>Measuring the scanner itself</h2>
      <p>
        Phase C ships the quiet half of this. Per-check unit tests existed; nothing measured that
        the full <code>ALL_CHECKS</code> pipeline produces the expected set on realistic snapshot
        shapes. We built a 13-case golden corpus (clean tier-1, Angelcam-like, Andrii&apos;s
        POISONING-001 fixture, DUAL-RESOURCE skew, loopback reject, SESSION-BINDING sameSession,
        and the rest) and a harness that diffs expected vs. actual, writes{' '}
        <code>bench/validation/validation-matrix.md</code> with per-check FP/FN tallies, and exits
        non-zero on any regression.
      </p>
      <p>
        Current matrix: <strong>13/13 pass</strong>. Every check produces exactly the expected
        finding set on every case. If a PR ever regresses that, CI blocks the merge.
      </p>

      <h2 className={H2}>Run it</h2>
      <pre className={PRE}>
{`npx -y @patchbay-nebius/agent audit https://your-mcp.example.com/mcp`}
      </pre>
      <p>
        Leaderboard: <Link href="/leaderboard" className={A}>patchbay-mcp.dev/leaderboard</Link>.
        Source: <a href="https://github.com/GodSmasher/patchbay" className={A}>github.com/GodSmasher/patchbay</a>.
      </p>
    </>
  )
}

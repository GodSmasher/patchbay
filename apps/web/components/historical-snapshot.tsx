import Link from 'next/link'

/**
 * Shown at the top of blog posts that reference earlier registry cohorts
 * (25, 277, etc). Keeps the historical post readable while sending
 * readers to the current leaderboard for up-to-date numbers.
 */
export function HistoricalSnapshot({ cohort }: { cohort: string }) {
  return (
    <div className="my-6 rounded border border-paper-line bg-paper px-4 py-3 text-sm text-ink-soft">
      <strong className="text-ink">Historical snapshot.</strong> This post is based on the{' '}
      {cohort} registry sweep. Current numbers (1,396 reachable of 1,470 public MCP servers
      graded as of 24 Nov 2026) live on the{' '}
      <Link
        href="/leaderboard"
        className="underline underline-offset-4 hover:text-ink"
      >
        leaderboard
      </Link>
      , rescanned weekly.
    </div>
  )
}

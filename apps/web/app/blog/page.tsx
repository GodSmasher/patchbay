import type { Metadata } from 'next'
import Link from 'next/link'
import { POSTS } from './_data'
import { listWeeklyReports } from './_weekly'

export const metadata: Metadata = {
  title: 'MCP security research and audit data · patchbay blog',
  description: 'Data from scanning public MCP servers: OAuth 2.1 adoption, auth gaps, manifest drift and how to fix what the scans find. Plus a weekly cohort rescan report every Sunday.',
  alternates: { canonical: '/blog' },
}

export const dynamic = 'force-dynamic'

function weeklyDisplayDate(r: { capturedAt: string | null; year: number; week: number }): string {
  return r.capturedAt ? r.capturedAt.slice(0, 10) : `${r.year}-W${String(r.week).padStart(2, '0')}`
}

export default function BlogIndex() {
  const posts = POSTS.filter((p) => !p.draft || process.env.NODE_ENV !== 'production')
  const weekly = listWeeklyReports()

  return (
    <main className="min-h-screen bg-paper text-ink px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-10 text-sm text-ink-mute">
          <Link href="/scan" className="hover:text-ink">patchbay</Link>
          <span className="mx-2">/</span>
          <span className="text-ink-soft">blog</span>
        </nav>
        <h1 className="text-3xl font-semibold text-ink mb-3">blog</h1>
        <p className="mb-10 text-ink-soft">
          Weekly rescan reports on the public MCP server cohort, plus research posts on OAuth, tool poisoning and manifest drift.
        </p>

        {weekly.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-5 text-sm font-medium uppercase tracking-wide text-ink-mute">Weekly rescan reports</h2>
            <ul className="space-y-6">
              {weekly.map((r) => (
                <li key={r.slug}>
                  <Link href={`/blog/weekly/${r.slug}`} className="group block">
                    <div className="mb-1 flex items-baseline gap-3 text-sm text-ink-mute">
                      <span className="rounded bg-paper-card px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft">
                        W{r.week}
                      </span>
                      <time dateTime={r.capturedAt ?? `${r.year}-01-01`}>{weeklyDisplayDate(r)}</time>
                    </div>
                    <h3 className="text-lg font-medium text-ink group-hover:text-signal">{r.title}</h3>
                    <p className="mt-1 text-sm text-ink-soft">
                      Cohort rescan for the week. Severity drift, per-check movement, signals.
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-5 text-sm font-medium uppercase tracking-wide text-ink-mute">Research posts</h2>
          {posts.length === 0 && (
            <p className="text-ink-mute">Nothing published yet.</p>
          )}
          <ul className="space-y-8">
            {posts.map((p) => (
              <li key={p.slug}>
                <Link href={`/blog/${p.slug}`} className="group block">
                  <div className="flex items-baseline gap-3 text-sm text-ink-mute mb-1">
                    <time dateTime={p.date}>{p.date}</time>
                    <span>·</span>
                    <span>{p.readingMinutes} min read</span>
                    {p.draft && <span className="text-warn">· draft</span>}
                  </div>
                  <h3 className="text-xl font-medium text-ink group-hover:text-signal">{p.title}</h3>
                  <p className="mt-2 text-ink-soft">{p.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}

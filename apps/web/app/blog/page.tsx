import type { Metadata } from 'next'
import Link from 'next/link'
import { POSTS } from './_data'

export const metadata: Metadata = {
  title: 'MCP security research and audit data · patchbay blog',
  description: 'Data from scanning public MCP servers: OAuth 2.1 adoption, auth gaps, manifest drift and how to fix what the scans find.',
  alternates: { canonical: '/blog' },
}

export default function BlogIndex() {
  const posts = POSTS.filter((p) => !p.draft || process.env.NODE_ENV !== 'production')
  return (
    <main className="min-h-screen bg-paper text-ink px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-10 text-sm text-ink-mute">
          <Link href="/scan" className="hover:text-ink">patchbay</Link>
          <span className="mx-2">/</span>
          <span className="text-ink-soft">blog</span>
        </nav>
        <h1 className="text-3xl font-semibold text-ink mb-10">blog</h1>
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
                <h2 className="text-xl font-medium text-ink group-hover:text-signal">{p.title}</h2>
                <p className="mt-2 text-ink-soft">{p.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}

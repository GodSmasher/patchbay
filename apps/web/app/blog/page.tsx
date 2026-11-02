import type { Metadata } from 'next'
import Link from 'next/link'
import { POSTS } from './_data'

export const metadata: Metadata = {
  title: 'patchbay — blog',
  description: 'Writing on MCP, OAuth, connector tooling and whatever else patchbay is doing.',
}

export default function BlogIndex() {
  const posts = POSTS.filter((p) => !p.draft || process.env.NODE_ENV !== 'production')
  return (
    <main className="min-h-screen bg-black text-neutral-200 px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-10 text-sm text-neutral-500">
          <Link href="/" className="hover:text-neutral-200">patchbay</Link>
          <span className="mx-2">/</span>
          <span className="text-neutral-300">blog</span>
        </nav>
        <h1 className="text-3xl font-semibold text-white mb-10">blog</h1>
        {posts.length === 0 && (
          <p className="text-neutral-500">Nothing published yet.</p>
        )}
        <ul className="space-y-8">
          {posts.map((p) => (
            <li key={p.slug}>
              <Link href={`/blog/${p.slug}`} className="group block">
                <div className="flex items-baseline gap-3 text-sm text-neutral-500 mb-1">
                  <time dateTime={p.date}>{p.date}</time>
                  <span>·</span>
                  <span>{p.readingMinutes} min read</span>
                  {p.draft && <span className="text-yellow-500/80">· draft</span>}
                </div>
                <h2 className="text-xl font-medium text-neutral-100 group-hover:text-white">{p.title}</h2>
                <p className="mt-2 text-neutral-400">{p.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}

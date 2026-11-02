import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPost, POSTS } from '../_data'
import { StateOfMcpAuthNov2026 } from './posts/state-of-mcp-auth-nov-2026'

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = getPost(params.slug)
  if (!post) return { title: 'Not found' }
  return {
    title: `${post.title} · patchbay`,
    description: post.summary,
    openGraph: { title: post.title, description: post.summary, type: 'article' },
  }
}

const BODIES: Record<string, () => JSX.Element> = {
  'state-of-mcp-auth-nov-2026': StateOfMcpAuthNov2026,
}

export default function BlogPost({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug)
  if (!post) notFound()
  const Body = BODIES[post.slug]
  if (!Body) notFound()

  return (
    <main className="min-h-screen bg-black text-neutral-200 px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-10 text-sm text-neutral-500">
          <Link href="/" className="hover:text-neutral-200">patchbay</Link>
          <span className="mx-2">/</span>
          <Link href="/blog" className="hover:text-neutral-200">blog</Link>
        </nav>

        {post.draft && (
          <div className="mb-6 rounded border border-yellow-500/30 bg-yellow-500/5 px-4 py-2 text-sm text-yellow-400">
            Draft — not linked from the index in production.
          </div>
        )}

        <div className="flex items-baseline gap-3 text-sm text-neutral-500 mb-2">
          <time dateTime={post.date}>{post.date}</time>
          <span>·</span>
          <span>{post.readingMinutes} min read</span>
        </div>
        <h1 className="text-3xl font-semibold text-white mb-8">{post.title}</h1>

        <article className="prose prose-invert max-w-none text-neutral-300 leading-relaxed">
          <Body />
        </article>
      </div>
    </main>
  )
}

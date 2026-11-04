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
    <main className="min-h-screen bg-paper text-ink px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-10 text-sm text-ink-mute">
          <Link href="/" className="hover:text-ink">patchbay</Link>
          <span className="mx-2">/</span>
          <Link href="/blog" className="hover:text-ink">blog</Link>
        </nav>

        {post.draft && (
          <div className="mb-6 rounded border border-warn/30 bg-warn-soft px-4 py-2 text-sm text-warn">
            Draft. Not linked from the index in production.
          </div>
        )}

        <div className="flex items-baseline gap-3 text-sm text-ink-mute mb-2">
          <time dateTime={post.date}>{post.date}</time>
          <span>·</span>
          <span>{post.readingMinutes} min read</span>
        </div>
        <h1 className="text-3xl font-semibold text-ink mb-8">{post.title}</h1>

        <article className="max-w-none text-ink-soft leading-relaxed space-y-4">
          <Body />
        </article>
      </div>
    </main>
  )
}

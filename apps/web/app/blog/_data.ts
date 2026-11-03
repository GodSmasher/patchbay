export interface Post {
  slug: string
  title: string
  date: string
  readingMinutes: number
  summary: string
  draft?: boolean
}

export const POSTS: Post[] = [
  {
    slug: 'state-of-mcp-auth-nov-2026',
    title: 'The state of MCP auth, November 2026',
    date: '2026-11-03',
    readingMinutes: 6,
    summary: 'I scanned 25 public MCP servers. Here is what the OAuth 2.1 posture looks like in the wild, and the auditor I built to measure it.',
  },
]

export function getPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug)
}

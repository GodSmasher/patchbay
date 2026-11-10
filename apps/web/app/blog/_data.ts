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
    slug: 'mcp-token-audience-validation',
    title: 'Audience validation for MCP servers: a token for another API should not work on yours',
    date: '2026-11-10',
    readingMinutes: 4,
    summary: 'If an MCP server never checks the aud claim, a valid token issued for any sibling service is accepted. Why metadata cannot show it, how to test it, and the fix.',
    draft: true,
  },
  {
    slug: 'mcp-dynamic-client-registration-missing',
    title: 'MCP server without a registration_endpoint: why clients cannot connect, and the fix',
    date: '2026-11-10',
    readingMinutes: 4,
    summary: 'An MCP server that advertises OAuth but no registration_endpoint leaves third-party clients with no way to get a client_id. What Dynamic Client Registration (RFC 7591) does and how to add it.',
    draft: true,
  },
  {
    slug: 'mcp-oauth-login-hangs-loopback-redirect',
    title: 'Why MCP OAuth login hangs after you click Allow, and how to fix it',
    date: '2026-11-10',
    readingMinutes: 5,
    summary: 'Native and CLI MCP clients use loopback redirect URIs with a random port. Authorization servers that reject them break login for every such client. How to confirm it and what to change.',
  },
  {
    slug: 'state-of-mcp-auth-nov-2026',
    title: 'The state of MCP auth, November 2026',
    date: '2026-11-03',
    readingMinutes: 6,
    summary: 'I scanned 277 public MCP servers. Here is what the OAuth 2.1 posture looks like in the wild, and the auditor I built to measure it.',
  },
]

export function getPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug)
}

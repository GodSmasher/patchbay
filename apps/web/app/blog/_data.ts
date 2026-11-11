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
    slug: 'mcp-tool-changes-breaking-additive-semantic-drift',
    title: 'When an MCP server changes its tools, which changes actually matter',
    date: '2026-11-11',
    readingMinutes: 4,
    summary: 'Not every tool-manifest edit deserves an alert. A follow-up check sorts each change into breaking, additive or semantic drift so a CI gate can fail on the one that actually breaks clients and let the rest through.',
  },
  {
    slug: 'four-oauth-checks-mcp-authorization-endpoint',
    title: 'Four things OAuth 2.1 took out and whether MCP servers got the memo',
    date: '2026-11-11',
    readingMinutes: 5,
    summary: 'OAuth 2.1 removed four things from OAuth 2.0. An MCP authorization server that still ships them is out of spec. Metadata will not tell you. Four new opt-in checks send a crafted request and read what comes back.',
  },
  {
    slug: 'mcp-server-tools-list-without-authentication',
    title: 'Your MCP server lists its tools to anyone. When that is fine and when it is not',
    date: '2026-11-10',
    readingMinutes: 4,
    summary: 'Authentication is optional in MCP and some servers are public on purpose. What an open tools/list tells a stranger, how to test your own server and where the line to a real problem is.',
  },
  {
    slug: 'mcp-tools-change-after-approval',
    title: 'An MCP server can change its tools after you approved it',
    date: '2026-11-10',
    readingMinutes: 4,
    summary: 'The tool list of an MCP server is sent fresh on every request and nothing forces a client to ask you again when it changes. Which changes matter and how to get a diff.',
  },
  {
    slug: 'mcp-pkce-missing-from-oauth-metadata',
    title: 'MCP clients refuse to log in when PKCE is missing from your OAuth metadata',
    date: '2026-11-10',
    readingMinutes: 3,
    summary: 'If code_challenge_methods_supported is absent from the authorization server metadata, a compliant MCP client must stop before the login starts. Why that is and the one line that fixes it.',
  },
  {
    slug: 'mcp-token-audience-validation',
    title: 'Audience validation for MCP servers: a token for another API should not work on yours',
    date: '2026-11-10',
    readingMinutes: 4,
    summary: 'If an MCP server never checks the aud claim, a valid token issued for any sibling service is accepted. Why metadata cannot show it, how to test it and the fix.',
  },
  {
    slug: 'mcp-dynamic-client-registration-missing',
    title: 'MCP server without a registration_endpoint: why clients cannot connect and how to fix it',
    date: '2026-11-10',
    readingMinutes: 4,
    summary: 'An MCP server that advertises OAuth but no registration_endpoint leaves third-party clients with no way to get a client_id. What Dynamic Client Registration and Client ID Metadata Documents do and which one to add.',
  },
  {
    slug: 'mcp-oauth-login-hangs-loopback-redirect',
    title: 'Why MCP OAuth login hangs after you click Allow and how to fix it',
    date: '2026-11-10',
    readingMinutes: 5,
    summary: 'Native and CLI MCP clients use loopback redirect URIs with a random port. Authorization servers that reject them break login for every such client. How to confirm it and what to change.',
  },
  {
    slug: 'state-of-mcp-auth-nov-2026',
    title: 'The state of MCP auth, November 2026',
    date: '2026-11-03',
    readingMinutes: 6,
    summary: 'I scanned 277 public MCP servers. Here is what the OAuth 2.1 posture looks like in the wild and the auditor I built to measure it.',
  },
]

export function getPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug)
}

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
    slug: 'what-a-well-configured-mcp-server-looks-like',
    title: 'What a well-configured MCP server looks like',
    date: '2026-11-23',
    readingMinutes: 5,
    summary: 'A counter-example to our usual teardowns. Angelcam shipped mcp.angelcam.com/readonly — a native MCP endpoint that lets AI assistants ask about your cameras. A full patchbay scan returned two medium defence-in-depth findings, zero criticals, zero highs. What came back clean (10 checks including the new DUAL-RESOURCE-001), what the two findings are (HEADERS-001 and IDENTITY-001), and why it is worth publishing the servers that get it right.',
    draft: true,
  },
  {
    slug: 'why-your-mcp-server-got-an-f-dcr-open-redirect',
    title: 'Why your MCP server got an F: DCR-OPEN-REDIRECT',
    date: '2026-11-23',
    readingMinutes: 5,
    summary: 'Part 1 of 6. The single most common F-trigger in our 20 Nov 2026 sweep of 1,373 public MCP servers. /oauth/register accepts any https:// redirect URI without allowlist. Patchbay verifies live by POSTing a controlled test URI. Why it earns an F even though it is RFC 7591-compliant, the four-line fix, and two named public examples from the sweep.',
  },
  {
    slug: 'sec-001-command-injection',
    title: 'The scanner got scanned: command injection in our own MCP server, fixed and disclosed',
    date: '2026-11-20',
    readingMinutes: 6,
    summary: 'On 2026-11-20 at 00:11 local, Pietro Procaccini privately disclosed a command injection vulnerability in two of our npm packages. Twelve hours later both affected packages were patched on npm, a GitHub Security Advisory was published, and the regression that would stop the pattern being reintroduced was running in our CI. This is how it happened and how it was caught.',
  },
  {
    slug: 'auth-004-retirement-story',
    title: 'The check we retired. AUTH-004 asked for metadata no spec defines',
    date: '2026-11-22',
    readingMinutes: 4,
    summary: 'Patchbay audit-core 0.3.4 killed AUTH-004 off the list. The check used to flag OAuth metadata that lacked resource_indicators_supported. We added it in the first draft because the field looked load-bearing. On verification pass: no RFC defines it, no MCP spec references it. We were asking servers to signal something that is not a thing. Kept it alive through two releases on the assumption surely this is somewhere. Finally sat down with the spec stack and confirmed the field is invented. Retired.',
  },
  {
    slug: 'mcp-poisoning-003-tool-call-return-content',
    title: 'What static MCP scanners miss: tool-call return content',
    date: '2026-11-21',
    readingMinutes: 5,
    summary: 'Patchbay started as a passive scanner. One finding category still slipped past it: the content coming back from a tool call. POISONING-003 is the new opt-in runtime check that invokes a selected tool and inspects the return envelope for role-marker patterns, hidden Unicode and imperative directives. Separate from POISONING-001, which stays static on the tool description.',
  },
  {
    slug: 'mcp-transport-security-one-week-later',
    title: 'One week later: 97 percent of tracked MCP servers trip the new transport-security check',
    date: '2026-11-12',
    readingMinutes: 5,
    summary: 'A second passive sweep of the same cohort as last week shows 121 of 125 reachable MCP servers missing at least one of four transport-security headers. Ten hosts lost a letter grade without changing any code. Which ones and what the fix is.',
  },
  {
    slug: 'mcp-oauth-scope-hygiene-three-mistakes',
    title: 'Scope hygiene for MCP servers: three mistakes and the checks that catch them',
    date: '2026-11-11',
    readingMinutes: 5,
    summary: 'One scope for every tool, read and write share a scope, no OAuth at all. Three ways scope design fails on MCP servers and the three patchbay checks that read them together so you can fix all three in one pass.',
  },
  {
    slug: 'mcp-oauth-iss-parameter-mix-up-mitigation',
    title: 'The one-field OAuth flag that stops mix-up attacks on your MCP server',
    date: '2026-11-11',
    readingMinutes: 3,
    summary: 'RFC 9207 mitigates authorization-server mix-up with a single iss parameter on every response. Clients only validate it when the server advertises support. The MCP spec marks this as SHOULD today and will raise it to MUST. A one-line fix.',
  },
  {
    slug: 'mcp-server-transport-security-headers',
    title: 'Four response headers your MCP server probably forgot',
    date: '2026-11-11',
    readingMinutes: 4,
    summary: 'Wildcard CORS with credentials, no HSTS on HTTPS, no X-Frame-Options or frame-ancestors, no nosniff. Four cheap headers that most MCP servers still miss and that the new HEADERS-001 check reports from a single probe.',
  },
  {
    slug: 'mcp-token-missing-audience-claim-bug',
    title: 'The two-line audience check that passes AUDIENCE-001 and still fails',
    date: '2026-11-11',
    readingMinutes: 4,
    summary: 'A common defensive pattern reads if aud and aud not equal me then reject. A token with no aud claim at all slips through. Why RFC 9068 covers this, how the new probe catches it and the one-line fix.',
  },
  {
    slug: 'mcp-tool-poisoning-hidden-characters-descriptions',
    title: 'Hidden characters in MCP tool descriptions: the gap between what you see and what the model sees',
    date: '2026-11-11',
    readingMinutes: 5,
    summary: 'MCP clients pass a tool description to the model as instruction context. Zero-width spaces, bidi overrides and Unicode tag characters let a server hide instructions from the human reader while the model still obeys them. How the attack looks, how the check finds it, how to clean descriptions in CI.',
  },
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
    summary: 'Historical snapshot: 25 then 277 public MCP servers in early November 2026. First look at the OAuth 2.1 posture in the wild and the auditor built to measure it. Current numbers (1,373 of 1,445, sweep 2026-11-20) live on the leaderboard.',
  },
]

export function getPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug)
}

// Weekly rescan reports live in `./_weekly.ts`. They are a separate module
// because reading `public/weekly/index.json` needs `node:fs`, which is
// incompatible with the edge-runtime OG image handler that imports this
// file. Routes that need weekly helpers import from `./_weekly` directly.

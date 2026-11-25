// /llms-full.txt — llmstxt.org "full" variant. Assembles the core
// content (all 38 check-reference pages + top blog posts + the OAuth
// checklist overview + the hosted-audit page copy) as inline markdown
// so an AI crawler can read the entire project in one request instead
// of 40+ page fetches.
//
// Content is pulled from the structured data the pages themselves
// render from, so there is single source of truth and no drift.

import { DOCS } from '../docs/_data'
import { POSTS } from '../blog/_data'

export const dynamic = 'force-static'
export const revalidate = 3600

const AUDIT_SECTION = `## /audit — hosted scanner

Paste any public MCP endpoint URL. 38 security checks run server-side with an 8-second probe budget and return a letter grade (A-F), top findings and a shareable report. No sign-up, no install for the hosted scan. Free MIT-licensed CLI also available:

\`\`\`
npx -y @patchbay-nebius/agent audit https://your-server.example.com/mcp
\`\`\`

### Live cohort snapshot (crawled weekly)

- 1,473 public MCP servers crawled from the official registry
- 1,398 graded (reachable)
- 171 carry grade D or F
- 424 high-severity findings across the cohort

### How a scan runs

1. **Probe + snapshot** — fetch \`/.well-known/oauth-protected-resource\`, \`/.well-known/oauth-authorization-server\`, \`initialize\`, \`tools/list\` (with and without a dummy bearer). Snapshot everything. 8-second total budget.
2. **Checks** — 38 pure functions over the snapshot, no further IO. Severity reads the server's context (an auth-required server failing AUDIENCE-001 is critical; a public read-only server with the same miss is info).
3. **Report** — scoring starts at 100: critical -30, high -15, medium -5, low -1. \`--ci\` fails the build. \`--sarif\` feeds GitHub code scanning.

### Methodology

Public: https://patchbay-mcp.dev/scanning — what the scanner reads and what it never does. Loopback-only PKCE challenges, no state change, no auth bypass attempts without an auth token the operator provides.
`

const CHECKLIST_SECTION = `## /mcp-oauth-checklist — what a remote MCP server has to get right

A six-section checklist with the spec clause each rule traces back to. Written for an operator who is about to ship a remote MCP server.

1. **Discovery** — Protected Resource Metadata (RFC 9728), S256 in \`code_challenge_methods_supported\` on the authorization server.
2. **Client registration** — CIMD or Dynamic Client Registration (RFC 7591), loopback redirect URIs on any port (RFC 8252 §7.3), localhost and 127.0.0.1 treated the same.
3. **Authorization endpoint** — PKCE on every code flow (OAuth 2.1 §7.5.1), reject \`code_challenge_method=plain\` (§7.5.2), do not honour \`response_type=token\`, exact-match redirect_uri comparison (§2.3.1).
4. **Tokens** — validate audience of every token (RFC 8707 §2), accept the \`resource\` parameter, do not rely on a static key alone.
5. **Exposure** — never expose write tools without authentication, HTTPS only, reject requests from origins you do not expect.
6. **Scopes** — tools get their own scopes, read and write separated.
7. **In the repository** — no secrets in source, pin dependencies, tag releases.

Full version with per-item spec references and verification steps: https://patchbay-mcp.dev/mcp-oauth-checklist
`

function renderDocEntry(d: (typeof DOCS)[number]) {
  const specLine = d.spec && d.specUrl
    ? `**Spec:** [${d.spec}](${d.specUrl})`
    : d.spec
    ? `**Spec:** ${d.spec}`
    : ''
  return `### ${d.id.toUpperCase()} — ${d.title}

**Severity:** ${d.severity}

${d.oneLiner}

**What it means.** ${d.whatItMeans}

**How to fix.** ${d.howToFix}

${specLine}

Reference: https://patchbay-mcp.dev/docs/${d.id}
`
}

function renderBlogEntry(p: (typeof POSTS)[number]) {
  return `### ${p.title}

**Published:** ${p.date} · ${p.readingMinutes} min read

${p.summary}

Full post: https://patchbay-mcp.dev/blog/${p.slug}
`
}

function body() {
  const publishedPosts = POSTS.filter((p) => !p.draft)
  const topPosts = publishedPosts.slice(0, 5)

  const docSections = DOCS.map(renderDocEntry).join('\n---\n\n')
  const blogSections = topPosts.map(renderBlogEntry).join('\n---\n\n')

  return `# patchbay — full content for LLM crawlers

> Open-source security scanner for Model Context Protocol (MCP) servers. This file (/llms-full.txt) inlines the core content of the site so an agent can read the project in one fetch instead of 40+ page requests. Source of truth lives at https://patchbay-mcp.dev and in the MIT-licensed npm CLI \`@patchbay-nebius/agent\`.

Last assembled from source on build. See https://patchbay-mcp.dev/llms.txt for the short / link-forward variant.

---

${AUDIT_SECTION}

---

${CHECKLIST_SECTION}

---

## Check catalog — ${DOCS.length} checks, grouped by severity below

Every check patchbay runs has a reference page. Each has a one-liner (the definition that fires the check), a plain-language explanation of what the finding means, how to fix it, and the spec clause it traces back to.

${docSections}

---

## Recent blog posts (top 5)

Weekly scan diffs, CVE write-ups, check releases. Full index at https://patchbay-mcp.dev/blog.

${blogSections}

---

## Distribution + attribution

- Source: https://github.com/GodSmasher/patchbay (MIT)
- npm CLI: https://www.npmjs.com/package/@patchbay-nebius/agent
- Leaderboard JSON API: https://patchbay-mcp.dev/api/leaderboard
- Vulnerability disclosure: https://github.com/GodSmasher/patchbay/security
- OWASP MCP Top 10 (2025) coverage: 7 of 10 categories, 33 of 35 checks mapped
- Public MCP CVE catalog: 802 CVEs, 770 (96%) fall in categories patchbay covers

## License

Source: MIT. Public scan reports, leaderboard data, and this document: CC-BY-4.0.
`
}

export function GET() {
  return new Response(body(), {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}

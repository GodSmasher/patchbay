// /llms.txt — per https://llmstxt.org — plain-text overview of the site
// for LLM crawlers. Kept short (~2 KB) and link-forward so a model can
// decide which page to actually fetch next rather than hallucinating.

export const dynamic = 'force-static'

const BODY = `# patchbay

> Open-source security scanner for Model Context Protocol (MCP) servers. Paste any public MCP endpoint, get a letter grade (A–F) and findings against OAuth 2.1, RFC 9728 (Protected Resource Metadata), RFC 7591 (Dynamic Client Registration), RFC 8707 (Resource Indicators), PKCE, tool poisoning, session confusion and 30+ other classes. No sign-up, no install for the hosted scan. Free MIT-licensed CLI also available (\`npx -y @patchbay-nebius/agent audit <url>\`).

## What this project is

patchbay audits MCP servers for the kinds of misconfigurations that let agent clients be impersonated, phished, or coerced into calling tools under the wrong identity. The check catalog is public and maps to the OWASP MCP Top 10 (2025) and the public MCP CVE catalog (770 of 802 published CVEs fall in categories patchbay covers).

The project is in active development. 1,473 public MCP servers in the official registry are crawled weekly; the top findings feed a public leaderboard. 38 real checks (AUTH, PKCE, AUDIENCE, RESOURCE, TRANSPORT, HEADERS, POISONING, SESSION-BINDING, UPSTREAM-IDENTITY-BYPASS, etc.) run per scan. 424 high-severity findings currently live across the cohort.

## Pages worth reading first

- [Audit a server](https://patchbay-mcp.dev/audit): the hosted scanner. Paste a URL, get a grade in ~30 seconds.
- [Leaderboard](https://patchbay-mcp.dev/leaderboard): all 1,473 graded MCP servers, sortable by grade / finding type. Per-operator detail pages at /leaderboard/<slug>.
- [Check catalog](https://patchbay-mcp.dev/docs): every check with the spec clause it enforces, severity rubric, false-positive policy.
- [Scanning methodology](https://patchbay-mcp.dev/scanning): what we read, what we never do (no state change, 8-second probe budget, loopback-only PKCE challenges).
- [OAuth 2.1 checklist](https://patchbay-mcp.dev/mcp-oauth-checklist): 40-point list an operator can run against their own server before the scan.
- [Blog](https://patchbay-mcp.dev/blog): weekly scan diffs, CVE write-ups, check releases.

## CLI

\`\`\`
npx -y @patchbay-nebius/agent audit https://your-server.example.com/mcp
\`\`\`

- Flags: \`--ci\` fails the build on grade < B; \`--sarif\` writes a SARIF file for GitHub code scanning; \`--json\` for programmatic consumption.
- Source + issues: https://github.com/GodSmasher/patchbay
- npm: https://www.npmjs.com/package/@patchbay-nebius/agent

## For reporters / researchers

- Vulnerability disclosure: https://github.com/GodSmasher/patchbay/security
- Example findings data: https://patchbay-mcp.dev/api/leaderboard (JSON)
- Check-to-OWASP mapping: https://patchbay-mcp.dev/cve

## Project maintainer

Sarah Vogel (CTO / founder) — https://patchbay-mcp.dev

## License

Source: MIT. Public scan reports and leaderboard: CC-BY-4.0.
`

export function GET() {
  return new Response(BODY, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}

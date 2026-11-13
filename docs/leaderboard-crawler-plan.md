# Leaderboard Crawler — Dual-Tier Plan

Target: scan every MCP server in `registry.modelcontextprotocol.io` (~2000 at time of writing) without ever authenticating against a third-party server, and still produce a leaderboard that reflects real security posture.

## Why the obvious approach is wrong

Login-walled MCP servers return `401` on `tools/list`, so the current live-URL audit can only fire `AUTH-001` (which downgrades to info for the "cannot judge" case). We would end up listing 2000 servers as "unknown grade / authentication required", which is not a signal — it is noise.

Bypassing authentication is off the table. Even where a server bug would make it technically possible, performing an unauthorized request against someone else's infrastructure is illegal under §202a/202b StGB in Germany and the CFAA in the US. It also destroys trust: one public mention of "patchbay, the unauthorized scanner" and every enterprise door closes.

## The insight

Almost every entry in the official MCP Registry has a `repository.url` field pointing at a public GitHub (or GitLab) repo. We already have `patchbay audit <local-directory>` that runs static analysis on source code. That lets us catch a huge class of findings without sending a single authenticated request anywhere.

## Dual-tier scan

For each registry entry we run both tiers and merge the findings.

### Tier A — Live metadata probe

Strictly what an unauthenticated MCP client is spec-allowed to fetch:

- `GET /.well-known/oauth-protected-resource` (RFC 9728, public document)
- `GET /.well-known/oauth-authorization-server` (RFC 8414, public document)
- `HEAD` + `GET` on the MCP endpoint itself, reading response headers only
- One unauthenticated `POST tools/list` to classify auth posture (`401` → "auth required", `200` → "public"). This is what any MCP client does when first talking to a server.

Checks reachable from this tier:

- `AUTH-003` PKCE S256 advertisement
- `AUTH-005` CIMD / DCR advertisement
- `RESOURCE-001` PRM presence and `authorization_servers` field
- `ISS-001` RFC 9207 `iss` parameter support
- `HEADERS-001` transport-security headers
- `TRANSPORT-001` HTTPS vs plain HTTP
- `TRANSPORT-002` origin header validation (sent as an OPTIONS, not a tool call)
- `AUTH-001` downgraded from critical to info — we only know "auth required" versus "public", not the full picture

### Tier B — Static source audit

Shallow-clone (`--depth 1`) the GitHub repo referenced by `repository.url`, run `audit-core` in directory mode against the clone, discard the clone when done.

Checks reachable from this tier:

- `SECRET-001` hardcoded API keys, tokens, bearer secrets in source
- `SECRET-002` credential read from env with no refresh-token flow
- `POISONING-001` zero-width Unicode and role-marker patterns in tool descriptions, as they appear in the source
- `SCOPE-001` all tools share one scope
- `SCOPE-002` write and read tools share scope
- `MANIFEST-*` tool-manifest shape and drift
- `AUTH-002` static credential accepted without OAuth discovery (pattern match on `x-api-key` / `Authorization` middleware)
- Parts of `AUDIENCE-001/002` via `aud` claim validation patterns

### Combined coverage

Together Tiers A and B hit roughly 20 of 25 checks. The five we cannot reach without the operator:

- Full `AUTH-001` evidence (what the tools actually look like)
- Authenticated tool-manifest analysis (POISONING-001 in live descriptions, which may differ from source)
- `AUDIENCE-001` cross-audience bearer acceptance
- `AUDIENCE-002` missing-`aud` early-exit
- `AUTH-007` 401 compliance on bad token

These remain available under Tier C.

### Tier C — Operator or community submission

Server operators run `patchbay audit-oauth <url> --publish` against their own server, or a token-holding user does. Results land in the leaderboard with a `scanSource: 'authenticated'` flag and an "operator verified" badge if the submitter verified ownership via DNS TXT or `/.well-known/patchbay-ownership.txt`.

Tier C is not blocking for launch. Tier A + B is enough to populate the leaderboard with 2000 honestly-labelled entries.

## Leaderboard schema changes

Add to `LeaderboardEntry`:

- `scanSource: 'live-metadata' | 'source' | 'live-metadata+source' | 'authenticated' | 'operator-verified' | 'unreachable'`
- `repositoryUrl?: string` — the GitHub URL we scanned
- `registrySource: 'modelcontextprotocol.io' | 'manual' | 'community-submit'`
- `coverage: { live: boolean; source: boolean; authenticated: boolean }` — booleans per tier, for UI badges
- `authRequired?: boolean` — did the live-probe hit a `401`

Grade computation needs a tier-aware caveat: a server audited only via live-metadata has partial evidence, so grade comes with a confidence flag. For the first release we display both grades and keep them comparable by only grading reachable servers that have at least metadata.

## UI

Each leaderboard row gets a small set of badges:

- `🔍 metadata` — live metadata probe
- `📦 source` — source audit from the linked repo
- `✅ full` — tiers A + B merged
- `👤 operator` — operator-verified Tier C
- `🚨 unreachable` — DNS or TLS failed

Filter: `show source-only`, `show operator-verified`, `hide unreachable`.

## Operational safeguards

- `User-Agent: patchbay-crawler/0.x (+https://patchbay-mcp.dev/about-crawler)` on every live request
- Rate limit: 2 requests per second per host, 10 requests per second total
- Respect `robots.txt` where present (treat `Disallow: /.well-known/` as opt-out)
- `/about-crawler` page with scan schedule, data retention, and `crawler-opt-out@patchbay-mcp.dev` contact
- Weekly rescan cadence by default, not daily. Operators can request more frequent scans after claiming their listing.
- Resumable crawls: each host's result is persisted as it completes, so a mid-run failure does not re-hit the first 1500 hosts.
- Never send `POST tools/call`. The probe is limited to `initialize`, `tools/list`, and well-known GETs.
- No DCR writes, no crafted `/authorize` requests against third-party hosts. Those live in the `demo` MCP server only.

## Build order

1. `scripts/ingest-mcp-registry.ts` — pull `registry.modelcontextprotocol.io`, dedupe by canonical URL, extract `(url, repository.url)` tuples. Writes to `bench/registry-index.json`.
2. `audit-core`: add `metadataOnly: true` option to `auditTarget()` that skips `tools/list` and any check that needs live tool metadata.
3. `scripts/crawl-dual.ts` — read `bench/registry-index.json`, for each entry run Tier A against the live URL and Tier B against a shallow-cloned repo, merge findings, write per-host result. Resumable via a `--resume-from=<slug>` flag.
4. Update `apps/web/lib/leaderboard-store.ts` schema with the new fields.
5. Update `scripts/leaderboard-upload.ts` transformer to map crawler output into the new shape.
6. Update `apps/web/app/leaderboard/page.tsx` + `[slug]/page.tsx` with tier badges.
7. Add `apps/web/app/about-crawler/page.tsx` with the operational safeguards summary and opt-out contact.
8. Launch post: Fable's W3 slot. Hook: "we audited 2000 public MCP servers without logging into a single one".

## Launch messaging

The X / blog angle is not "we bypassed the login walls". It is "we found a way to audit login-walled servers without crossing an ethical line, and here is what the industry looks like." That is a dev-tool trust story we can repeat forever; the alternative is a one-time stunt that burns the brand.

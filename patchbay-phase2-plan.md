# patchbay — Phase 2: `patchbay audit` + Auth Layer

> Plan for Claude Code. Read fully before touching code. Ask before deviating from the non-goals.

## 0. Context

patchbay generates API integrations as tested TypeScript/Python connectors that the user owns ("You own the code"). Live at patchbay-nebius.vercel.app, repo github.com/GodSmasher/patchbay. A fine-tuned repair model (Qwen3-30B-A3B on Nebius) fixes failing connectors from benchmark runs.

**Problem Phase 2 solves:** A generated connector without auth is not production-ready. Public data: ~40 % of open-source MCP servers have no authentication, only ~8.5 % use OAuth. Nobody ships a drop-in fix.

**Phase 2 thesis:** "You own the code *and* the keys." patchbay audits MCP servers / connectors for auth gaps, then generates connectors that ship with OAuth 2.1, per-tool scopes and tests. A hosted token vault comes later (Phase 3, out of scope here).

**Timeline:** 8 weeks. Free the whole time. Goal is adoption + waitlist, not revenue.

## 1. Goals (in priority order)

1. `npx patchbay audit <target>` works end-to-end and is published on npm by **mid-November**.
2. Every audit run ends with a waitlist CTA; waitlist stores email + target.
3. Generated connectors optionally include an OAuth 2.1 auth module + scope manifest + tests (`--with-auth`).
4. Ten upstream PRs to third-party MCP repos fixing audit findings, using patchbay-generated auth code — by **mid-December**.

## 2. Non-goals (do NOT build in Phase 2)

- Hosted token vault, consent screens, dashboard, billing, pricing page
- Logo, marketing site redesign
- Support for every transport; stdio + Streamable HTTP is enough
- Fixing vulnerabilities in third-party servers automatically without a human reviewing the PR

## 3. Architecture

```
packages/
  cli/                 # existing patchbay CLI — add `audit` subcommand
  audit-core/          # NEW: pure TS, no I/O side effects, fully unit-tested
    src/
      probe/           # connect to MCP target, enumerate tools, fetch metadata
      checks/          # one file per check, same interface
      report/          # Finding[] -> terminal / JSON / SARIF
      index.ts
  auth-template/       # NEW: templates emitted by `--with-auth`
    oauth21/           # PKCE client, discovery, token refresh
    scopes/            # per-tool scope manifest + middleware
    tests/             # generated test scaffolds
  waitlist/            # NEW: tiny Next.js route or Vercel function + storage
```

**Design rules**
- `audit-core` has zero network calls in its check functions. Probing collects a `TargetSnapshot`; checks are pure functions `(snapshot) => Finding[]`. This makes checks trivially testable and lets the repair model consume snapshots later.
- Every check has: `id`, `severity` (critical/high/medium/low/info), `title`, `evidence`, `fix` (human text), `docsUrl`, optional `autofixTemplate` pointing into `auth-template/`.
- Output formats: pretty terminal (default), `--json`, `--sarif` (so it runs in GitHub Actions).
- Exit code: non-zero if any critical/high finding and `--ci` is set.

## 4. Target types for `audit`

| Target | Example | How to probe |
|---|---|---|
| Remote MCP server URL | `https://mcp.example.com/mcp` | HTTP: `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`, initialize handshake, `tools/list` |
| Local MCP server command | `-- node server.js` | spawn with stdio transport, `initialize`, `tools/list`, inspect env usage |
| Repo / directory | `./my-mcp-server` or GitHub URL | static analysis: grep for auth patterns, env vars, hardcoded secrets, scope definitions |
| patchbay connector | `./connectors/salesforce` | same as repo, plus knows patchbay's own manifest |

Start with **remote URL + local directory**. GitHub URL = clone to temp dir, then directory path.

## 5. Checks (v1 — ship these, nothing more)

| ID | Severity | What it detects | Evidence source |
|---|---|---|---|
| `AUTH-001` | critical | No authentication at all — `initialize`/`tools/list` succeed with no credentials | remote probe |
| `AUTH-002` | critical | Static API key / bearer accepted, no OAuth discovery metadata served | remote probe |
| `AUTH-003` | high | OAuth metadata present but PKCE not required / `code_challenge_methods_supported` missing `S256` | discovery doc |
| `AUTH-004` | high | No `resource` indicator support — tokens not bound to this server (RFC 8707) | discovery doc + token request probe |
| `AUTH-005` | high | Dynamic client registration unsupported while advertising OAuth 2.1 | discovery doc |
| `SCOPE-001` | high | All tools share one scope or no scopes declared at all | `tools/list` + static |
| `SCOPE-002` | medium | Write/destructive tools (names matching create/update/delete/send/pay/execute) share scope with read tools | `tools/list` heuristics |
| `SECRET-001` | critical | Hardcoded secret in source (regex set: `sk-`, `AKIA`, `ghp_`, `xoxb-`, generic 32+ char hex near `key|token|secret`) | static |
| `SECRET-002` | medium | Secret read from env but no rotation/refresh path (no `refresh_token` handling found) | static |
| `TRANSPORT-001` | high | Remote server reachable over plain HTTP | URL |
| `TRANSPORT-002` | medium | Missing `Origin` validation on Streamable HTTP endpoint (DNS rebinding) | remote probe with spoofed Origin |
| `REDIRECT-001` | medium | Redirect URI validation treats `localhost` and `127.0.0.1` inconsistently (known client-interop pitfall) | token endpoint probe |

Each check gets: unit test with a fixture snapshot (positive + negative), a one-paragraph `fix` text, and a link to the MCP auth spec section.

**Severity → terminal output:** red for critical/high, yellow for medium, dim for low/info. Summary line: `3 critical · 2 high · 1 medium`.

## 6. CLI UX

```
$ npx patchbay audit https://mcp.example.com/mcp

patchbay audit  ·  https://mcp.example.com/mcp

  ✖ AUTH-001  critical  No authentication required
      tools/list returned 14 tools without credentials.
      Fix: require OAuth 2.1 bearer tokens. → patchbay.dev/docs/auth-001

  ✖ SCOPE-001 high      No per-tool scopes
      ...

  3 critical · 2 high · 1 medium  (6 findings, 2.1s)

  Want patchbay to generate the fix?
  → npx patchbay fix --with-auth   (coming)
  → patchbay.dev/fix?t=<hash>      (get notified)
```

- The waitlist URL carries a non-reversible hash of the target + finding IDs. No PII in the URL.
- Green run still shows: `0 findings. Want it to stay that way? → patchbay.dev/fix`
- `--json`, `--sarif`, `--ci`, `--no-cta` flags. `--no-cta` exists so CI logs stay clean; default shows CTA.
- Telemetry: **off by default**. `PATCHBAY_TELEMETRY=1` sends anonymous finding counts only. Document this in README.

## 7. Waitlist

- Route: `POST /api/waitlist` on the existing Vercel project. Fields: `email`, `target` (free text), `findingsHash` (optional), `source` (`cli` | `web`).
- Storage: Vercel Postgres or KV — whatever is already in the project. If nothing: a single Postgres table. Do not add a new vendor for this.
- Page `/fix`: one headline ("patchbay found gaps in your MCP auth. We're building the fix."), email field, target field, submit. Nothing else. No pricing.
- Confirmation email: skip in v1. Show success state on page only.
- Export: `GET /api/waitlist/export` protected by a `WAITLIST_ADMIN_TOKEN` env var → CSV.

## 8. `--with-auth` for generated connectors

When patchbay generates a connector with `--with-auth`, additionally emit:

```
<connector>/
  auth/
    oauth.ts        # discovery, PKCE, token exchange, refresh, resource indicator
    scopes.json     # { "tool_name": ["scope:read"], ... } — one scope per tool, write tools separate
    middleware.ts   # checks token scope against scopes.json before tool execution
  auth.test.ts      # expired token, missing scope, wrong audience, refresh path
```

- Generated code must pass its own `patchbay audit` with zero critical/high findings. **Make this an integration test.**
- Templates are plain TypeScript first; Python templates in Phase 2.5.
- The repair model's benchmark runs get three new failure categories: `token_expired`, `scope_missing`, `audience_mismatch`. Add fixtures so it can learn them.

## 9. Upstream PR playbook (manual, but tooling supports it)

`npx patchbay audit <repo> --pr-draft` writes `PATCHBAY_AUDIT.md` into the target dir: findings + proposed changes + link to spec. Sarah reviews, adapts, opens the PR by hand. Never open PRs automatically.

PR etiquette (put this in `docs/upstream-prs.md`):
- Title: "Add OAuth 2.1 + per-tool scopes (fixes AUTH-001, SCOPE-001)"
- Body: what was found, what changed, how to test, one line about patchbay, no sales pitch
- If a finding is an exploitable vulnerability (token leak, account takeover path): **do not open a public PR.** Report privately via SECURITY.md / email, 90-day disclosure window.

## 10. Milestones & acceptance

| Week | Deliverable | Done when |
|---|---|---|
| 1 | `audit-core` skeleton, `TargetSnapshot`, 3 checks (AUTH-001, AUTH-002, SECRET-001), terminal report | `pnpm test` green, runs against one local fixture server |
| 2 | Remaining 9 checks, `--json`, `--sarif`, remote URL probing | audits 5 real public MCP servers without crashing; findings manually verified |
| 3 | Waitlist route + `/fix` page, CTA wiring, README, publish `patchbay@x.y.0` to npm | `npx patchbay audit` works on a fresh machine; one signup lands in DB |
| 4 | Blog post data: scan N public servers (`scripts/scan-public.ts`, rate-limited, respects robots/ToS), aggregate stats only | CSV of aggregates, zero server names stored |
| 5–6 | `--with-auth` templates + `auth.test.ts`, integration test "generated connector passes audit" | integration test green for 3 sample APIs |
| 7 | `--pr-draft`, `docs/upstream-prs.md`, repair model fixtures for 3 auth failure types | first 3 upstream PRs opened |
| 8 | Hardening, GitHub Action example (`.github/workflows/patchbay-audit.yml`), CHANGELOG | Action runs in a sample repo and fails on critical |

## 11. Definition of done for Phase 2

- `npx patchbay audit <url|dir>` on npm, documented, tested
- ≥ 1 waitlist signup from a stranger
- Generated connectors with `--with-auth` pass their own audit
- Blog post published with aggregate numbers
- ≥ 10 upstream PRs opened (merged is nice, opened is the metric)

## 12. Open questions (answer before week 5)

1. How does patchbay currently inject credentials into generated connectors — `.env`, config object, nothing? Determines how `auth/oauth.ts` plugs in.
2. Which storage does the Vercel project already use? Reuse it for the waitlist.
3. Where does `scopes.json` live for Python connectors — same file, or a Python module?
4. Do we want `audit` as a separate npm package (`@patchbay/audit`) or a subcommand only? Default: subcommand only, split later if needed.

## 13. Working agreement for Claude Code

- Small PRs, one check or one feature per PR, tests included.
- No new dependencies without a one-line justification in the PR description.
- Never call real third-party servers in tests; use fixture servers under `test/fixtures/servers/`.
- When unsure whether a finding is a true positive, prefer a lower severity and flag it `confidence: "medium"` rather than screaming.
- Do not implement anything in section 2 (non-goals), even if it seems quick.

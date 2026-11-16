# MCP Architecture Review — Template

Use this template when running a deep-dive review for a design partner (not a routine `patchbay audit` scan). Routine audits produce findings; an architecture review produces a prioritized remediation plan plus an opinion on structural risk.

**When to use this instead of `patchbay audit`:**

- Partner has deployed MCP in production and wants a structural sign-off, not a lint pass.
- Partner has questions the auditor cannot answer alone (e.g. "is our scope design extensible", "is our tool naming poisoning-resistant").
- Partner wants a written artifact they can hand to their own security team.

**Expected effort:** 2–4 hours per partner once their endpoint + repo are in hand. Deliverable is a single Markdown file in `docs/design-partners/<partner>-review.md`.

---

## Section 0 — Scope & inputs

| Field | Value |
|---|---|
| Partner | |
| Contact | |
| Endpoint(s) reviewed | |
| Commit reviewed | |
| Review date | |
| Reviewer | |
| Follow-up date | |

**Inputs the partner must provide before the review starts:**

- Production (or staging) MCP endpoint URL.
- Read access to the MCP server source (repo link, tarball, or shared file).
- A bearer token scoped for audit use, or a staging endpoint with auth disabled, so `patchbay audit` can walk past the login wall.
- One paragraph on what the server is for and who its users are.

If any of these are missing, record what the partner said and what you did without it.

---

## Section 1 — Posture snapshot

Run `patchbay audit <endpoint> --auth=<token> --format=markdown --probe-headless-oauth --probe-dcr-loopback`. Paste the rendered Markdown here, then annotate:

- Which findings are already known to the partner.
- Which findings are false positives (link the verification evidence).
- Which findings the partner disputes and why.

Score: letter grade from `patchbay audit`, plus one sentence on what would raise it by one grade.

---

## Section 2 — Structural review (the architecture-review value-add)

For each heading, write one paragraph of opinion, not just facts. If the partner is doing something well, say so — this is not a defect list.

### 2.1 Transport & auth posture
- Which transport (HTTP + SSE, Streamable HTTP, stdio)?
- OAuth 2.1 profile: AS metadata (RFC 8414), PRM (RFC 9728), PKCE S256, RFC 8707 audience binding, RFC 9207 iss, RFC 7009 revocation, RFC 8252 loopback.
- Does the AS protect the server from token-passthrough? Can an attacker reuse a token minted for a different resource?

### 2.2 Tool surface
- Number of tools, average description length, naming convention.
- Poisoning resistance: do descriptions name unrelated capabilities, embed instructions, or reference resources the tool does not need?
- Annotations: are `readOnlyHint`, `destructiveHint`, `openWorldHint` set and honest?
- Is the schema restrictive enough to prevent tool-input injection against downstream systems?

### 2.3 Scope & authorisation design
- Do scopes map 1:1 to tools, or is there a "superuser" scope?
- Is there a scope-elevation path a legitimate client could trip into by mistake?
- For partners with their own user model: does their authorisation layer short-circuit the MCP scope check?

### 2.4 Resources & URI templates
- Which resource templates are exposed? Are any `file://`, `data://`, or unsanitised templates reachable?
- Does the server echo arbitrary bytes from upstream resources into tool results without escaping?

### 2.5 Manifest stability
- How often does `tools/list` change? Is there a pinned manifest?
- Would a silent schema change to a tool like `send_message` surprise the client?

### 2.6 Logging, telemetry, abuse
- What does the server log on tools/call? Does it log arguments? Where do logs go?
- Rate-limit or abuse protection on the auth-walled surface?
- A "hostile client" (one that calls every tool with every permutation) — what happens?

### 2.7 Supply chain
- How is the SDK pinned? Are the Python/TS SDK CVEs patched (CVE-2026-52869, CVE-2026-25536)?
- Build reproducibility: can an outsider rebuild the running image from the committed source?

### 2.8 Multi-tenant / data-isolation (if applicable)
- Does tenant A's token ever reach tenant B's resources?
- Is tenant id derived from the token, or from a parameter the client sends?

---

## Section 3 — Remediation plan

A prioritized list the partner's engineer can execute in a week. Each item names the owner candidate, the expected effort, and the blast radius if left unfixed.

| # | Item | Severity | Effort | Owner | Blast radius if unfixed |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |

---

## Section 4 — Follow-up & rescan

- Date of planned rescan: ____
- How we will measure "fixed": ____
- Are findings on this server going to appear on the public `patchbay-mcp.dev` leaderboard? If yes: embargoed until ____; if no: why.

---

## Section 5 — Reviewer notes (private)

Anything the partner said off the record that informs how patchbay should evolve. Stays in this file, not in public blog posts or LinkedIn threads.

---

*Template v1 — 2026-11-16. Based on the shape TC Antony (RagLeap) asked for when reviewing patchbay as a design partner. Future revisions land in this file; dated instantiations land in `docs/design-partners/<partner>-review.md`.*

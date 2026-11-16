# MCP Architecture Review — RSS-A

*Instance of [architecture-review-template.md](../architecture-review-template.md).*

## Section 0 — Scope & inputs

| Field | Value |
|---|---|
| Partner | RSS-A |
| Contact | Mike |
| Endpoint(s) reviewed | _pending partner input_ |
| Commit reviewed | _pending_ |
| Review date | _scheduled_ |
| Reviewer | Sarah Vogel (patchbay) |
| Follow-up date | _+2 weeks after first review_ |

**Inputs requested:**

- Production MCP endpoint URL.
- Read access to the MCP server source.
- Scoped bearer for audit, or a staging endpoint.
- One paragraph: what the server is for, who its users are.

---

## Section 1 — Posture snapshot

```bash
patchbay audit <endpoint> --auth=<token> --format=markdown \
  --probe-headless-oauth --probe-dcr-loopback \
  > docs/design-partners/rss-a-audit-raw.md
```

---

## Section 2 — Structural review

_Filled during the review session. RSS-A-specific concerns:_

- **2.2 Tool surface:** RSS content ingestion is a classic tool-poisoning vector. Feed items contain arbitrary attacker-controlled text that may be echoed back into tool descriptions or tool results. Needs extra attention to the sanitisation layer between feed content and MCP output.
- **2.4 Resources & URI templates:** The usual RSS attack is a feed item linking to `file://` or `data://` URIs expecting a tool to dereference them. Check whether the resource layer refuses non-http(s) schemes for user-supplied URIs.
- **2.6 Logging, telemetry, abuse:** Feed polling is a pull model; make sure nothing in the pull path logs the full feed body to a public telemetry stream.

(Remaining sub-headings as per template.)

---

## Section 3 — Remediation plan

| # | Item | Severity | Effort | Owner | Blast radius if unfixed |
|---|---|---|---|---|---|
| | _to be filled_ | | | | |

---

## Section 4 — Follow-up & rescan

- Planned rescan: 2 weeks after review delivery.
- Leaderboard inclusion: TBD with Mike.

---

## Section 5 — Reviewer notes (private)

_tbd during session._

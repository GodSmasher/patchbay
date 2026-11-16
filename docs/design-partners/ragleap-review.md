# MCP Architecture Review — RagLeap

*Instance of [architecture-review-template.md](../architecture-review-template.md).*

## Section 0 — Scope & inputs

| Field | Value |
|---|---|
| Partner | RagLeap |
| Contact | TC Antony |
| Endpoint(s) reviewed | _pending partner input_ |
| Commit reviewed | _pending_ |
| Review date | _scheduled_ |
| Reviewer | Sarah Vogel (patchbay) |
| Follow-up date | _+2 weeks after first review_ |

**Status:** Review scheduled. TC Antony's explicit requirement (verification badges, affected components, reproduction steps, remediation, confidence score in every finding) is now implemented in `@patchbay-nebius/audit-core@0.12.0` and will be used for Section 1.

**Inputs requested:**

- Production MCP endpoint URL (RagLeap's retrieval-augmented interface).
- Read access to the MCP server source.
- Scoped bearer for audit, or a staging endpoint.
- One paragraph: what the server is for, who its users are.

---

## Section 1 — Posture snapshot

Will be filled with the output of:

```bash
patchbay audit <endpoint> --auth=<token> --format=markdown \
  --probe-headless-oauth --probe-dcr-loopback \
  > docs/design-partners/ragleap-audit-raw.md
```

The 3-category Finding Schema v2 output is what TC Antony asked for:

- `[runtime-verified]` — patchbay reproduced the issue live against the endpoint.
- `[source-confirmed]` — patchbay saw the code path; did not exercise it.
- `[potential-fp]` — pattern matched; manual verification required.

Every finding now carries: verification, affected components, reproduction steps, recommended remediation, confidence.

---

## Section 2 — Structural review

_Filled during the review session. See template for the eight sub-headings:_

- 2.1 Transport & auth posture
- 2.2 Tool surface (RagLeap-specific concerns: retrieval tools can leak corpus content through tool-poisoning vectors; needs extra attention here)
- 2.3 Scope & authorisation design (relevant if RagLeap is multi-tenant across customer corpora)
- 2.4 Resources & URI templates (retrieval over `mcp://` or `file://` resources is their core surface)
- 2.5 Manifest stability
- 2.6 Logging, telemetry, abuse
- 2.7 Supply chain (SDK pin check; Python CVE-2026-52869 / TS CVE-2026-25536)
- 2.8 Multi-tenant / data-isolation

---

## Section 3 — Remediation plan

| # | Item | Severity | Effort | Owner | Blast radius if unfixed |
|---|---|---|---|---|---|
| | _to be filled_ | | | | |

---

## Section 4 — Follow-up & rescan

- Planned rescan: 2 weeks after review delivery.
- "Fixed" means: zero critical/high in the re-run of `patchbay audit`, plus the structural items in Section 2 marked ✅ by the reviewer.
- Leaderboard inclusion: TBD with TC Antony. Default: embargoed until the first rescan passes.

---

## Section 5 — Reviewer notes (private)

RagLeap's ask drove the Schema v2 design. Keep the 5-field-per-finding format stable across future reviews — breaking it would require re-negotiation with TC Antony.

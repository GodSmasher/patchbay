# @patchbay-nebius/audit-core

## 0.5.0 (2026-11-10)

### Added
- **HEADERS-001** (medium). Passive check on the response headers captured
  from the initialize probe. Flags: wildcard CORS combined with
  Access-Control-Allow-Credentials true; missing Strict-Transport-Security
  on HTTPS targets; missing X-Frame-Options with no CSP frame-ancestors
  fallback; missing X-Content-Type-Options nosniff. Aggregates all gaps
  into one finding so the report stays readable.
- **AUDIENCE-002** (critical, opt-in). Catches the early-exit validation
  bug `if (aud && aud !== me) reject` which lets JWTs with no `aud`
  claim through. Opt-in via `--probe-missing-aud=<token>` (CLI) or
  `probeMissingAudToken` (library) or `PATCHBAY_PROBE_MISSING_AUD_TOKEN`
  env var. Needs a validly signed bearer token whose JWT payload has no
  aud claim at all. Follow-up to AUDIENCE-001 raised by community (Issue
  #5). Reference: RFC 9068 Section 4.
- `RemoteProbe.responseHeaders` field exposes the lowercased response
  headers from the first reachable probe response, available to any
  future header-based check without an extra request.
- `RemoteProbe.missingAudProbe` field with `MissingAudProbeResult` type.

## 0.4.1 (2026-11-10)

0.4.0 was staged on npm but never published (a prior publish attempt
reserved the version without completing). 0.4.1 is the first live
release of the content below.

## 0.4.0 (2026-11-10)

### Added
- **RESOURCE-001** (high). Protected Resource Metadata (RFC 9728) check.
  Fires when a server that uses OAuth serves no
  `/.well-known/oauth-protected-resource` document or the document is
  missing a non-empty `authorization_servers` array. MCP authorization
  spec makes RFC 9728 mandatory since revision 2025-06-18 (retained in
  2026-07-28).
- **AUTH-007** (medium). Wrong HTTP status for an invalid bearer token.
  Captures the status the server returns to the existing dummy-bearer
  probe. Fires when that status is not 401 (most commonly 403). Per MCP
  authorization spec revision 2026-07-28: "Invalid or expired tokens
  MUST receive a HTTP 401 response." Includes the WWW-Authenticate
  header in evidence when present. New fields on `RemoteProbe`:
  `invalidTokenStatus`, `invalidTokenWwwAuthenticate`.
- **POISONING-001** (high / medium). Scans tool descriptions and
  input-schema parameter descriptions for prompt-injection payloads.
  High for hidden Unicode (zero-width characters, BOM, bidi overrides,
  Tag characters); medium for imperative role-marker patterns
  (`<SYSTEM>`-style tags, ignore-previous directives, role prefixes,
  markdown system headers).

### Changed
- **AUTH-003** evidence and confidence tightened. Previous wording called
  it a "metadata completeness finding, not a confirmed vulnerability"
  with medium confidence. The current spec (MCP 2026-07-28 security
  considerations) says that when `code_challenge_methods_supported` is
  absent, spec-compliant MCP clients MUST refuse to proceed, so this is
  a login-block for MCP clients even if the server would still enforce
  S256 at runtime for non-MCP clients. Confidence is now high.

## 0.3.4 (2026-11-10)

### Retired
- **AUTH-004.** Verified against RFC 8707, RFC 9728, the IANA OAuth
  Authorization Server Metadata registry, and MCP authorization spec
  revision 2026-07-28: `resource_indicators_supported` is not a defined
  metadata field in any of them. MCP 2026-07-28 explicitly states that
  clients send the `resource` parameter regardless of what the server
  advertises, so absence of this flag conveys nothing. AUTH-004 now
  returns no findings. ID is retained so stored reports keep resolving.
  AUDIENCE-001 (opt-in active probe) remains the authoritative check for
  whether a server validates the `aud` claim.

## 0.3.3 (2026-11-10)

### Fixed
- **AUTH-005.** MCP authorization spec revision 2026-07-28 deprecated
  Dynamic Client Registration (RFC 7591) in favor of Client ID Metadata
  Documents. Previous AUTH-005 fired high whenever `registration_endpoint`
  was missing, which is now a false positive against spec-conform CIMD-only
  servers. New logic:
  - pass when `client_id_metadata_document_supported: true` is advertised
  - info (no grade hit) when only `registration_endpoint` is advertised:
    "DCR used but deprecated per MCP 2026-07-28, consider adding CIMD"
  - high only when neither mechanism is advertised

## 0.3.2 (2026-11-09)

### Added
- **AUTH-006.** Active Dynamic Client Registration loopback probe.
  Registers a throw-away client against the authorisation server's
  `registration_endpoint` with `http://127.0.0.1:PORT/callback` and
  `http://localhost:PORT/callback` to verify RFC 8252 §7.3 compliance.
  Fires HIGH when the AS rejects loopback redirect URIs.
  Opt-in via `probeDcrLoopback: true` because it writes to the AS.
  Check idea originally raised in a community dev.to post, filed as
  Issue #4 by Reid Marlow.
- `DcrLoopbackResult` type on `RemoteProbe`
- `probeDcrLoopback` option on `AuditOptions` and `probeRemote`

### Check count: 15 → 16

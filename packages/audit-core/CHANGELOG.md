# @patchbay-nebius/audit-core

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

# @patchbay-nebius/audit-core

## 0.3.2 — 2026-11-09

### Added
- **AUTH-006** — active Dynamic Client Registration loopback probe.
  Registers a throw-away client against the authorisation server's
  `registration_endpoint` with `http://127.0.0.1:PORT/callback` and
  `http://localhost:PORT/callback` to verify RFC 8252 §7.3 compliance.
  Fires HIGH when the AS rejects loopback redirect URIs.
  Opt-in via `probeDcrLoopback: true` because it writes to the AS.
  Check idea originally raised in a community dev.to post, filed as
  Issue #4 by Reid Marlow.
- `DcrLoopbackResult` type on `RemoteProbe`
- `probeDcrLoopback` option on `AuditOptions` and `probeRemote`

### Check count: 14 → 15

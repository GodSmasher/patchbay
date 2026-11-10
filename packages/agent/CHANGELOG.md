# @patchbay-nebius/agent

## 0.7.0 (2026-11-10)

### Added
- `--probe-missing-aud=<token>` CLI flag (and
  `PATCHBAY_PROBE_MISSING_AUD_TOKEN` env var) to enable AUDIENCE-002:
  catches the `if (aud && aud !== me) reject` early-exit bug by probing
  with a bearer token whose JWT payload has no aud claim.

### Dependencies
- `@patchbay-nebius/audit-core` → 0.5.0 (adds HEADERS-001 and
  AUDIENCE-002; see its changelog).

## 0.6.1 (2026-11-10)

0.6.0 was staged on npm but never published (prior publish attempt
reserved the version without completing). 0.6.1 is the first live
release of the content below.

## 0.6.0 (2026-11-10)

### Dependencies
- `@patchbay-nebius/audit-core` → 0.4.0 (adds RESOURCE-001, AUTH-007,
  POISONING-001; tightens AUTH-003; see its changelog).

## 0.5.2 (2026-11-10)

### Dependencies
- `@patchbay-nebius/audit-core` → 0.3.4 (retires AUTH-004, see its
  changelog).

## 0.5.1 (2026-11-10)

### Dependencies
- `@patchbay-nebius/audit-core` → 0.3.3 (ships the AUTH-005 CIMD fix,
  see its changelog).

## 0.5.0 (2026-11-09)

### Added
- `--probe-dcr-loopback` CLI flag for `patchbay audit`. Opts into the
  AUTH-006 active DCR loopback probe (writes to the AS).
  `PATCHBAY_PROBE_DCR_LOOPBACK=1` works too.

### Dependencies
- `@patchbay-nebius/audit-core` → 0.3.2 (brings AUTH-006)

# @patchbay-nebius/agent

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

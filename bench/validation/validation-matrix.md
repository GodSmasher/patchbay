# patchbay audit-core golden-corpus validation matrix

Run: 2026-11-25T09:27:45.882Z
Cases: 15
Pass: 15 / 15

## Summary

| Case | Expected | Actual | FP | FN | Pass |
|---|---|---|---|---|---|
| `clean-tier1-no-oauth` | AUTH-001 | AUTH-001 | — | — | ✅ |
| `angelcam-like-two-mediums` | HEADERS-001, IDENTITY-001 | HEADERS-001, IDENTITY-001 | — | — | ✅ |
| `auth001-critical-tools-without-auth` | AUTH-001, HEADERS-001 | AUTH-001, HEADERS-001 | — | — | ✅ |
| `poisoning-001-zero-width` | AUTH-001, HEADERS-001, POISONING-001 | AUTH-001, HEADERS-001, POISONING-001 | — | — | ✅ |
| `resource-001-oauth-no-prm` | AUTH-005, IDENTITY-001, ISS-001, OAUTH-REVOCATION-001, RESOURCE-001 | AUTH-005, IDENTITY-001, ISS-001, OAUTH-REVOCATION-001, RESOURCE-001 | — | — | ✅ |
| `dual-resource-001-angelcam-pattern` | DUAL-RESOURCE-001 | DUAL-RESOURCE-001 | — | — | ✅ |
| `authority-attestation-did-web` | AUTH-001, AUTHORITY-ATTESTATION-001 | AUTH-001, AUTHORITY-ATTESTATION-001 | — | — | ✅ |
| `transport-001-plain-http` | AUTH-001, HEADERS-001, TRANSPORT-001 | AUTH-001, HEADERS-001, TRANSPORT-001 | — | — | ✅ |
| `secret-001-sk-proj-key` | SECRET-001 | SECRET-001 | — | — | ✅ |
| `poisoning-003-soft-imperative-andrii-vector` | AUTH-001, POISONING-003 | AUTH-001, POISONING-003 | — | — | ✅ |
| `session-binding-001-same-session-across-inits` | AUTH-001, SESSION-BINDING-001 | AUTH-001, SESSION-BINDING-001 | — | — | ✅ |
| `upstream-identity-bypass-001-accepted` | UPSTREAM-IDENTITY-BYPASS-001 | UPSTREAM-IDENTITY-BYPASS-001 | — | — | ✅ |
| `poisoning-003-pattern-b-camelcase-with-clause` | AUTH-001, POISONING-003 | AUTH-001, POISONING-003 | — | — | ✅ |
| `poisoning-003-bare-no-clause-known-boundary` | AUTH-001 | AUTH-001 | — | — | ✅ |
| `auth-006-dcr-loopback-rejected` | AUTH-006 | AUTH-006 | — | — | ✅ |

## Per-check tallies

| Check | Expected hits | Actual hits | FP | FN |
|---|---:|---:|---:|---:|
| `AUTH-001` | 9 | 9 | 0 | 0 |
| `AUTH-005` | 1 | 1 | 0 | 0 |
| `AUTH-006` | 1 | 1 | 0 | 0 |
| `AUTHORITY-ATTESTATION-001` | 1 | 1 | 0 | 0 |
| `DUAL-RESOURCE-001` | 1 | 1 | 0 | 0 |
| `HEADERS-001` | 4 | 4 | 0 | 0 |
| `IDENTITY-001` | 2 | 2 | 0 | 0 |
| `ISS-001` | 1 | 1 | 0 | 0 |
| `OAUTH-REVOCATION-001` | 1 | 1 | 0 | 0 |
| `POISONING-001` | 1 | 1 | 0 | 0 |
| `POISONING-003` | 2 | 2 | 0 | 0 |
| `RESOURCE-001` | 1 | 1 | 0 | 0 |
| `SECRET-001` | 1 | 1 | 0 | 0 |
| `SESSION-BINDING-001` | 1 | 1 | 0 | 0 |
| `TRANSPORT-001` | 1 | 1 | 0 | 0 |
| `UPSTREAM-IDENTITY-BYPASS-001` | 1 | 1 | 0 | 0 |

## Failing cases

None. Every case produces the expected finding set exactly.

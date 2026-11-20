# @patchbay-nebius/mcp

## 0.7.1 (2026-11-20) — SECURITY

Fixes CVE-XXXX-NNNNN (GHSA-xxxx-xxxx-xxxx): command injection via the
`scan_repo` MCP tool when the supplied URL passes the
`https://github.com/` prefix check but contains `$(...)` command
substitution, backticks, or other shell metacharacters.

Replaces the `execSync` call in `packages/mcp/src/server.ts` with
`execFileSync('git', ['clone', '--depth=1', '--', path, target])` — argv
array, no shell, `--` separator so a URL starting with `-` cannot be
parsed as a flag.

This is critical in agentic deployments: any LLM agent that can be
prompted into calling `scan_repo` with an attacker-controlled URL
executes commands as the user running the MCP server.

Dependency: `@patchbay-nebius/agent` bumped to `^0.17.1` for the same
fix in the `patchbay scan` CLI code path.

Reported and patched by Pietro Procaccini (responsible disclosure,
2026-11-20). Advisory text at
https://github.com/GodSmasher/patchbay/security/advisories/GHSA-xxxx-xxxx-xxxx.

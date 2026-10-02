# patchbay MCP – setup

patchbay ships an MCP server (`@patchbay/mcp`) that any MCP-speaking client can
call. It exposes three tools:

| Tool              | What it does                                                                    |
| ----------------- | ------------------------------------------------------------------------------- |
| `build_connector` | Full pipeline: plan → research → generate → verify (with repair). Returns files.|
| `research_api`    | Plan + Tavily-backed API research only. Returns the spec, cheap and fast.       |
| `verify_code`     | Type-check + vitest existing files in a sandbox, with repair. Live keys needed. |

While a tool runs, the server streams `notifications/message` (log lines) and,
when the client passed a `progressToken`, `notifications/progress` events, so
you see the plan/research/generate/verify steps live in the client UI.

## Requirements

- Node.js 20 or newer
- Repo cloned locally (patchbay is not on npm yet; use `tsx` on the source)
- For live runs: `NEBIUS_API_KEY`, `NEBIUS_AI_PROJECT`, `TAVILY_API_KEY`.
  Without them the server falls back to the recorded replay run
  (`Typeform → Pipedrive`), useful for demoing the tool wiring without spend.

## Command patchbay MCP starts with

From the repo root:

```
npx tsx packages/mcp/src/server.ts
```

or, once installed:

```
npx patchbay-mcp
```

`stderr` prints `patchbay MCP server vX.Y.Z ready on stdio` when the transport
is up. `stdout` is reserved for JSON-RPC; never write to it manually.

## Claude Code

```
claude mcp add patchbay -- npx -y tsx C:/Users/vogel/Desktop/patchbay/packages/mcp/src/server.ts
```

Or edit `~/.claude.json` (user scope) / `.mcp.json` (project scope) and add:

```json
{
  "mcpServers": {
    "patchbay": {
      "command": "npx",
      "args": ["-y", "tsx", "C:/Users/vogel/Desktop/patchbay/packages/mcp/src/server.ts"],
      "env": {
        "NEBIUS_API_KEY": "...",
        "NEBIUS_AI_PROJECT": "aiproject-...",
        "TAVILY_API_KEY": "...",
        "PATCHBAY_MOCK": "false"
      }
    }
  }
}
```

Restart Claude Code, then `/mcp` should show `patchbay` connected. In a chat:

> Use patchbay to build a connector: "When a Stripe payment succeeds, add the
> customer to a Mailchimp audience"

Claude Code will invoke `build_connector` and stream progress into the UI.

## Codex (OpenAI Codex CLI)

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.patchbay]
command = "npx"
args = ["-y", "tsx", "C:/Users/vogel/Desktop/patchbay/packages/mcp/src/server.ts"]

[mcp_servers.patchbay.env]
NEBIUS_API_KEY = "..."
NEBIUS_AI_PROJECT = "aiproject-..."
TAVILY_API_KEY = "..."
PATCHBAY_MOCK = "false"
```

Then start a Codex session – `patchbay` shows up under `/mcp list`.

## Cursor

Cursor reads `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` inside the
project. Same shape as Claude Code:

```json
{
  "mcpServers": {
    "patchbay": {
      "command": "npx",
      "args": ["-y", "tsx", "C:/Users/vogel/Desktop/patchbay/packages/mcp/src/server.ts"],
      "env": {
        "NEBIUS_API_KEY": "...",
        "NEBIUS_AI_PROJECT": "aiproject-...",
        "TAVILY_API_KEY": "...",
        "PATCHBAY_MOCK": "false"
      }
    }
  }
}
```

Reload Cursor (Cmd/Ctrl+Shift+P → "MCP: Restart"), then the tools appear under
Composer's tool picker.

## Environment variables

| Variable                | Required   | Default                                             | Meaning                                          |
| ----------------------- | ---------- | --------------------------------------------------- | ------------------------------------------------ |
| `NEBIUS_API_KEY`        | live       | –                                                   | Nebius Token Factory key                         |
| `NEBIUS_AI_PROJECT`     | nebius     | –                                                   | `aiproject-…` id                                 |
| `TAVILY_API_KEY`        | live       | –                                                   | Docs search                                      |
| `PATCHBAY_MOCK`         | –          | `true`                                              | Set to `"false"` to enable live runs             |
| `PATCHBAY_RUNNER`       | –          | `nebius`                                            | `local` uses the dev fallback runner             |
| `PATCHBAY_MAX_ATTEMPTS` | –          | `3`                                                 | Repair loop cap                                  |
| `PATCHBAY_PARALLEL_REPAIRS` | –      | `1`                                                 | N parallel repair variants per attempt (max 4)   |
| `NEBIUS_BASE_URL`       | –          | `https://api.tokenfactory.nebius.com/v1`            | OpenAI-compatible chat endpoint                  |
| `NEBIUS_SANDBOX_URL`    | –          | `https://api.tokenfactory.nebius.com/sandboxes/v1`  | Sandboxes REST base                              |
| `PATCHBAY_MODEL_FAST`   | –          | `nvidia/Nemotron-3_5-Lightning`                     | Plan model                                       |
| `PATCHBAY_MODEL_MID`    | –          | `nvidia/nemotron-3-super-120b-a12b`                 | Spec model                                       |
| `PATCHBAY_MODEL_STRONG` | –          | `nvidia/Nemotron-3-Ultra-550b-a55b`                 | Codegen + repair model                           |

## Verifying it works

Smoke test (mock mode, no keys needed):

```
npx tsx scripts/smoke-mcp.ts
```

Should print the tool list and stream progress events for a replay
`build_connector` call, ending with `green after 2 attempts (7/7 tests, typecheck ok)`.

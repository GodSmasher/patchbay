# @patchbay/mcp

[![patchbay](https://img.shields.io/badge/patchbay-github-181717?logo=github)](https://github.com/GodSmasher/patchbay)
[![MCP](https://img.shields.io/badge/MCP-stdio-6938EF)](https://modelcontextprotocol.io)

**patchbay as a Model Context Protocol server.** Call it from Claude Code, Codex or Cursor to generate a tested TypeScript connector from a one-sentence request.

Three tools exposed over stdio:

| Tool | What it does |
|---|---|
| `build_connector` | Full pipeline: plan → research → generate → verify (with repair). Returns files. |
| `research_api` | Plan + Tavily research only. Returns the spec. Cheap and fast. |
| `verify_code` | Type-check + vitest existing files in a Nebius sandbox, with repair. |

Each tool streams `notifications/progress` and `notifications/message` while it runs, so clients show live progress through plan → research → generate → verify.

## Install into Claude Code

```bash
claude mcp add patchbay -- npx -y @patchbay/mcp
```

Or edit `~/.claude.json`:

```json
{
  "mcpServers": {
    "patchbay": { "command": "npx", "args": ["-y", "@patchbay/mcp"] }
  }
}
```

That's it. Restart Claude Code, type `/mcp`, and `patchbay` shows up with its three tools.

## Environment

Set these for live runs (otherwise the server falls back to the recorded replay so demos still work):

```bash
NEBIUS_API_KEY=...
NEBIUS_AI_PROJECT=aiproject-...
TAVILY_API_KEY=...
PATCHBAY_MOCK=false
```

With `claude mcp add` you can inline them via `--env`, or just set them in your shell before launching Claude Code. See [docs/mcp-setup.md](https://github.com/GodSmasher/patchbay/blob/main/docs/mcp-setup.md) for Codex, Cursor and troubleshooting.

## Numbers

**90.2% green over 92 runs** · **52.2% first-try green** · **~$0.07 per connector**. Full breakdown in the main repo.

## Also runs as

- **CLI** — `npm install -g @patchbay/agent`
- **Web app** — live at <https://patchbay-nebius.vercel.app>
- **Slack slash command** — [docs/slack-setup.md](https://github.com/GodSmasher/patchbay/blob/main/docs/slack-setup.md)

Built for the [Nebius × NVIDIA Global AI Hackathon](https://nebiusglobalaihackathon.devpost.com).

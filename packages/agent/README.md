# @patchbay-nebius/agent

[![patchbay](https://img.shields.io/badge/patchbay-github-181717?logo=github)](https://github.com/GodSmasher/patchbay)
[![benchmark](https://img.shields.io/badge/benchmark-90%25%20green%20over%2092%20runs-brightgreen)](https://github.com/GodSmasher/patchbay/blob/main/bench/RESULTS-variance.md)

**Describe an integration in one sentence. Get a tested TypeScript connector.**

```bash
npx -y @patchbay-nebius/agent build "When a Stripe payment succeeds, add the customer to a Mailchimp audience with the plan as a tag"
```

patchbay plans the integration, reads the real API docs, writes a TypeScript connector with tests, runs them in an isolated Nebius sandbox with the network switched off, and repairs the code when a test fails. Up to 4 repair attempts, two parallel branches each; monotonic — it never hands back something strictly worse than it already had.

## Install

```bash
npm install -g @patchbay-nebius/agent    # exposes `patchbay` on your PATH
# or just
npx -y @patchbay-nebius/agent build "..."
```

## Use

```bash
patchbay build   [--record] "<one-sentence integration>"
patchbay research           "<one-sentence integration>"
patchbay verify  <directory>
patchbay help
```

### Programmatic

```ts
import { startRun, loadConfig } from '@patchbay-nebius/agent'

for await (const event of startRun('When a Jotform submission arrives, create a task in Asana', loadConfig())) {
  if (event.type === 'tests') console.log(event.report.passed, '/', event.report.total)
}
```

## Configuration (environment)

| Variable | Required | Default | What it does |
|---|---|---|---|
| `NEBIUS_API_KEY` | live | – | Nebius Token Factory key |
| `NEBIUS_AI_PROJECT` | nebius runner | – | `aiproject-…` id |
| `TAVILY_API_KEY` | live | – | Docs search |
| `PATCHBAY_MOCK` | – | `true` | `false` for live runs |
| `PATCHBAY_RUNNER` | – | `nebius` | `nebius` (isolated sandbox) or `local` |
| `PATCHBAY_MAX_ATTEMPTS` | – | `4` | Repair-loop cap |
| `PATCHBAY_PARALLEL_REPAIRS` | – | `2` | N parallel repair branches per attempt (max 4) |

The generated connector has **zero `@patchbay-nebius/agent` runtime dependency** – it's a plain TypeScript file you can drop into any project.

## Numbers

**90.2% green over 92 runs** · **52.2% first-try green** · **~$0.07 per connector** · **~45s wall-clock**.

Full breakdown and per-prompt stability in [bench/RESULTS-variance.md](https://github.com/GodSmasher/patchbay/blob/main/bench/RESULTS-variance.md).

## Also runs as

- **MCP server** for Claude Code / Codex / Cursor — see [@patchbay-nebius/mcp](https://www.npmjs.com/package/@patchbay-nebius/mcp)
- **Web app** — live at <https://patchbay-nebius.vercel.app>
- **Slack slash command** — see [docs/slack-setup.md](https://github.com/GodSmasher/patchbay/blob/main/docs/slack-setup.md)

Built for the [Nebius × NVIDIA Global AI Hackathon](https://nebiusglobalaihackathon.devpost.com).

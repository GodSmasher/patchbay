# patchbay

[![ci](https://github.com/GodSmasher/patchbay/actions/workflows/ci.yml/badge.svg)](https://github.com/GodSmasher/patchbay/actions/workflows/ci.yml)
[![benchmark](https://img.shields.io/badge/benchmark-19%2F20%20green%20·%20%240.86-brightgreen)](bench/RESULTS.md)
[![mcp](https://img.shields.io/badge/MCP-stdio-6938EF)](docs/mcp-setup.md)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![nebius](https://img.shields.io/badge/powered%20by-Nebius%20Token%20Factory-0F172A)](https://tokenfactory.nebius.com)

**Describe an integration in one sentence. Get a tested TypeScript connector.**

```
patchbay build "When a Stripe payment succeeds, add the customer to a Mailchimp audience with the plan as a tag"
```

patchbay runs five steps:

1. **Plan** – a fast model turns the sentence into source/target apps, trigger, action, docs queries, field mapping. Nemotron 3.5 Lightning.
2. **Research** – Tavily search + extract, biased toward each vendor's own domain, feeding a mid-tier model that produces a normalized API spec (endpoints, auth, example payloads). Nemotron 3 Super.
3. **Generate** – a strong model writes `src/connector.ts`, `src/connector.test.ts` and `README.md`. Nemotron 3 Ultra, 32k tokens, temperature 0.1.
4. **Verify** – a Nebius Token Factory sandbox installs TypeScript + vitest once (checkpointed), then every attempt forks that checkpoint with the generated files and networking disabled. `tsc --noEmit` and `vitest run` are the gate.
5. **Repair** – when a run is red, the strong model gets the file blocks and the failed test output, and tries again. Up to `PATCHBAY_MAX_ATTEMPTS` times (default 3). Optional parallel mode generates N variants at once, verifies them in parallel sandbox forks, keeps the first green.

Every endpoint in the spec comes with an example payload taken from the documentation; the generated test harness runs the connector against that payload (the "contract" check), so a run only counts as green when the generated code actually works with the shape the real API returns.

## Three ways to call it

**CLI** – `packages/agent/src/cli.ts`

```
patchbay build   [--record] "<one-sentence integration>"
patchbay research           "<one-sentence integration>"
patchbay verify  <directory>
```

**MCP server** – `packages/mcp/src/server.ts`, stdio transport.

Three tools (`build_connector`, `research_api`, `verify_code`) with live progress and logging notifications. Setup for Claude Code, Codex and Cursor in [docs/mcp-setup.md](docs/mcp-setup.md).

**Web app** – `apps/web`, Next.js 14 on port 3400. Replay-safe demo; a bundled recorded run (`Typeform → Pipedrive`) streams through the same UI as a live run.

## Status

Live benchmark (2026-10-02, Nebius sandbox, `bench/RESULTS.md`): **19/20 green, 10/20 on the first draft, $0.86 across 20 integrations.** The hard half of the benchmark covers HMAC verification, 429 retry with Retry-After, Idempotency-Key, cursor pagination, chained search-or-create and signature-driven routing — most finish in one or two attempts. The one remaining red (Shopify HMAC → Slack) was first-try green in an earlier pass and flipped on model variance; running the benchmark three times would smooth that out.

## Dev

```
npm install
cp .env.example .env.local            # fill in NEBIUS_API_KEY, NEBIUS_AI_PROJECT, TAVILY_API_KEY

npm test                              # vitest, replay mode, no keys needed
npm run typecheck                     # tsc across workspaces
npm run check:nebius                  # auth probe for inference + sandboxes + Tavily
npm run patchbay -- build "..."       # live run (needs keys)
npm run patchbay -- help              # all commands and flags
npm run bench                         # the 10-prompt benchmark
npm run dev                           # Next.js app on :3400
npm run mcp                           # start the MCP server on stdio
```

## Environment

See [`.env.example`](.env.example). Key knobs:

| Variable | Default | What it does |
|---|---|---|
| `PATCHBAY_MOCK` | `true` | Replay mode. Set to `false` for live runs. |
| `PATCHBAY_RUNNER` | `nebius` | `nebius` (isolated sandbox) or `local` (dev fallback). |
| `PATCHBAY_MAX_ATTEMPTS` | `3` | Repair-loop cap. |
| `PATCHBAY_PARALLEL_REPAIRS` | `1` | N parallel repair branches per attempt (max 4). Best-of-N. |
| `PATCHBAY_MODEL_FAST / MID / STRONG` | nvidia/Nemotron 3.5 Lightning / 3 Super / 3 Ultra | Model tiers. Any OpenAI-compatible base URL works. |

The generated connector has **zero patchbay dependency** – it's a plain TypeScript file your project can drop in anywhere.

## Repo layout

```
packages/
  agent/   # the pipeline (plan, research, generate, verify, repair) + CLI
  mcp/     # MCP server exposing build_connector / research_api / verify_code
apps/
  web/     # Next.js demo
bench/     # the 10-prompt benchmark + results
docs/      # setup guides
runs/      # recorded live runs (gitignored)
```

## Deploy

The web demo is a Next.js app with one SSE route (`/api/run`). An in-memory IP rate limit caps live runs at `PATCHBAY_MAX_RUNS_PER_HOUR` (default 6) per hour and silently falls back to the recorded replay when exceeded, so a hug-of-death doesn't burn through credits. For Vercel: `apps/web/vercel.json` pins the route's function to a 300s timeout (needs a Pro plan; on Hobby, add `?replay=1` or set `PATCHBAY_MOCK=true` to keep every call under 10s).

---

Built for the [Nebius × NVIDIA Global AI Hackathon](https://nebiusglobalaihackathon.devpost.com). Track: Coding & Agentic Engineering.

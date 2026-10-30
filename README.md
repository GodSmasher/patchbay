# patchbay

![patchbay — one sentence in, tested TypeScript connector out](docs/screenshots/patchbay-01-hero-calendly-slack.gif)


[![ci](https://github.com/GodSmasher/patchbay/actions/workflows/ci.yml/badge.svg)](https://github.com/GodSmasher/patchbay/actions/workflows/ci.yml)
[![status](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fpatchbay.openstatus.dev%2Fapi%2Fstatus%2Fcurrent.json&query=%24.status.description&label=status&color=brightgreen)](https://patchbay.openstatus.dev)
[![benchmark](https://img.shields.io/badge/benchmark-90%25%20TS%20%C2%B7%2073%25%20Py%20over%20192%20runs-brightgreen)](bench/RESULTS-variance.md)
[![mcp](https://img.shields.io/badge/MCP-4%20tools-6938EF)](docs/mcp-setup.md)
[![huggingface](https://img.shields.io/badge/%F0%9F%A4%97%20dataset-connector--repair-FF9D00)](https://huggingface.co/datasets/patchbay-nebius/connector-repair-dataset)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![nebius](https://img.shields.io/badge/powered%20by-Nebius%20Token%20Factory-0F172A)](https://tokenfactory.nebius.com)

### Works with

<p>
  <a href="docs/mcp-setup.md"><img src="docs/assets/claude-anim.svg" alt="Claude Code" height="32" title="Claude Code via MCP"/></a>
  &nbsp;
  <a href="docs/mcp-setup.md"><img src="https://img.shields.io/badge/-Cursor-000000?style=for-the-badge&logo=cursor&logoColor=white" alt="Cursor" height="28"/></a>
  <a href="docs/mcp-setup.md"><img src="https://img.shields.io/badge/-Codex-412991?style=for-the-badge&logo=openai&logoColor=white" alt="Codex" height="28"/></a>
  <a href="docs/slack-setup.md"><img src="https://img.shields.io/badge/-Slack-4A154B?style=for-the-badge&logo=slack&logoColor=white" alt="Slack" height="28"/></a>
  <a href=".github/workflows/patchbay-pr.yml"><img src="https://img.shields.io/badge/-GitHub%20PR-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Actions" height="28"/></a>
  <a href="Dockerfile"><img src="https://img.shields.io/badge/-Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" height="28"/></a>
  <a href="https://patchbay-nebius.vercel.app"><img src="https://img.shields.io/badge/-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" height="28"/></a>
  <a href="https://www.npmjs.com/package/@patchbay-nebius/agent"><img src="https://img.shields.io/badge/-npm-CB3837?style=for-the-badge&logo=npm&logoColor=white" alt="npm" height="28"/></a>
</p>

**Describe an integration in one sentence. Get a tested connector — TypeScript or Python — that already passed its own tests.**

```
# TypeScript (vitest + injected fetch)
patchbay build "When a Stripe payment succeeds, add the customer to a Mailchimp audience with the plan as a tag"

# Python 3.12 (pytest + injected async transport)
patchbay build --lang=python "When a Stripe payment succeeds, add the customer to a Mailchimp audience with the plan as a tag"
```

**90.2% green on TS Core 20 · 73.3% green on Python Core 20 · 70.0% on Python Brutal 20 — measured across 192 live Nebius Sandbox runs with per-run JSON committed to the repo.** Fine-tune live on Nebius AI Cloud (Qwen3-30B-A3B on 173 of patchbay's own red→green repair pairs, served from an H100 NVLink GPU behind an OpenAI-compatible vLLM endpoint). Dual-language toggle on the live site at **https://patchbay-nebius.vercel.app**, public uptime at **https://patchbay.openstatus.dev**, open-source training dataset on [🤗 patchbay-nebius/connector-repair-dataset](https://huggingface.co/datasets/patchbay-nebius/connector-repair-dataset).

## The numbers

Every row is a live Nebius Sandbox run with the per-attempt files, test report and sandbox operation id committed under [`bench/runs/`](bench/runs/) — not cherry-picked cases. Full tables and per-prompt breakdowns in [bench/RESULTS-variance.md](bench/RESULTS-variance.md).

| Set | Shape | Runs | Green | First-try | Cost / build |
|---|---|---|---|---|---|
| **TS Core 20** | common integrations (Stripe→Mailchimp, Shopify→Airtable, …) | 92 | **90.2%** | 52.2% | $0.07 |
| **TS Brutal 10** | adversarial (OAuth refresh, WebSocket, HMAC, cursor paging) | 13 | 69.2% | 23.1% | $0.18 |
| **Python Core 20** | same 20 prompts as TS Core, Python+pytest sandbox | 60 | **73.3%** | 31.7% | $0.07 / green build |
| **Python Brutal 20** | adversarial (SOAP, GraphQL federation, long-poll, dedup) | 40 | **70.0%** | — | $0.16 |
| TS × Nemotron Super ablation | strong-step downgraded 550B → 120B, same prompts | 60 | 46.7% | 8.3% | $0.06 |

**Reading these:** the common-case Python gap (17 points vs TS Core) **closes on hard cases** — Python Brutal matches TS Brutal within one point. The Super ablation shows Ultra isn't overkill: dropping to the mid-tier halves the green rate because the saved per-call cost gets eaten by extra repair attempts.

## How it works

patchbay runs five steps:

1. **Plan** – a fast model turns the sentence into source/target apps, trigger, action, docs queries, field mapping. Nemotron 3.5 Lightning.
2. **Research** – Tavily search + extract, biased toward each vendor's own domain, feeding a mid-tier model that produces a normalized API spec (endpoints, auth, example payloads). Nemotron 3 Super.
3. **Generate** – a strong model writes the connector, its tests and a README. TypeScript (`src/connector.ts` + vitest) by default; `--lang=python` writes `connector.py` + pytest. Nemotron 3 Ultra, 32k tokens, temperature 0.1.
4. **Verify** – a Nebius Token Factory sandbox pulls the right base image once and installs the test deps (vitest + typescript, or pytest + pytest-asyncio + pytest-json-report) into a checkpointed image. Every attempt forks that checkpoint with the generated files and networking disabled. For TS the gate is `tsc --noEmit` then `vitest run`; for Python it is `python -m compileall` then `pytest -q --json-report`.
5. **Repair** – when a run is red, the strong model gets the file blocks and the failed test output, and tries again. Up to `PATCHBAY_MAX_ATTEMPTS` times (default 3). Optional parallel mode generates N variants at once, verifies them in parallel sandbox forks, keeps the first green.

Every endpoint in the spec comes with an example payload taken from the documentation; the generated test harness runs the connector against that payload (the "contract" check), so a run only counts as green when the generated code actually works with the shape the real API returns.

## Dual-language, first-class

TypeScript and Python share one plan + research step — only the generate prompt, the sandbox image and the test harness swap. The hosted demo at [patchbay-nebius.vercel.app](https://patchbay-nebius.vercel.app) has a **TypeScript · Python · Both** toggle; "Both" fires two live Nebius pipelines side-by-side so you watch the same prompt land in both languages at once.

The Python target ships `fixtures.py` with the same shape as `src/fixtures.ts`: `SOURCE_EXAMPLE`, `TARGET_ENDPOINTS`, `contract_fetch()`, `fake_fetch()`, `json_response()`. Connectors export `async def handle(payload, config)` with an injected async transport in `config['fetch']`, so tests stay hermetic (no network, no real httpx client). URL matcher handles placeholder segments (`{id}`, `:id`, `<id>`) and region subdomains. See [bench/RESULTS-variance.md](bench/RESULTS-variance.md#python-core-20-variance-pass-2026-10-28) for the per-prompt breakdown.

**Carve-outs:** `PATCHBAY_RUNNER=local` only runs TS. The hosted site's recorded replays are TS-only recordings, so without live keys the Python toggle shows the TS replay with a note.

## Training our own repair model on our own benchmark runs

Every patchbay benchmark run is a record of the agent failing and then fixing itself. **173** of those `(red draft + failing test report) → green draft` moments across the committed benchmark passes make a domain-matched training set — and Nebius Token Factory ships an OpenAI-compatible fine-tune endpoint that eats exactly this format. So we fine-tuned **Qwen/Qwen3-30B-A3B-Instruct-2507** on patchbay's own repair history. The deployment path uses a second Nebius product: trained checkpoints come out via `/fine_tuning/jobs/{id}/checkpoints`, land on a Nebius AI Cloud GPU (H100 NVLink preemptible) behind a vLLM OpenAI-compatible endpoint, and `PATCHBAY_REPAIR_LLM_BASE_URL` points patchbay's repair step at the self-hosted model. **Three Nebius products in one closed loop:** Token Factory Inference (live agent) → Token Factory Post-training (fine-tune) → AI Cloud GPU (serve the fine-tune).

- [`bench/training-{train,eval}.jsonl`](bench/) — 98 train + 11 eval real red→green repair pairs, extracted from committed benchmark runs. Also mirrored on HuggingFace as [patchbay-nebius/connector-repair-dataset](https://huggingface.co/datasets/patchbay-nebius/connector-repair-dataset) with a train/eval split.
- [`scripts/finetune.ts`](scripts/finetune.ts) — upload / start / watch Nebius fine-tune jobs (takes `--context=32768` to fit our 20k-token repair pairs).
- [`scripts/finetune-checkpoint.ts`](scripts/finetune-checkpoint.ts) — poll a job to completion, fetch the checkpoint URL, print the exact AI Cloud deploy next steps.
- [`scripts/vllm-deploy/`](scripts/vllm-deploy/) — Dockerfile + run.sh to serve the fine-tuned weights on an H100 / H200.
- [`scripts/bench-finetuned-ablation.ts`](scripts/bench-finetuned-ablation.ts) — side-by-side fine-tuned vs Ultra-baseline over the TS Core 20.
- [`scripts/eval-repair.ts`](scripts/eval-repair.ts) — format, file-coverage and line-overlap metrics against the held-out eval split.
- Full plan + status (updated as the job progresses): [docs/finetune.md](docs/finetune.md).

## Evidence export

Every live build offers a one-click **Evidence .zip** download on the site. Trust but verify — the whole run is auditable without re-executing anything:

```
connector/          final files (ready to drop into a repo)
trajectory/
  attempt-1/
    <files>
    report.json     the test report for that attempt
  attempt-2/ …      every repair attempt the agent made
prompt.txt          the one-sentence prompt
plan.json           source app, target app, field mapping
spec.json           researched API spec (endpoints, auth, example payloads)
usage.json          per-call model usage + cost + total
manifest.json       issuedAt, finalResult, sandbox operation IDs, SHA-256 of every file, verify instructions
README.md           what each file is + how to recompute hashes
```

The `sandboxOperationIds` in `manifest.json` are Nebius Token Factory operation IDs — your project's operation history retains the exact command patchbay ran, its exit code, and its stdout for each one. Recompute hashes locally with `shasum -a 256`; mismatch means somebody edited the artifact after export.

## Three ways to call it

**CLI** – [`@patchbay-nebius/agent`](https://www.npmjs.com/package/@patchbay-nebius/agent) on npm

```
npx -y @patchbay-nebius/agent build "When a Stripe payment succeeds, add the customer to a Mailchimp audience"
# or
npm install -g @patchbay-nebius/agent
patchbay build   [--record] [--lang=python] "<one-sentence integration>"
patchbay research [--lang=python]            "<one-sentence integration>"
patchbay verify  [--lang=python] <directory>
patchbay scan    <directory-or-github-url> [--build-top=<n>] [--lang=python]
```

**`patchbay scan <dir-or-github-url>` — autonomous repo scanner.** Walks any repository (local directory OR a GitHub URL, which patchbay shallow-clones for you) and reports the integration opportunities patchbay could build: TypeScript Express/Next/Fastify webhook handlers that only contain `TODO` or `throw not implemented`, **Python FastAPI/Flask routes with `pass` bodies or `raise NotImplementedError`**, `.env.example` entries pointing at vendor APIs with no implementation, TODO/FIXME comments mentioning Stripe/Mailchimp/Shopify/… and vendor SDKs that are imported but barely used. Each opportunity ships with a ready-to-run prompt and a priority score; `--build-top=N` runs the full pipeline on the top N automatically.

```
npx -y @patchbay-nebius/agent scan https://github.com/<some>/<repo>
```

**MCP server** – [`@patchbay-nebius/mcp`](https://www.npmjs.com/package/@patchbay-nebius/mcp) on npm, stdio transport.

**Four tools** — `scan_repo` (any local path or GitHub URL, returns ranked opportunities with ready-to-run prompts; TS + Python aware), `build_connector` (full pipeline, `lang: "ts" | "py"`), `research_api` (plan + Tavily spec, no code), `verify_code` (sandbox verify + repair existing files, auto-detects language). Live progress + logging notifications.

```
claude mcp add patchbay -- npx -y @patchbay-nebius/mcp
```

Full setup for Claude Code, Codex and Cursor in [docs/mcp-setup.md](docs/mcp-setup.md).

**Web app** – `apps/web`, Next.js 14 on port 3400. Live demo at **https://patchbay-nebius.vercel.app**. The same UI streams a live Nebius run or, past the 6/hour per-IP rate limit, the recorded replay. Shareable scan URLs (`?scan=owner/name`) and shareable run URLs. Public uptime at **https://patchbay.openstatus.dev**.

**Slack** – `/patchbay <one-sentence integration>` as a slash command. Setup in [docs/slack-setup.md](docs/slack-setup.md); the endpoint lives at `apps/web/app/api/slack/command/route.ts` on the same Vercel deploy.

**GitHub PR** – comment `/patchbay build "<integration>"` on any PR and the workflow in [`.github/workflows/patchbay-pr.yml`](.github/workflows/patchbay-pr.yml) runs the full pipeline, attaches the generated connector as an artifact and replies with the test score. Needs the three Nebius / Tavily secrets configured in the repo.

## Why not just ask Claude Code / Cursor / Codex yourself?

Same connector, same requirements. Rough per-connector cost:

| Where | Cost | Factor |
|---|---|---|
| **patchbay** (Nemotron on Nebius) | **~$0.07** | 1× |
| Claude Code with Haiku 5.5 | ~$0.10 | 1.4× |
| Claude Code with Sonnet 5.5 | ~$0.35 | 5× |
| Claude Code with Opus 4.7 | ~$1.90 | **27×** |

**$0.07 vs ~$1.90 for the same connector. The tests run before you see the file.**

The agent in your IDE is a generalist. For integration connectors — read the docs, map fields, write the thing, prove it works — that's work with hard structure, and a specialized pipeline on cheap models beats a general-purpose agent on expensive ones. Same reason you don't ask Opus to format JSON.

**patchbay sits inside your editor as an MCP server** (`claude mcp add patchbay -- npx -y @patchbay-nebius/mcp`), so you keep using Claude Code / Cursor / Codex for everything else — architecture, refactors, bug hunts — and offload connector work to patchbay. Your Claude usage bill goes down for the task Claude is slowest *and* most expensive at.

The generated connector is **plain TypeScript — or Python 3.12 — in your repo**, no runtime dependency on patchbay. Read it, change it, ship it.

## Selfhost

```bash
git clone https://github.com/GodSmasher/patchbay
cd patchbay
cp .env.example .env.local            # fill in NEBIUS + TAVILY keys
docker compose up --build
# open http://localhost:3400
```

The Dockerfile is a three-stage build (deps → build → runtime) producing a ~90 MB image around Next.js's standalone server. docker-compose.yml wires the env vars through from `.env.local`; without live keys the web app streams the recorded replay instead.

## Build in public

What broke this week and how it got fixed is in [docs/build-log.md](docs/build-log.md). Short version: nested-contract regex (+2 benchmark points), parallel-repair fiasco (reverted), monotonic repair (never regress past the best attempt), timestamp prompt (don't reject the documented example), esbuild preflight (first-try rate 33% → 52%), Vercel monorepo pain (three fixes, one deploy), URL FIDELITY + idempotent-upsert worked examples for Python (closed 2 of the hardest TS→Python green-rate gaps).

## Dev

```
npm install
cp .env.example .env.local            # fill in NEBIUS_API_KEY, NEBIUS_AI_PROJECT, TAVILY_API_KEY

npm test                              # vitest, replay mode, no keys needed
npm run typecheck                     # tsc across workspaces
npm run check:nebius                  # auth probe for inference + sandboxes + Tavily
npm run patchbay -- build "..."       # live run (needs keys)
npm run patchbay -- help              # all commands and flags
npm run bench                         # the 20-prompt benchmark
npm run dev                           # Next.js app on :3400
npm run mcp                           # start the MCP server on stdio
```

## Environment

See [`.env.example`](.env.example). Key knobs:

| Variable | Default | What it does |
|---|---|---|
| `PATCHBAY_MOCK` | `true` | Replay mode. Set to `false` for live runs. |
| `PATCHBAY_LANG` | `ts` | `ts` (TypeScript+vitest) or `python` (Python 3.12+pytest). |
| `PATCHBAY_RUNNER` | `nebius` | `nebius` (isolated sandbox) or `local` (dev fallback, TS only). |
| `PATCHBAY_MAX_ATTEMPTS` | `3` | Repair-loop cap. |
| `PATCHBAY_PARALLEL_REPAIRS` | `1` | N parallel repair branches per attempt (max 4). Best-of-N. |
| `PATCHBAY_MODEL_FAST / MID / STRONG` | nvidia/Nemotron 3.5 Lightning / 3 Super / 3 Ultra | Model tiers. Any OpenAI-compatible base URL works. |
| `PATCHBAY_LLM_BASE_URL` / `PATCHBAY_LLM_PROVIDER` | (unset) / `nebius` | Point patchbay at any OpenAI-compatible endpoint — including a self-hosted vLLM serving our fine-tuned Qwen3-30B. |

The generated connector has **zero patchbay dependency** – it's a plain TypeScript or Python file your project can drop in anywhere.

## Repo layout

```
packages/
  agent/   # the pipeline (plan, research, generate, verify, repair) + CLI + scanner
  mcp/     # MCP server exposing scan_repo / build_connector / research_api / verify_code
apps/
  web/     # Next.js demo
bench/     # the 20-prompt benchmark + results + training data
docs/      # setup guides + build log + finetune plan
scripts/   # finetune launcher, checkpoint fetch, vllm-deploy, ablation bench
runs/      # recorded live runs (gitignored)
```

## Deploy

The web demo is a Next.js app with one SSE route (`/api/run`). An in-memory IP rate limit caps live runs at `PATCHBAY_MAX_RUNS_PER_HOUR` (default 6) per hour and silently falls back to the recorded replay when exceeded, so a hug-of-death doesn't burn through credits. For Vercel: `apps/web/vercel.json` pins the route's function to a 300s timeout (needs a Pro plan; on Hobby, add `?replay=1` or set `PATCHBAY_MOCK=true` to keep every call under 10s).

---

Built for the [Nebius × NVIDIA Global AI Hackathon](https://nebiusglobalaihackathon.devpost.com). Track: Coding & Agentic Engineering.

# Devpost submission — patchbay

Everything below is written to copy-paste straight into the Devpost form at
<https://nebiusglobalaihackathon.devpost.com>. Fields in Devpost's own order.

Track: **Coding and Agentic Engineering**
Partner prizes to tick: **Nebius** (host), **Tavily** (uses the search API for the research step)

---

## Project name

```
patchbay
```

## Tagline (elevator pitch, 200 chars)

```
One sentence in, tested TypeScript connector out. $0.07 per run — 27× cheaper than Claude Opus for the same thing, with tests that run before you see the file.
```

(168 characters — well under the Devpost 200-char limit.)

## Try it out URLs (one line each)

```
https://patchbay-nebius.vercel.app
https://github.com/GodSmasher/patchbay
https://patchbay.openstatus.dev
```

## Video demo URL

```
<paste the YouTube unlisted URL once uploaded>
```

---

## About the project

### Inspiration

Every "AI writes code" demo stops at the point where the code appears on screen.
Nobody shows it actually running. For integration code — webhooks, API calls,
auth headers, retry logic — that's exactly where the hard part begins. The
model's draft is usually "shaped like" the right code but silently wrong about
one header name or one URL path, and you only find out in production.

patchbay was built to close that gap. The agent generates the connector *and*
runs it against the real documented example payload inside an isolated sandbox
with the network switched off, before you ever see the file. If it fails, the
model gets the failure and tries again — up to four times, two parallel repair
branches each.

### What it does

You type one sentence: `When a Stripe payment succeeds, add the customer to a
Mailchimp audience with the plan as a tag.`

patchbay runs a five-step pipeline:

1. **Plan** — a fast Nemotron (3.5 Lightning) turns the sentence into source
   app, target app, trigger, action, field mapping. Supports chained flows
   with `additionalTargets` (e.g. GitHub → post comment back to Zendesk).
2. **Research** — Tavily searches the vendors' own documentation and extracts
   the real endpoints. A mid-tier Nemotron (3 Super) distills them into a spec
   with example payloads taken straight from the docs.
3. **Generate** — Nemotron 3 Ultra writes the connector, its tests and a
   README. TypeScript (`src/connector.ts` + vitest) by default, Python 3.12
   (`connector.py` + pytest, hermetic async transport injected into the
   handler) when you pass `--lang=python`.
4. **Verify** — a Nebius Token Factory sandbox pulls the right base image
   once and installs the test deps into a checkpointed image. Every attempt
   forks that checkpoint with the generated files and networking disabled.
   For TS the gate is `tsc --noEmit` then `vitest run`; for Python it is
   `python -m compileall` then `pytest -q --json-report`. A pre-sandbox
   `esbuild` parse (TS) catches syntax breaks in milliseconds so they don't
   burn a full sandbox round.
5. **Repair** — when a run is red, two parallel branches of the strong model
   get the failing output at different temperatures (0.1 and 0.4). The first
   one that lands green wins. Monotonic — the agent never hands back a draft
   strictly worse than one it already had.

Every endpoint in the spec comes with an example payload taken from the
documentation; the generated test harness runs the connector against that
payload (the "contract" check), so a run only counts as green when the code
actually works with the shape the real API returns.

### How we built it

**Models and sandbox** — Nemotron 3.5 Lightning, Nemotron 3 Super, Nemotron 3
Ultra, all on Nebius Token Factory. Verification runs in Nebius Sandboxes with
networking disabled per fork. The agent is OpenAI-compatible under the hood,
so pointing it at another provider is one env var.

**Research** — Tavily for both search (biased toward each vendor's own domain)
and page extraction. Official-source ranking so the spec is grounded in real
docs, not guesses.

**Six ways to call it** — the same pipeline is exposed as:
- A CLI (`patchbay build / research / verify / add / push`)
- An MCP server for Claude Code, Codex and Cursor (`npx -y @patchbay-nebius/mcp`)
- A Next.js web demo with a live timeline
- A Slack slash command (`/patchbay build "..."`)
- A GitHub Action that reacts to `/patchbay build` in PR comments
- `patchbay push` that opens a pull request on your target repo with the
  finished connector

**Operations** — Docker + docker-compose for selfhost, published to npm as
`@patchbay-nebius/agent` and `@patchbay-nebius/mcp`, GitHub Actions CI on every push,
openstatus.dev watches the web demo and the Nebius + Tavily upstreams, badge
on the README refreshes live.

### Challenges we ran into

- **The contract test that silently never ran.** Our regex was anchored at the
  start of the vitest `fullName` so a nested `describe('contract', ...)` block
  inside an outer `describe('connector', ...)` was classified as "did not run."
  Two prompts stayed red for 10% of their benchmark attempts. The fix was ten
  characters (word-boundary match). Benchmark jumped from 8/10 to 10/10 on the
  core set.
- **Parallel repair made things worse.** Three branches at temperatures 0.1 /
  0.4 / 0.7 produced too much variance — the "best of three" was often "best of
  three near-misses." Rolled back to two branches, variance benchmark went back
  up.
- **Repair that rewrote the whole file worse than before.** HubSpot → Salesforce
  hit 13/14 on attempt 2, then regressed to a 0/2 syntax error on attempt 3 and
  the agent handed back the worse one. Fixed by making repair *monotonic* —
  score every attempt and only accept the next if it's strictly better.
- **The model locked us out with a timestamp check.** Linear → Discord kept
  failing because the generated connector added a sensible webhook-age guard
  that rejected the frozen 2024 timestamp in the documented example. Prompt
  change: never reject SOURCE_EXAMPLE based on wall-clock time, freeze with
  `vi.useFakeTimers` instead.
- **Vercel monorepo gymnastics.** Three independent failures on the first
  deploy — `tsconfig` extends chain broken by rootDirectory, esbuild bundled
  into webpack by mistake, workspace symlinks invisible to the build. Fixed
  with inline tsconfig, server-externals, and project settings via the Vercel
  API instead of the dashboard.

Full post-mortems with the exact diffs live in
[docs/build-log.md](https://github.com/GodSmasher/patchbay/blob/main/docs/build-log.md).

### Autonomous mode — `patchbay scan .`

patchbay doesn't wait for you to describe an integration. Point it at a repo:

```
patchbay scan .
```

and it walks the codebase for integration opportunities: webhook handlers with empty bodies or `TODO: implement`, `.env.example` entries that point at Stripe / Mailchimp / Shopify / Slack / Twilio / Pipedrive / HubSpot / … with no corresponding code, TODO comments naming a vendor and an action, vendor SDKs that are imported but barely used. Each opportunity gets a priority score, a ready-to-run `patchbay build "…"` prompt, and `--build-top=N` runs the pipeline on the top N without you typing a sentence.

It's one thing to turn a sentence into code. It's another to turn a codebase into a to-do list of integrations and then execute them. The vendor catalogue is 30+ names and the heuristics are regex-only, so there's no LLM cost until the user actually says "build the top 3".

### We fine-tune our own repair model on our own benchmark runs

Every patchbay benchmark run is a record of the agent failing and then fixing itself. 68 of those `(red draft + failing test) → green draft` moments across five benchmark passes make a domain-matched training set — and Nebius Token Factory ships an OpenAI-compatible fine-tune endpoint that eats exactly this format. So we fine-tune a repair-focused **Nemotron 3.5 Lightning** on patchbay's own repair history.

If it matches **Nemotron 3 Ultra 550B** (patchbay's current repair model) on the held-out eval set, we close the loop: patchbay generates benchmark runs → runs train its own repair model → next benchmark's repair cost drops ~50× while the green rate holds. All in-repo:

- `bench/training-data.jsonl` — 68 real red→green repair pairs, extracted from committed benchmark runs. Also published on HuggingFace: [patchbay-nebius/connector-repair-dataset](https://huggingface.co/datasets/patchbay-nebius/connector-repair-dataset)
- `scripts/finetune.ts` — Nebius Token Factory fine-tune job launcher
- `scripts/eval-repair.ts` — format, file-coverage and line-overlap metrics against a held-out eval split
- Full plan + results: `docs/finetune.md`

This loop uses Token Factory for both inference and fine-tuning, and the dataset is the committed benchmark runs — not scraped from anywhere else.

### Why not just ask Claude Code / Cursor / Codex yourself?

Same connector, same requirements, rough per-connector cost:

- **patchbay** (Nemotron on Nebius): **~$0.07**
- Claude Code with Haiku 5.5: ~$0.10 (1.4× more)
- Claude Code with Sonnet 5.5: ~$0.35 (5× more)
- Claude Code with Opus 4.7: **~$1.90 (27× more)**

The agent in your editor is a generalist. For integration work — read the docs, map fields, write it, prove it — a specialized pipeline on cheap-but-capable Nemotron models beats a general-purpose agent on expensive ones.

patchbay sits inside Claude Code / Cursor / Codex as an MCP server, so you keep the generalist for architecture and refactors, and hand off connector work to patchbay. Your Claude usage bill goes down for the task Claude is slowest *and* most expensive at. The generated connector is plain TypeScript in your repo — read it, change it, ship it.

### Accomplishments we're proud of

- **Two benchmarks, both committed:** The 20-prompt core (easier integrations
  like Typeform → Pipedrive, Shopify → Airtable) runs at **90.2% green · 52% first-try ·
  $0.07/connector** over 5 passes = 92 runs (2026-10-06). The extended **brutal 10**
  (WebSocket to Pusher, OAuth2 refresh, chained flows, S3 presigned URLs, GraphQL
  nested mutations, HMAC-signed server events) runs at **69% green · 23% first-try ·
  $0.17/connector** (2026-10-21). Reproduce via `npm run bench -- --passes=5`.
- Six distribution surfaces for one agent: a CLI (`patchbay build`), an MCP
  server (`claude mcp add patchbay`), a web demo with live-streamed pipeline,
  a Slack slash command, a GitHub Action and a `patchbay push` subcommand
  that opens a PR with the generated connector.
- Public uptime monitoring from day 13. The web app and both upstreams
  (Nebius Token Factory, Tavily) are watched by openstatus. The public
  status page is linked from the README; green or red is visible without
  logging in.
- Build-in-public from day 1 — every red benchmark case has a committed
  post-mortem in `docs/build-log.md` with the diff that fixed it.

### What we learned

- **Variance is the real benchmark.** A single pass tells you nothing. The
  jump from 85% → 90% green only showed up after running the full benchmark
  three times and averaging — three single passes gave us 95%, 83%, 92%.
- **The cheapest fix is a better prompt.** Four separate +5-point jumps on
  the benchmark came from prompt edits (contract-regex hint, timestamp guard,
  URL-template rule, multi-target support), not from changing models or
  cranking token budgets.
- **Preflight before sandbox is free quality.** Running esbuild's parser
  before every sandbox call catches ~50% of first-draft failures in a few
  milliseconds instead of 15–30s. The saved attempts turn into semantically
  meaningful repair.
- **Monotonic repair is non-negotiable.** The strong model will absolutely
  hand back something worse than its last draft if you let it. Scoring every
  attempt and refusing regressions is a small change with outsized reliability
  gains.
- **Nebius Sandboxes change the ergonomics of agent verification.** Isolated,
  network-off, checkpointed — exactly what you want for "run model output
  without blast radius" and much better than DIY Docker-in-Docker setups.

### What's next for patchbay

- **More target languages.** TypeScript (vitest) and Python 3.12 (pytest) ship
  today, both behind the `--lang` flag and sharing one plan+research step. Go
  is next — same prompts, swap the sandbox image and the test harness template.
- **Hosted service** at `patchbay.dev` with managed API keys so the demo
  isn't rate-limited to replay mode after six runs per IP.
- **Fine-tuned repair model** trained on the committed benchmark runs —
  thousands of (red draft → green diff) pairs sitting in `bench/runs/`.
- **GitHub App** instead of the current workflow — one install adds the PR-
  comment bot to every repo in an org.
- **A benchmark for connector agents** published quarterly, same 30 prompts,
  so other agents can be compared against patchbay honestly.

---

## Built With

(Devpost's "Built With" is a chip-list — paste one tag per line into the field)

```
typescript
python
next.js
nebius
nemotron
tavily
model-context-protocol
nodejs
vercel
docker
openstatus
vitest
pytest
esbuild
slack
github-actions
```

## Team

```
Sarah Vogel — solo build, @sarahvogel_dev on X
```

## Thumbnail / logo

Upload: a 1920×1080 title card (coming from the Fable artifact or
`docs/screenshots/01-hero.jpg` as a fallback).

---

## Submission checklist (do before clicking Submit)

- [ ] Video uploaded to YouTube unlisted, URL pasted above
- [ ] Live demo URL opens without login and the Build button works
- [ ] `patchbay.openstatus.dev` shows all monitors green
- [ ] README on GitHub shows the live status badge, not a broken image
- [ ] `npm run bench` latest number matches what the elevator pitch claims
- [ ] Partner prize boxes ticked: Nebius (host), Tavily (research step)
- [ ] "Built With" chips include every tag above (Devpost search is picky,
      type each one and pick from the dropdown; `model-context-protocol` may
      not exist as a tag — fall back to `mcp` or add it as a new tag)
- [ ] Devpost project is **public**, not draft

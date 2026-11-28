# Hackathon submission — Nebius × NVIDIA Global AI Hackathon

Track: **Coding & Agentic Engineering**
Submission: [patchbay](https://patchbay-mcp.dev)
Repo: `GodSmasher/patchbay`

Judges: this page points you at everything you need in one place. The main
README leads with the current product focus (MCP security scanner); this
page keeps the hackathon submission intact.

---

## What patchbay does for the hackathon

Describe an integration in one sentence. Get a tested connector (TypeScript
or Python) that already passed its own tests. Five steps — plan, research,
generate, verify, repair — on three Nebius products.

```
npx -y @patchbay-nebius/agent build \
  "When a Stripe payment succeeds, add the customer to a Mailchimp audience with the plan as a tag"
```

---

## Three Nebius products in one closed loop

1. **Token Factory Inference** — Nemotron tier mix (Lightning / Super / Ultra) drives plan → research → generate → repair.
2. **Token Factory Post-training** — fine-tuned `Qwen/Qwen3-30B-A3B-Instruct-2507` on 173 real `(red draft + failing test report) → green draft` repair pairs extracted from committed benchmark runs.
3. **AI Cloud GPU** — fine-tuned checkpoint served from an H100 NVLink preemptible behind an OpenAI-compatible vLLM endpoint. `PATCHBAY_REPAIR_LLM_BASE_URL` points patchbay's repair step at the self-hosted model.

Detail + status: [docs/finetune.md](docs/finetune.md) · training script: [scripts/finetune.ts](scripts/finetune.ts) · deploy: [scripts/vllm-deploy/](scripts/vllm-deploy/) · side-by-side ablation: [scripts/bench-finetuned-ablation.ts](scripts/bench-finetuned-ablation.ts)

---

## Benchmark numbers

Every row is a live Nebius Sandbox run with per-attempt files, test report
and sandbox operation IDs committed under [`bench/runs/`](bench/runs/). Not
cherry-picked.

| Set | Shape | Runs | Green | First-try | Cost / build |
|---|---|---|---|---|---|
| **TS Core 20** | common integrations (Stripe→Mailchimp, Shopify→Airtable, …) | 92 | **90.2%** | 52.2% | $0.07 |
| **TS Brutal 10** | adversarial (OAuth refresh, WebSocket, HMAC, cursor paging) | 13 | 69.2% | 23.1% | $0.18 |
| **Python Core 20** | same 20 prompts as TS Core, Python+pytest sandbox | 60 | **73.3%** | 31.7% | $0.07 / green build |
| **Python Brutal 20** | adversarial (SOAP, GraphQL federation, long-poll, dedup) | 40 | **70.0%** | — | $0.16 |
| TS × Nemotron Super ablation | strong-step downgraded 550B → 120B, same prompts | 60 | 46.7% | 8.3% | $0.06 |

Full tables + per-prompt breakdown + variance: [bench/RESULTS-variance.md](bench/RESULTS-variance.md)

Dataset mirror on Hugging Face: [patchbay-nebius/connector-repair-dataset](https://huggingface.co/datasets/patchbay-nebius/connector-repair-dataset) (98 train + 11 eval real red→green pairs).

---

## Live demo

- Hosted: **https://patchbay-mcp.dev** — TypeScript · Python · Both toggle, the "Both" button fires two live Nebius pipelines side-by-side.
- Public uptime: **https://patchbay.openstatus.dev**
- Self-host: `docker compose up --build` after `cp .env.example .env.local`. See [README §Selfhost](README.md#selfhost).

Per-IP rate limit caps live runs at 6/hour; past that the UI falls back to
the recorded replay, so demo hug-of-death doesn't burn through credits.

---

## Evidence export (auditable without re-execution)

Every live build offers a one-click **Evidence .zip** download. Inside:

- `connector/` — final files, drop-in ready
- `trajectory/attempt-*/` — every repair attempt with its own test report
- `plan.json`, `spec.json`, `usage.json` — per-call model usage + cost + total
- `manifest.json` — issuedAt, finalResult, Nebius sandbox operation IDs, SHA-256 of every file
- `README.md` — what each file is + how to recompute hashes with `shasum -a 256`

Nebius Token Factory sandbox operation IDs retain the exact command
patchbay ran, exit code, and stdout — judges can replay our execution from
operation history.

---

## Reading the code

| What | Where |
|---|---|
| Plan / research / generate / verify / repair loop | [`packages/agent/src/`](packages/agent/src/) |
| CLI entrypoint | [`packages/agent/src/cli.ts`](packages/agent/src/cli.ts) |
| MCP server (exposes 4 tools via stdio) | [`packages/mcp/src/`](packages/mcp/src/) |
| Web demo | [`apps/web/`](apps/web/) |
| Benchmark harness + prompts | [`bench/`](bench/) |
| Fine-tune scripts | [`scripts/finetune.ts`](scripts/finetune.ts), [`scripts/finetune-checkpoint.ts`](scripts/finetune-checkpoint.ts) |
| vLLM Dockerfile for serving fine-tune | [`scripts/vllm-deploy/`](scripts/vllm-deploy/) |

---

## What has changed since submission

The project kept building after the hackathon. The current product focus
is **`patchbay audit`** — an MCP server security scanner shipping as
`packages/audit-core/` plus the `audit` subcommand on the same CLI. That
work is in the README and does not alter the hackathon submission above:
the connector pipeline, the benchmark numbers, the fine-tune pipeline and
the live demo URL are all unchanged.

See [README](README.md) for the full project overview or jump straight to
the live site at **https://patchbay-mcp.dev**.

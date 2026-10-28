# Deploy the fine-tuned Qwen3-30B on Nebius AI Cloud GPU

This is the manual click-through that connects everything: Token Factory
fine-tune → AI Cloud GPU → patchbay pointed at your own weights. The whole
thing takes ~10 minutes once the fine-tune has finished.

Prerequisites (all should be true already):
- Fine-tune job finished successfully on Token Factory
  (`npx tsx --env-file-if-exists=.env.local scripts/finetune-checkpoint.ts <job-id>`
  printed a `fine_tuned_model` id and either a checkpoint download URL or a
  model handle).
- Nebius AI Cloud account with credit (console.eu-north1.nebius.com, $620
  promo balance applied).
- `.env.local` has your `NEBIUS_API_KEY`, `TAVILY_API_KEY`,
  `NEBIUS_AI_PROJECT` as before.

## 1. Create the GPU endpoint (~3 min)

Open https://console.eu-north1.nebius.com/ → sidebar → **AI orchestration**
→ **Endpoint** → **Create endpoint**.

Fill in:

| Field | Value |
| --- | --- |
| Name | `patchbay-repair` |
| GPU | **NVIDIA H100 80GB** (eu-north1, $0.79/hr) — H200 at $1.50/hr if H100 is unavailable |
| Node count | 1 |
| Container image | `vllm/vllm-openai:latest` (or build locally from `scripts/vllm-deploy/Dockerfile` and push to a registry Nebius can reach) |
| Port | `8000` |
| Public endpoint | **On** |

Environment variables on the endpoint:

```
HF_TOKEN=<your huggingface token>           # needed to pull the Qwen3 base
CHECKPOINT_URL=<download URL from finetune-checkpoint.ts output>
MODEL_ID=patchbay/qwen3-30b-a3b-repair       # whatever name you want it served as
BASE_MODEL=Qwen/Qwen3-30B-A3B-Instruct-2507
```

Command (if the endpoint UI asks for a command/entrypoint, otherwise
`vllm/vllm-openai:latest`'s default is fine):

```
bash /opt/patchbay/run.sh
```

(The run.sh in `scripts/vllm-deploy/run.sh` downloads the fine-tune
weights from `CHECKPOINT_URL` into `/weights/` and then execs vLLM with
`--model Qwen/Qwen3-30B-A3B-Instruct-2507 --enable-lora
--lora-modules patchbay=/weights/`.)

Click **Create**. Nebius pulls the image + base model (~3 min for the
first boot — base model download dominates).

## 2. Grab the endpoint URL + token (~1 min)

Once status is **Running**, copy from the endpoint page:

- **Endpoint URL** — looks like `https://<name>-<hash>.endpoints.nebius.com`
- **Bearer token** — click "Reveal token" / generate if the UI asks

## 3. Point patchbay at the fine-tune (~30 sec)

Edit `.env.local` in the patchbay repo. Keep your existing keys, add/replace:

```sh
# baseline: Token Factory serving Nemotron Ultra 550B
# PATCHBAY_MODEL_STRONG=nvidia/Nemotron-3-Ultra-550b-a55b

# fine-tune: your own Qwen3-30B served on an AI Cloud GPU
PATCHBAY_LLM_BASE_URL=https://<endpoint-url>/v1
PATCHBAY_LLM_PROVIDER=generic
PATCHBAY_MODEL_STRONG=patchbay/qwen3-30b-a3b-repair
PATCHBAY_LLM_API_KEY=<endpoint bearer token>
```

`generic` strips the Nemotron-specific `chat_template_kwargs.enable_thinking`
field that would otherwise make vLLM reject the request.

## 4. Run the benchmark against your own weights (~15 min, ~$3-4 on Nebius)

```sh
# single pass against the fine-tune, 20 core prompts, batched to respect Tavily
npx tsx --env-file-if-exists=.env.local scripts/bench-finetuned.ts

# or run both the fine-tune AND the Ultra baseline side-by-side (recommended):
npx tsx --env-file-if-exists=.env.local scripts/bench-finetuned-ablation.ts
```

The ablation script writes a markdown comparison table to
`scratchpad/variance_finetuned_ablation_out/comparison.md`.

## 5. Shut the GPU off (~30 sec, $0 forever after)

Go back to the endpoint in console → **Stop** → confirm.

Nebius AI Cloud charges per hour the GPU is up, not per request. A single
benchmark run keeps it up for ~20 min total (deploy + bench), so budget
~$0.30-0.80 depending on H100 vs H200. If you forget to stop it, that
climbs by $0.79-$1.50 every hour. Stop it when you're done.

## Troubleshooting

- **vLLM boots but the model id doesn't match**: whatever string you set in
  `MODEL_ID` env must be what you pass as `PATCHBAY_MODEL_STRONG`. The
  `run.sh` tells vLLM to serve the LoRA as `patchbay`, so pass
  `PATCHBAY_MODEL_STRONG=patchbay` — or edit `run.sh` to serve it under a
  more specific name.
- **401 on the first patchbay call**: the endpoint bearer token didn't make
  it into `PATCHBAY_LLM_API_KEY`. Double-check `.env.local` and restart
  anything that loads env (CLI, dev server).
- **vLLM OOM on H100**: Qwen3-30B is 60 GB fp16 + context overhead. If
  you hit OOM, downgrade to a bitsandbytes 4-bit quant via `--load-format
  bitsandbytes --quantization bitsandbytes` in `run.sh`, or move to H200.
- **No download URL on the checkpoint**: happens on Nebius tenants that
  don't ship signed-URL downloads. Check
  console.eu-north1.nebius.com → Token Factory → Fine-tuned models for a
  manual **Download** button, drop the file into object storage, and
  point `CHECKPOINT_URL` at that signed object URL.

## Expected outcome

If the fine-tune picked up on the (red → green) repair patterns, we expect
the fine-tuned Qwen3-30B to:

- Match Ultra on the TS core-20 green rate (~90% baseline) at **~5-10×
  lower repair-call cost** (Qwen3-30B active 3B params vs Ultra 550B);
- Produce a cleaner first-try rate than base Qwen3-30B on the same prompts.

The exact numbers live in `scratchpad/variance_finetuned_ablation_out/`
after the benchmark run.

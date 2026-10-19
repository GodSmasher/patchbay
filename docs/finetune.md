# Fine-tuning patchbay on its own repair runs

Every one of patchbay's benchmark runs is a record of the agent failing
and then fixing itself. 68 of those failure-to-fix moments across five
benchmark passes make a tiny but perfectly-domain-matched training set
for a repair-focused model.

This document is the plan — and once the model is trained, the result.

## The dataset

Extracted from `bench/runs/pass-*/*.json` with
`scripts/extract-training-data.ts`. Each training example is one
`(red draft + failing test report) → green draft` repair step, formatted
as an OpenAI-style `messages` array ready for Nebius Token Factory's
fine-tune endpoint.

- **68 examples** across 5 passes × 30 prompts × up to 4 attempts
- **90/10 train/eval split** → 61 train, 7 held-out eval
- Avg. 11k input tokens per example (connector + test + failure trace),
  5–6k output tokens (fixed files)
- Zero duplicates — every pair comes from a distinct (prompt, attempt).

The source of the data is in-repo: the raw benchmark runs under
`bench/runs/` are committed, so the dataset is reproducible from scratch
with one script invocation.

## The hypothesis

Repair is a narrow task — the model doesn't have to invent architecture,
it has to turn one TypeScript file into a slightly different TypeScript
file. patchbay already uses Nemotron 3 Ultra (550B parameters) for
repair, which works but burns the budget. The hypothesis:

> A fine-tuned **Qwen3-30B-A3B-Instruct** (small, fast, ~1/18 the active
> parameters of Ultra) can match or beat Ultra on patchbay's own repair
> task — because the task itself is narrow enough that in-domain data
> beats scale.

(Target model was originally Nemotron 3.5 Lightning, which turned out
not to be fine-tunable on Token Factory. Qwen3-30B-A3B is the smallest
instruction model Token Factory lets us fine-tune, so it gets the shot.)

If true, this closes the loop: patchbay generates benchmark runs →
runs train its own repair model → the next benchmark's cost drops ~50×
on repair while keeping the green rate up.

## The training setup

- **Base model**: `Qwen/Qwen3-30B-A3B-Instruct-2507`
- **Method**: full fine-tune (Nebius Token Factory decides; LoRA was
  not required for this model/dataset size)
- **Hyperparameters**: 3 epochs, batch size 16, context length 16384,
  LR 1e-5, packing on
- **Job**: `ftjob-cba43bc57fc04546bb4d8d7e4b86eb28`
- **Started**: 2026-10-19

Launch script: `scripts/finetune.ts`.

```bash
# 1. Upload the split datasets
npx tsx --env-file-if-exists=.env.local scripts/finetune.ts upload

# 2. Start the job
npx tsx --env-file-if-exists=.env.local scripts/finetune.ts start \
  --model=nvidia/Nemotron-3_5-Lightning \
  --train=<file-id-from-step-1> \
  --eval=<file-id-from-step-1>

# 3. Watch until done
npx tsx --env-file-if-exists=.env.local scripts/finetune.ts watch <job-id>
```

## The evaluation

Three metrics, measured against the 7 held-out eval examples by
`scripts/eval-repair.ts`:

1. **Format OK** — did the model emit well-formed `<file>` blocks?
2. **File coverage** — did it return all the expected file paths
   (`src/connector.ts`, `src/connector.test.ts`, `README.md`)?
3. **Line overlap** — fraction of expected lines that appear verbatim
   in the fixed files.

Baseline (base Lightning, no fine-tune) and fine-tuned numbers go here
once the training job completes:

| Model | Format OK | File coverage | Line overlap |
|---|---|---|---|
| Nemotron 3.5 Lightning (base, small) | 83% | 17% | 20% |
| **Nemotron 3 Ultra 550B (patchbay's current repair model) — target to beat** | **100%** | **33%** | **56.5%** |
| Qwen3-30B-A3B (base, pre-fine-tune) | 100% | 0% | 36.5% |
| **ft:Qwen3-30B:patchbay-repair** | **tbd** | **tbd** | **tbd** |

Numbers are from `scripts/eval-repair.ts` over the 6-example held-out
split. Pass criterion for a win: the fine-tune lands within 10 points
of Ultra on overlap at ≈1/18 the active parameter count.

Pass criterion for a win: fine-tuned Lightning beats base Lightning on
all three metrics AND lands within 10 points of Ultra, at a fraction of
the cost per connector.

## Why this is the right thing to show for the hackathon

- Uses **two Nebius services** — Token Factory inference plus Token
  Factory fine-tuning. Most hackathon projects use one.
- The training data **doesn't exist anywhere else** — it's the
  self-referential closure of 90+ live benchmark runs on Nebius'
  sandboxes, nowhere to copy from.
- Quantifiable before/after via the held-out eval set and a fresh
  3-pass benchmark run.
- The dataset itself (`bench/training-data.jsonl`) is a tiny new
  open-source contribution: 68 real-world LLM repair pairs for TypeScript
  API connectors.

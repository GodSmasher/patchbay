# Fine-tuned Qwen3-30B vs baseline Nemotron Ultra 550B

Same 20 TS Core prompts, one pass per variant = 20 builds per variant.

| | Fine-tuned Qwen3-30B | Baseline Nemotron Ultra |
| --- | --- | --- |
| model | `patchbay-repair` | `nvidia/Nemotron-3-Ultra-550b-a55b (default)` |
| served from | `https://port8000-f7j1tp4e2tk8xx5.tunnel.applications.eu-north1.nebius.cloud/v1` | `https://api.tokenfactory.nebius.com/v1` |
| green | **5.0%** (1/20) | **90.0%** (18/20) |
| first-try | 0.0% (0/20) | 25.0% (5/20) |
| cost / build (mean) | $0.1849 | $0.1305 |
| cost total | $3.6983 | $2.6109 |
| time / build (mean) | 0s | 99s |

Cost speedup (baseline $/build ÷ fine-tune $/build): **0.71×**
Green rate delta: **-85.0 pp**

Reproduce: `npx tsx --env-file-if-exists=.env.local scripts/bench-finetuned-ablation.ts`

# Fine-tuned Qwen3-30B on repair step vs pure Nemotron Ultra 550B

Same 20 TS Core prompts, one pass per variant = 20 builds per variant.

The fine-tune was trained on red→green repair pairs, so this variant uses it ONLY for the repair step; Ultra still does the fresh-generation step.

| | Fine-tune on repair + Ultra generate | Pure Ultra (both steps) |
| --- | --- | --- |
| model | `patchbay-repair (repair) + Nemotron-3-Ultra-550b-a55b (generate)` | `nvidia/Nemotron-3-Ultra-550b-a55b (both steps)` |
| served from | `https://port8000-f7j1tp4e2tk8xx5.tunnel.applications.eu-north1.nebius.cloud/v1 (repair) + Token Factory (generate)` | `https://api.tokenfactory.nebius.com/v1` |
| green | **45.0%** (9/20) | **80.0%** (16/20) |
| first-try | 35.0% (7/20) | 15.0% (3/20) |
| cost / build (mean) | $0.0879 | $0.1444 |
| cost total | $1.7572 | $2.8889 |
| time / build (mean) | 109s | 110s |

Cost speedup (baseline $/build ÷ fine-tune $/build): **1.64×** cheaper
Green rate delta: **-35.0 pp**

Reproduce: `npx tsx --env-file-if-exists=.env.local scripts/bench-finetuned-ablation.ts`

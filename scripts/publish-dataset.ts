/**
 * Upload patchbay's self-generated connector-repair dataset to HuggingFace.
 *
 * Usage (after `huggingface-cli login` or with HF_TOKEN in env):
 *   npx tsx --env-file-if-exists=.env.local scripts/publish-dataset.ts
 *
 * What goes up:
 *   - bench/training-data.jsonl         (68 real red→green pairs)
 *   - bench/training-data-perturbed.jsonl (111 synthetic perturbations)
 *   - bench/training-train.jsonl / training-eval.jsonl (merged + split)
 *   - A README card explaining the dataset
 *   - MIT LICENSE
 *
 * Repo: huggingface.co/datasets/patchbay-nebius/connector-repair-dataset
 *
 * This script uses the HuggingFace REST API directly to avoid a Python
 * dependency. It expects HF_TOKEN in env (write scope).
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const HF_API = 'https://huggingface.co/api'
const DATASET_REPO = 'patchbay-nebius/connector-repair-dataset'

function token(): string {
  const t = process.env.HF_TOKEN
  if (!t) throw new Error('HF_TOKEN env missing. Create at https://huggingface.co/settings/tokens (Write role).')
  return t
}

async function req(method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<Response> {
  const res = await fetch(`${HF_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  })
  return res
}

async function ensureRepo() {
  const res = await req('POST', '/repos/create', {
    name: 'connector-repair-dataset',
    organization: 'patchbay-nebius',
    type: 'dataset',
    private: false,
  })
  if (res.ok || res.status === 409) {
    console.log(res.ok ? '✓ created dataset repo' : '✓ dataset repo already exists')
    return
  }
  const body = await res.text()
  if (res.status === 404 && body.includes('organization')) {
    // Fallback to user namespace if the org doesn't exist on HF yet.
    const alt = await req('POST', '/repos/create', { name: 'connector-repair-dataset', type: 'dataset', private: false })
    if (alt.ok) console.log('✓ created under user namespace')
    else throw new Error(`create repo failed: ${alt.status} ${await alt.text()}`)
    return
  }
  throw new Error(`create repo failed: ${res.status} ${body}`)
}

async function uploadFile(repoPath: string, localPath: string, contentType: string) {
  const content = readFileSync(localPath)
  const url = `https://huggingface.co/datasets/${DATASET_REPO}/raw/main/${repoPath}`
  // HF's commit API: PUT a single file via LFS-aware upload.
  // We POST to /api/datasets/{repo}/commit/main with a JSON body describing files.
  const commit = {
    key: `patchbay-${Date.now()}`,
    summary: `upload ${repoPath}`,
    operations: [
      {
        key: 'file',
        value: {
          content: content.toString('base64'),
          path: repoPath,
          encoding: 'base64',
        },
      },
    ],
  }
  console.log(`uploading ${repoPath} (${content.length} bytes) …`)
  const res = await fetch(`https://huggingface.co/api/datasets/${DATASET_REPO}/commit/main`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/x-ndjson' },
    body: [JSON.stringify({ key: 'header', value: { summary: `upload ${repoPath}` } }), JSON.stringify({ key: 'file', value: { path: repoPath, content: content.toString('base64'), encoding: 'base64' } })].join('\n'),
  })
  if (!res.ok) throw new Error(`upload ${repoPath}: ${res.status} ${await res.text()}`)
  console.log(`  → ${url}`)
}

const README = `---
license: mit
language:
- en
pretty_name: patchbay connector-repair dataset
size_categories:
- n<1K
task_categories:
- text-generation
tags:
- code
- typescript
- api-connectors
- llm-repair
- fine-tuning
- nebius
- nemotron
---

# patchbay — connector-repair dataset

A compact, in-domain fine-tuning dataset for training LLMs to repair failing
TypeScript API-connector code.

Every example is a \`(broken connector + failing vitest report) → fixed connector\`
pair, extracted from live benchmark runs of
[**patchbay**](https://github.com/GodSmasher/patchbay) — an agent that
turns a one-sentence integration description into a tested TypeScript
connector using Nemotron on Nebius Token Factory and Tavily for API docs.

## What it is

Each row is an OpenAI-style \`messages\` triple:

- **system**: patchbay's repair-step system prompt (identical for all rows)
- **user**: the original integration request, the current (broken) \`src/connector.ts\`,
  \`src/connector.test.ts\` and \`README.md\` as \`<file path="…">…</file>\` blocks,
  plus the exact vitest + tsc failure output
- **assistant**: the fixed set of three files that made the sandbox tests pass

Format matches the Nebius Token Factory \`/v1/fine_tuning/jobs\` endpoint
(OpenAI-compatible) directly — no pre-processing needed.

## Splits

| File | Examples | Source |
|---|---|---|
| \`training-data.jsonl\` | 68 | Real red → green repair steps across 5 full benchmark passes × 30 prompts |
| \`training-data-perturbed.jsonl\` | 111 | Synthetic perturbations: off-by-one retries, cursor pagination without hasNextPage, missing Retry-After parse, placeholder URLs left literally, auth header name wrong, missing field validation |
| \`training-train.jsonl\` | 98 | Merged + deduped + capped at 25 auth perturbations, 90 % split |
| \`training-eval.jsonl\` | 11 | 10 % held-out eval |

## Vocabulary of bugs

The 68 real examples span the recurring failure modes patchbay actually
hits in production:

- 429 retry with wrong attempt count
- Retry-After parsing (integer seconds vs HTTP-date)
- cursor pagination termination (truthy-cursor vs \`hasNextPage\`)
- HMAC verification with timing-safe compare and base64/hex mismatch
- OAuth2 refresh-on-401
- Idempotency-Key placement
- URL template substitution (region hosts, placeholders)
- Field mapping between source + target
- Deduplication across webhook retries
- GraphQL nested mutations

## Why fine-tune on this

patchbay already uses Nemotron 3 Ultra (550B) for repair. We're testing
whether a smaller model (Qwen3-30B-A3B) fine-tuned on exactly these
patterns can match Ultra's repair quality at a fraction of the cost.
Full plan + numbers at
[docs/finetune.md](https://github.com/GodSmasher/patchbay/blob/main/docs/finetune.md).

## Reproduce from source

\`\`\`bash
git clone https://github.com/GodSmasher/patchbay
cd patchbay && npm install
npx tsx scripts/extract-training-data.ts    # 68 real
npx tsx scripts/perturb-training-data.ts    # +111 synthetic
# merge + split (see scripts/README.md)
\`\`\`

The raw benchmark runs are committed under \`bench/runs/pass-{1..5}/\`
so every row in this dataset is traceable back to the exact prompt,
attempt and sandbox verification report that produced it.

## License

MIT. Attribution appreciated.
Repo: https://github.com/GodSmasher/patchbay
`

async function main() {
  await ensureRepo()
  const base = process.cwd()
  // Upload the README first so the card is visible immediately.
  await uploadFile('README.md', writeTemp(README), 'text/markdown')
  await uploadFile('training-data.jsonl', join(base, 'bench', 'training-data.jsonl'), 'application/jsonl')
  await uploadFile('training-data-perturbed.jsonl', join(base, 'bench', 'training-data-perturbed.jsonl'), 'application/jsonl')
  await uploadFile('training-train.jsonl', join(base, 'bench', 'training-train.jsonl'), 'application/jsonl')
  await uploadFile('training-eval.jsonl', join(base, 'bench', 'training-eval.jsonl'), 'application/jsonl')
  console.log(`\nDone: https://huggingface.co/datasets/${DATASET_REPO}`)
}

function writeTemp(content: string): string {
  const path = join(process.env.TEMP ?? '/tmp', `patchbay-hf-README-${Date.now()}.md`)
  require('node:fs').writeFileSync(path, content, 'utf8')
  return path
}

main().catch((e) => { console.error(e.message || e); process.exit(1) })

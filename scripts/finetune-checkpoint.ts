/**
 * Fetch the final checkpoint of a Token Factory fine-tune job.
 *
 * Usage:
 *   npx tsx --env-file-if-exists=.env.local scripts/finetune-checkpoint.ts <job-id>
 *
 * Writes the artifact URL(s) and metadata so the AI Cloud deploy step knows
 * exactly what weights to pull.
 */

const API = 'https://api.tokenfactory.nebius.com/v1'

function key(): string {
  const k = process.env.NEBIUS_API_KEY
  if (!k) throw new Error('NEBIUS_API_KEY missing. Run with --env-file-if-exists=.env.local.')
  return k
}

async function req<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${key()}` } })
  const text = await res.text()
  if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}: ${text.slice(0, 500)}`)
  return (text ? JSON.parse(text) : {}) as T
}

interface Checkpoint {
  id: string
  created_at: number
  fine_tuned_model_checkpoint?: string
  step_number?: number
  metrics?: Record<string, number>
  // Nebius-specific extensions on OpenAI-style payload
  download_url?: string
  model_url?: string
}

async function main() {
  const jobId = process.argv[2]
  if (!jobId) {
    console.error('Usage: scripts/finetune-checkpoint.ts <ftjob-...>')
    process.exit(1)
  }

  const job = await req<{ status: string; fine_tuned_model: string | null; trained_tokens: number | null }>(`/fine_tuning/jobs/${jobId}`)
  console.log(`job ${jobId}: status=${job.status}${job.trained_tokens ? ` · ${job.trained_tokens} tokens` : ''}`)
  if (job.status !== 'succeeded') {
    console.log(`\n(Not finished yet; watch with: scripts/finetune.ts watch ${jobId})`)
    process.exit(job.status === 'failed' || job.status === 'cancelled' ? 1 : 0)
  }

  if (job.fine_tuned_model) {
    console.log(`fine_tuned_model: ${job.fine_tuned_model}`)
  }

  // Try the OpenAI-style checkpoints endpoint first.
  try {
    const listing = await req<{ data: Checkpoint[] }>(`/fine_tuning/jobs/${jobId}/checkpoints`)
    console.log(`\ncheckpoints: ${listing.data.length}`)
    for (const ck of listing.data) {
      console.log(`  - ${ck.id} (step ${ck.step_number ?? '?'})`)
      if (ck.fine_tuned_model_checkpoint) console.log(`    model: ${ck.fine_tuned_model_checkpoint}`)
      if (ck.download_url) console.log(`    download: ${ck.download_url}`)
      if (ck.model_url) console.log(`    model_url: ${ck.model_url}`)
    }
    if (listing.data.length) {
      const last = listing.data.at(-1)!
      console.log(`\nFinal checkpoint id: ${last.id}`)
      console.log(`\nNext — deploy to Nebius AI Cloud:`)
      console.log(`  1. On console.nebius.com → AI orchestration → create Endpoint`)
      console.log(`  2. Pick an H100 or H200 node (eu-north1 cheapest at $0.79/hr)`)
      console.log(`  3. Load the checkpoint (URL above) via vLLM, OpenAI-compatible mode`)
      console.log(`  4. Set PATCHBAY_LLM_BASE_URL to the endpoint's URL in .env.local`)
      console.log(`  5. PATCHBAY_LLM_PROVIDER=generic (no Nemotron thinking kwargs)`)
      console.log(`  6. Run bench: node scripts/benchmark.ts`)
    }
  } catch (error) {
    console.error('checkpoints endpoint failed:', error instanceof Error ? error.message : error)
    console.log('Try the fine_tuned_model id above directly on Token Factory inference, or check the Nebius console for the artifact URL.')
  }
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})

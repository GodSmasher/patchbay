/**
 * npm run check:nebius — verifies the keys in .env.local without printing them:
 * lists the Nemotron models your key can use, checks sandbox access and one Tavily search.
 */
import { loadConfig } from '../packages/agent/src/config'

const config = loadConfig()

async function check(name: string, fn: () => Promise<string>) {
  try {
    console.log(`✔ ${name}: ${await fn()}`)
  } catch (error) {
    console.log(`✖ ${name}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

await check('Nebius inference', async () => {
  if (!config.nebiusApiKey) throw new Error('NEBIUS_API_KEY is empty')
  const res = await fetch(`${config.nebiusBaseUrl}/models`, { headers: { Authorization: `Bearer ${config.nebiusApiKey}` } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as { data?: { id: string }[] }
  const ids = (data.data ?? []).map((m) => m.id)
  const nemotron = ids.filter((id) => /nemotron/i.test(id))
  const configured = Object.values(config.models).map((m) => `${m.id} ${ids.includes(m.id) ? 'ok' : 'NOT FOUND'}`)
  return `${ids.length} models, Nemotron: ${nemotron.join(', ') || 'none'}\n    configured: ${configured.join(' | ')}`
})

await check('Nebius sandboxes', async () => {
  if (!config.nebiusProject) throw new Error('NEBIUS_AI_PROJECT is empty')
  const res = await fetch(`${config.sandboxUrl}/images?tagged=1&limit=50`, {
    headers: { Authorization: `Bearer ${config.nebiusApiKey}`, Project: config.nebiusProject },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
  const data = (await res.json()) as { images?: { tag?: string | null }[] }
  const tags = (data.images ?? []).map((i) => i.tag).filter(Boolean)
  return `access ok, tagged images: ${tags.slice(0, 12).join(', ') || 'none yet'}`
})

await check('Tavily', async () => {
  if (!config.tavilyApiKey) throw new Error('TAVILY_API_KEY is empty')
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.tavilyApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'Pipedrive API add person', max_results: 1 }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as { results?: { url: string }[] }
  return `search ok (${data.results?.[0]?.url ?? 'no result'})`
})

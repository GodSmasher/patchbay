// Creates (or updates) the uptime monitors that back https://patchbay.openstatus.dev
//
// Usage:
//   OPENSTATUS_API_KEY=xxx node scripts/openstatus-setup.mjs
//
// The key comes from the OpenStatus dashboard under Settings → API Keys.
// Running it twice is safe: existing monitors with the same name are updated instead
// of duplicated. Add new entries to MONITORS below and re-run.

const API = 'https://api.openstatus.dev/v1'

const MONITORS = [
  {
    name: 'web · live demo',
    description: 'Hero page of the live demo. If this is down, nobody sees patchbay at all.',
    url: 'https://patchbay-nebius.vercel.app',
    method: 'GET',
    periodicity: '1m',
    assertions: [{ type: 'status', compare: 'eq', target: 200 }],
  },
  {
    name: 'web · api/run',
    description: 'The SSE endpoint the live demo streams from. GET returns a tiny JSON probe.',
    url: 'https://patchbay-nebius.vercel.app/api/run',
    method: 'GET',
    periodicity: '1m',
    assertions: [{ type: 'status', compare: 'eq', target: 200 }],
  },
  {
    name: 'web · bench dashboard',
    description: 'Static benchmark dashboard. Low frequency, mostly catches build regressions.',
    url: 'https://patchbay-nebius.vercel.app/bench',
    method: 'GET',
    periodicity: '5m',
    assertions: [{ type: 'status', compare: 'eq', target: 200 }],
  },
  {
    name: 'web · slack command',
    description: 'Slack slash-command route. Returns 503 until SLACK_SIGNING_SECRET is set, which still proves the route is reachable.',
    url: 'https://patchbay-nebius.vercel.app/api/slack/command',
    method: 'POST',
    periodicity: '10m',
    body: 'ping',
    headers: [{ key: 'content-type', value: 'application/x-www-form-urlencoded' }],
    assertions: [{ type: 'status', compare: 'gte', target: 200 }, { type: 'status', compare: 'lte', target: 599 }],
  },
]

async function main() {
  const key = process.env.OPENSTATUS_API_KEY
  if (!key) {
    console.error('OPENSTATUS_API_KEY missing. Get one at https://openstatus.dev → Settings → API Keys and re-run.')
    process.exit(1)
  }

  const existing = await listMonitors(key)
  const existingByName = new Map(existing.map((m) => [m.name, m]))

  for (const monitor of MONITORS) {
    const match = existingByName.get(monitor.name)
    const payload = { active: true, public: true, regions: ['ams', 'iad'], retry: 2, ...monitor }
    if (match) {
      await request(key, `/monitor/${match.id}`, 'PUT', payload)
      console.log(`✔ updated #${match.id} — ${monitor.name}`)
    } else {
      const created = await request(key, '/monitor', 'POST', payload)
      console.log(`✔ created #${created.id ?? '?'} — ${monitor.name}`)
    }
  }

  console.log('\nAll monitors in sync. See them at https://openstatus.dev → Monitors.')
  console.log('Public status page: https://patchbay.openstatus.dev')
}

async function listMonitors(key) {
  try {
    const data = await request(key, '/monitor', 'GET')
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.error('Could not list existing monitors:', error.message)
    return []
  }
}

async function request(key, path, method, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'x-openstatus-key': key,
      'Content-Type': 'application/json',
      'User-Agent': 'patchbay-openstatus-setup',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = text ? safeParse(text) : {}
  if (!res.ok) {
    throw new Error(`${method} ${path}: HTTP ${res.status} ${(data && data.message) || text.slice(0, 200)}`)
  }
  return data
}

function safeParse(text) {
  try { return JSON.parse(text) } catch { return text }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})

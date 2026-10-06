/**
 * Smoke test for the patchbay MCP server:
 * spawns it, sends initialize + tools/list + tools/call build_connector, prints responses.
 * Run: npx tsx scripts/smoke-mcp.ts
 */
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

const child = spawn('npx', ['tsx', 'packages/mcp/src/server.ts'], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: { ...process.env },  // let the server pick up .env.local itself
  shell: process.platform === 'win32',
})

const rl = createInterface({ input: child.stdout })
let nextId = 1
const pending = new Map<number, (msg: unknown) => void>()

rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line) as { id?: number; method?: string; params?: unknown; result?: unknown; error?: unknown }
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)!(msg)
      pending.delete(msg.id)
    } else if (msg.method) {
      // Notification from server
      console.log(`[notify] ${msg.method}:`, JSON.stringify(msg.params).slice(0, 180))
    }
  } catch {
    console.log(`[stdout] ${line}`)
  }
})

function send(method: string, params: unknown, notify = false): Promise<unknown> {
  return new Promise((resolve) => {
    if (notify) {
      const msg = { jsonrpc: '2.0', method, params }
      child.stdin.write(JSON.stringify(msg) + '\n')
      resolve(undefined)
      return
    }
    const id = nextId++
    pending.set(id, resolve)
    const msg = { jsonrpc: '2.0', id, method, params }
    child.stdin.write(JSON.stringify(msg) + '\n')
  })
}

async function main() {
  await new Promise((r) => setTimeout(r, 500))
  console.log('→ initialize')
  const init = await send('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'smoke', version: '0' },
  })
  console.log('← initialize:', JSON.stringify(init).slice(0, 200))
  await send('notifications/initialized', {}, true)

  console.log('→ tools/list')
  const list = await send('tools/list', {})
  const tools = ((list as { result: { tools: { name: string; description?: string }[] } }).result?.tools ?? []).map((t) => t.name)
  console.log('← tools/list:', tools)

  console.log('→ tools/call build_connector')
  const call = await send('tools/call', {
    name: 'build_connector',
    arguments: { prompt: 'When a Typeform is submitted, create a Pipedrive deal.' },
    _meta: { progressToken: 'smoke-1' },
  })
  const result = (call as { result: { content: { text: string }[]; isError?: boolean } }).result
  console.log('← tools/call text:\n' + (result?.content?.[0]?.text ?? '(no content)'))
  console.log('    isError:', result?.isError ?? false)

  child.kill()
}

main().catch((e) => {
  console.error(e)
  child.kill()
  process.exit(1)
})

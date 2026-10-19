import { createNebiusSandbox } from '../packages/agent/src/sandbox'
import { loadConfig } from '../packages/agent/src/config'

async function main() {
  const cfg = loadConfig()
  const sb = createNebiusSandbox({
    apiKey: cfg.nebiusApiKey!,
    project: cfg.nebiusProject!,
    baseUrl: cfg.sandboxUrl,
  })
  const uuid = await sb.prepare((m) => console.error('[prep]', m))
  console.log('IMAGE_UUID=' + uuid)
}

main().catch((e) => { console.error('FAIL:', e); process.exit(1) })

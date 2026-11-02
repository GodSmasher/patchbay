import { startFixtureServer, type FixtureMode } from '../packages/audit-core/src/probe/fixture-server'
import { auditTarget, renderTerminal } from '../packages/audit-core/src/index'

const mode = (process.argv[2] as FixtureMode) ?? 'wide-open'

async function main() {
  const server = await startFixtureServer(mode)
  console.log(`\n--- fixture mode: ${mode} at ${server.url} ---`)
  try {
    const report = await auditTarget(server.url, { timeoutMs: 2000 })
    console.log(renderTerminal(report))
  } finally {
    await server.close()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })

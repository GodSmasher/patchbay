import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { loadConfig, missingLiveKeys } from './config'
import { startRun } from './index'
import type { RunEvent } from './types'

/**
 * npm run agent -- "When a Stripe payment succeeds, add the customer to a Mailchimp audience"
 * npm run agent -- --record "..."   also writes runs/<timestamp>/ with the events and generated files
 */
async function main() {
  const args = process.argv.slice(2)
  const record = args.includes('--record')
  const prompt = args.filter((a) => a !== '--record').join(' ').trim()
  if (!prompt) {
    console.error('Usage: npm run agent -- [--record] "<integration in one sentence>"')
    process.exit(1)
  }

  const config = loadConfig()
  const missing = missingLiveKeys(config)
  if (config.mock || missing.length) {
    console.log(`Replay mode (${config.mock ? 'PATCHBAY_MOCK is not "false"' : `missing ${missing.join(', ')}`})`)
  }

  const events: RunEvent[] = []
  for await (const event of startRun(prompt, config)) {
    events.push(event)
    print(event)
  }

  if (record) {
    const dir = join(process.cwd(), 'runs', new Date().toISOString().replace(/[:.]/g, '-'))
    const result = events.find((e) => e.type === 'result')
    for (const file of result?.type === 'result' ? result.files : []) {
      mkdirSync(dirname(join(dir, file.path)), { recursive: true })
      writeFileSync(join(dir, file.path), file.content)
    }
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'run.json'), JSON.stringify({ prompt, origin: 'live', events }, null, 2))
    console.log(`\nRecorded to ${dir}`)
  }
}

function print(event: RunEvent) {
  switch (event.type) {
    case 'step':
      console.log(`${event.status === 'start' ? '▶' : event.status === 'done' ? '✔' : '✖'} ${event.step}${event.detail ? ` — ${event.detail}` : ''}`)
      break
    case 'log':
      console.log(`    ${event.message}`)
      break
    case 'tests':
      console.log(`    attempt ${event.attempt}: ${event.report.passed}/${event.report.total} passed, typecheck ${event.report.typecheckOk ? 'ok' : 'failed'}`)
      for (const f of event.report.failures) console.log(`      ✖ ${f.name}`)
      break
    case 'usage':
      for (const u of event.usage) console.log(`    ${u.model}: ${u.promptTokens} in / ${u.completionTokens} out, $${u.costUsd.toFixed(4)}`)
      break
    case 'error':
      console.error(`Error: ${event.message}`)
      break
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

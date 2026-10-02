#!/usr/bin/env node
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { loadConfig, missingLiveKeys } from './config'
import { startResearch, startRun, startVerify } from './index'
import type { GeneratedFile, RunEvent } from './types'

const HELP = `patchbay – describe an integration, get a tested TypeScript connector.

Usage:
  patchbay build   [--record] "<one-sentence integration>"
  patchbay research           "<one-sentence integration>"
  patchbay verify  <directory>
  patchbay help

Commands:
  build     Full pipeline: plan → research → generate → verify (with repair). Default if you pass a prompt.
  research  Plan + API research only. Prints the spec, no code.
  verify    Type-check and vitest an existing connector folder (needs src/connector.ts + tests).
  help      Show this message.

Flags:
  --record  build only. Writes runs/<timestamp>/ with generated files and the event log.

Environment:
  NEBIUS_API_KEY, NEBIUS_AI_PROJECT, TAVILY_API_KEY  – required for live runs.
  PATCHBAY_MOCK=false                                – enable live mode (default is replay).
  PATCHBAY_RUNNER=local|nebius                       – default nebius (isolated sandbox).
  PATCHBAY_MAX_ATTEMPTS=<n>                          – repair attempts, default 3.
`

async function main() {
  const argv = process.argv.slice(2)
  const first = argv[0]

  if (!first || first === 'help' || first === '--help' || first === '-h') {
    console.log(HELP)
    return
  }

  // Backwards-compat: bare prompt = build
  const known = new Set(['build', 'research', 'verify'])
  const cmd = known.has(first) ? first : 'build'
  const rest = known.has(first) ? argv.slice(1) : argv

  switch (cmd) {
    case 'build':
      return build(rest)
    case 'research':
      return research(rest)
    case 'verify':
      return verify(rest)
  }
}

async function build(args: string[]) {
  const record = args.includes('--record')
  const prompt = args.filter((a) => a !== '--record').join(' ').trim()
  if (!prompt) return usageError('build needs a prompt')

  const config = loadConfig()
  const missing = missingLiveKeys(config)
  if (config.mock || missing.length) {
    console.log(`Replay mode (${config.mock ? 'PATCHBAY_MOCK is not "false"' : `missing ${missing.join(', ')}`})`)
  }

  const events: RunEvent[] = []
  for await (const event of startRun(prompt, config)) {
    events.push(event)
    printEvent(event)
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

async function research(args: string[]) {
  const prompt = args.join(' ').trim()
  if (!prompt) return usageError('research needs a prompt')
  const config = loadConfig()
  const missing = missingLiveKeys(config)
  if (config.mock || missing.length) {
    console.log(`Replay mode (${config.mock ? 'PATCHBAY_MOCK is not "false"' : `missing ${missing.join(', ')}`}) – returning cached research`)
  }
  for await (const event of startResearch(prompt, config)) {
    printEvent(event)
    if (event.type === 'spec') {
      console.log('\nSpec:')
      console.log(JSON.stringify(event.spec, null, 2))
    }
  }
}

async function verify(args: string[]) {
  const dir = args[0] ? resolve(args[0]) : ''
  if (!dir) return usageError('verify needs a directory')
  const files = collectFiles(dir)
  if (!files.some((f) => f.path === 'src/connector.ts')) {
    return usageError(`No src/connector.ts under ${dir}`)
  }
  const config = loadConfig()
  const missing = missingLiveKeys(config)
  if (config.mock || missing.length) {
    console.error(`verify needs live keys. Set PATCHBAY_MOCK=false and provide ${missing.join(', ') || 'the missing env vars'}.`)
    process.exit(1)
  }
  console.log(`Verifying ${files.length} files from ${dir}`)
  for await (const event of startVerify(files, config)) printEvent(event)
}

function collectFiles(root: string): GeneratedFile[] {
  const out: GeneratedFile[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue
      const abs = join(dir, entry)
      const st = statSync(abs)
      if (st.isDirectory()) walk(abs)
      else if (entry.endsWith('.ts') || entry === 'README.md') {
        out.push({ path: relative(root, abs).replace(/\\/g, '/'), content: readFileSync(abs, 'utf8') })
      }
    }
  }
  walk(root)
  return out
}

function usageError(message: string): void {
  console.error(`Error: ${message}\n`)
  console.error(HELP)
  process.exit(1)
}

function printEvent(event: RunEvent) {
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

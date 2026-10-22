#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, watch, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { loadConfig, missingLiveKeys } from './config'
import { pushToGitHub } from './github-push'
import { startResearch, startRun, startVerify } from './index'
import type { GeneratedFile, RunEvent } from './types'

const HELP = `patchbay – describe an integration, get a tested TypeScript connector.

Usage:
  patchbay build   [--record] "<one-sentence integration>"
  patchbay research           "<one-sentence integration>"
  patchbay verify  [--watch] <directory>
  patchbay scan    <directory> [--build-top=<n>] [--json]
  patchbay add     <run-dir> [--target=<dir>]
  patchbay push    <run-dir> --repo=owner/name [--path=connectors/<name>] [--branch=<branch>] [--dry-run]
  patchbay help

Commands:
  build     Full pipeline: plan → research → generate → verify (with repair). Default if you pass a prompt.
  research  Plan + API research only. Prints the spec, no code.
  verify    Type-check and vitest an existing connector folder (needs src/connector.ts + tests).
  scan      Walk a repo and report integration opportunities patchbay could build.
  add       Drop a recorded run's connector files into another project.
  push      Open a pull request on a GitHub repo with the generated files.
  help      Show this message.

Flags:
  --record     build only. Writes runs/<timestamp>/ with generated files and the event log.
  --watch      verify only. Re-runs the sandbox verify whenever a .ts file in <directory> changes.
  --build-top  scan only. After reporting, build the top-N opportunities (full pipeline each).
  --json       scan only. Emit the raw opportunity list as JSON instead of the formatted report.
  --target     add only. Where to drop the files, defaults to ./connectors/<run-name>.
  --repo       push only. owner/name of the target GitHub repo.
  --path       push only. Where to drop the files inside the repo, defaults to connectors/<run-name>.
  --branch     push only. Branch name to create, defaults to patchbay/<run-name>.
  --dry-run    push only. Print the plan without hitting the GitHub API.

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

  if (first === 'add') return add(argv.slice(1))
  if (first === 'push') return push(argv.slice(1))
  if (first === 'scan') return scan(argv.slice(1))

  switch (cmd) {
    case 'build':
      return build(rest)
    case 'research':
      return research(rest)
    case 'verify':
      return verify(rest)
  }
}

async function scan(args: string[]) {
  const positional = args.filter((a) => !a.startsWith('--'))
  const dir = positional[0] ? resolve(positional[0]) : process.cwd()
  if (!existsSync(dir)) return usageError(`No such directory: ${dir}`)
  const asJson = args.includes('--json')
  const buildTopArg = args.find((a) => a.startsWith('--build-top='))
  const buildTop = buildTopArg ? Math.max(0, Number(buildTopArg.slice('--build-top='.length))) : 0

  const { scanRepo, formatReport } = await import('./scanner')
  const opportunities = scanRepo(dir)
  if (asJson) {
    console.log(JSON.stringify(opportunities, null, 2))
  } else {
    console.log(formatReport(opportunities, dir))
  }

  if (buildTop > 0 && opportunities.length) {
    const top = opportunities.slice(0, buildTop)
    console.log(`\nBuilding top ${top.length} opportunit${top.length === 1 ? 'y' : 'ies'}…\n`)
    for (const [i, op] of top.entries()) {
      console.log(`\n──── (${i + 1}/${top.length}) ${op.file}:${op.line} ────`)
      await build(['--record', op.prompt])
    }
  }
}

/**
 * Copy the files from a recorded run (`runs/<timestamp>/`) into a target
 * project. Default target is ./connectors/<run-basename>, so repeated adds
 * don't overwrite each other.
 */
async function add(args: string[]) {
  const positional = args.filter((a) => !a.startsWith('--'))
  const flag = args.find((a) => a.startsWith('--target='))
  const runDir = positional[0] ? resolve(positional[0]) : ''
  if (!runDir) return usageError('add needs a run directory (e.g. runs/<timestamp>)')
  if (!existsSync(runDir)) return usageError(`No such directory: ${runDir}`)
  const srcDir = join(runDir, 'src')
  if (!existsSync(join(srcDir, 'connector.ts'))) {
    return usageError(`${runDir} does not look like a patchbay run (no src/connector.ts)`)
  }
  const target = flag ? resolve(flag.slice('--target='.length)) : resolve(process.cwd(), 'connectors', basename(runDir))
  if (existsSync(target)) {
    console.error(`Refusing to overwrite ${target}. Pass --target=<fresh-dir> or move the existing folder out of the way.`)
    process.exit(1)
  }
  mkdirSync(target, { recursive: true })
  // src/ is self-contained (connector.ts + connector.test.ts + fixtures.ts).
  cpSync(srcDir, join(target, 'src'), { recursive: true })
  const readme = join(runDir, 'README.md')
  if (existsSync(readme)) cpSync(readme, join(target, 'README.md'))
  const copied = readdirSync(join(target, 'src'))
  console.log(`✔ Copied ${copied.length + (existsSync(readme) ? 1 : 0)} files to ${target}`)
  console.log('  src/' + copied.join('\n  src/'))
  if (existsSync(readme)) console.log('  README.md')
  console.log(`\nTests should already pass unchanged — the connector is self-contained and uses an injected fetch.`)
  console.log(`Add vitest and typescript as dev deps where you'll run them, or wire this into your existing suite.`)
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
  const watchMode = args.includes('--watch')
  const positional = args.filter((a) => !a.startsWith('--'))
  const dir = positional[0] ? resolve(positional[0]) : ''
  if (!dir) return usageError('verify needs a directory')
  if (!collectFiles(dir).some((f) => f.path === 'src/connector.ts')) {
    return usageError(`No src/connector.ts under ${dir}`)
  }
  const config = loadConfig()
  const missing = missingLiveKeys(config)
  if (config.mock || missing.length) {
    console.error(`verify needs live keys. Set PATCHBAY_MOCK=false and provide ${missing.join(', ') || 'the missing env vars'}.`)
    process.exit(1)
  }

  const runOnce = async () => {
    const files = collectFiles(dir)
    console.log(`\nVerifying ${files.length} files from ${dir}`)
    for await (const event of startVerify(files, config)) printEvent(event)
  }

  await runOnce()
  if (!watchMode) return

  console.log(`\nWatching ${dir} for .ts changes. Ctrl+C to exit.`)
  let running = false
  let rerun = false
  // Native fs.watch is good enough: debounced to avoid thrashing when an editor
  // saves multiple files in quick succession.
  let pending: NodeJS.Timeout | null = null
  const trigger = () => {
    if (pending) clearTimeout(pending)
    pending = setTimeout(async () => {
      pending = null
      if (running) { rerun = true; return }
      running = true
      try { await runOnce() } finally {
        running = false
        if (rerun) { rerun = false; trigger() }
      }
    }, 400)
  }
  watch(dir, { recursive: true }, (_, filename) => {
    if (filename && (filename.endsWith('.ts') || filename.endsWith('.json'))) trigger()
  })
  await new Promise(() => {}) // keep the process alive
}

async function push(args: string[]) {
  const positional = args.filter((a) => !a.startsWith('--'))
  const runDir = positional[0] ? resolve(positional[0]) : ''
  if (!runDir) return usageError('push needs a run directory')
  const repo = flagValue(args, '--repo')
  if (!repo) return usageError('push needs --repo=owner/name')
  const target = flagValue(args, '--path') ?? `connectors/${basename(runDir)}`
  const branch = flagValue(args, '--branch')
  const dryRun = args.includes('--dry-run')
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  if (!token && !dryRun) {
    return usageError('push needs GH_TOKEN (or GITHUB_TOKEN) in the environment, with repo scope on the target.')
  }
  try {
    const result = await pushToGitHub({
      runDir, repo, token: token ?? '', targetPath: target,
      ...(branch ? { branch } : {}),
      dryRun,
    })
    console.log(dryRun ? '✔ Dry run:' : '✔ Opened pull request:')
    console.log(`  URL:    ${result.prUrl}`)
    console.log(`  branch: ${result.branch} (base: ${result.base})`)
    console.log(`  files:  ${result.files.length} under ${target}/`)
    for (const path of result.files) console.log(`    ${path}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

function flagValue(args: string[], flag: string): string | undefined {
  const match = args.find((a) => a.startsWith(`${flag}=`))
  return match?.slice(flag.length + 1)
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

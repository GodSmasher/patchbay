import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseTestOutput, TSC_MARKER, VITEST_MARKER } from './report'
import type { SandboxRunner } from './sandbox'
import type { GeneratedFile } from './types'

const TSCONFIG = {
  compilerOptions: {
    target: 'ES2022',
    module: 'ESNext',
    moduleResolution: 'Bundler',
    strict: true,
    skipLibCheck: true,
    types: ['node'],
    lib: ['ES2022', 'DOM'],
  },
  include: ['src/**/*.ts'],
}

/**
 * Fallback runner for development: typecheck + vitest in a temp folder on this machine.
 * Same command and parser as the Nebius sandbox, but NOT isolated, so it is opt-in via
 * PATCHBAY_RUNNER=local and never used by the hosted demo.
 */
export function createLocalRunner(opts: { root?: string; timeoutMs?: number } = {}): SandboxRunner {
  const root = opts.root ?? findRepoRoot(process.cwd())
  const tscEntry = join(root, 'node_modules', 'typescript', 'bin', 'tsc')
  const vitestEntry = join(root, 'node_modules', 'vitest', 'vitest.mjs')
  const timeout = opts.timeoutMs ?? 120_000

  return {
    async prepare(log) {
      log('Local runner: typecheck and tests run on this machine, not in an isolated sandbox')
      return 'local'
    },

    async runTests(_base, files, log) {
      const workRoot = join(root, '.fixture-tmp')
      mkdirSync(workRoot, { recursive: true })
      const work = mkdtempSync(join(workRoot, 'run-'))
      try {
        for (const file of files.filter((f) => f.path.endsWith('.ts'))) write(work, file)
        writeFileSync(join(work, 'tsconfig.json'), JSON.stringify(TSCONFIG))
        writeFileSync(join(work, 'vitest.config.mjs'), 'export default { test: { include: ["src/**/*.test.ts"] } }\n')
        log(`Running tsc and vitest in ${work.replace(root, '.')}`)
        const tsc = await run(tscEntry, ['--noEmit', '-p', 'tsconfig.json'], work, timeout)
        await run(vitestEntry, ['run', '--reporter=json', '--outputFile=result.json'], work, timeout)
        const json = existsSync(join(work, 'result.json')) ? await readText(join(work, 'result.json')) : ''
        const stdout = `${TSC_MARKER}\n${tsc.code}\n${tsc.output}\n${VITEST_MARKER}\n${json}`
        return parseTestOutput(stdout, 'local')
      } finally {
        rmSync(work, { recursive: true, force: true })
      }
    },
  }
}

function write(dir: string, file: GeneratedFile) {
  const path = join(dir, file.path)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, file.content)
}

/** Runs a JS entry point with the current node binary, so no shell and no platform-specific wrappers. */
function run(entry: string, args: string[], cwd: string, timeout: number): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    execFile(process.execPath, [entry, ...args], { cwd, timeout, maxBuffer: 10_000_000 }, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0
      resolve({ code, output: `${stdout}${stderr}`.slice(0, 6000) })
    })
  })
}

async function readText(path: string): Promise<string> {
  const { readFile } = await import('node:fs/promises')
  return readFile(path, 'utf8')
}

function findRepoRoot(start: string): string {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, 'node_modules', 'vitest'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return start
    dir = parent
  }
}

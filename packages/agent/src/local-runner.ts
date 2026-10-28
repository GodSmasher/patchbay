import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parsePytestOutput, parseTestOutput, PYC_MARKER, PYTEST_MARKER, TSC_MARKER, VITEST_MARKER } from './report'
import type { SandboxRunner } from './sandbox'
import type { GeneratedFile, TestReport } from './types'

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
 * Fallback runner for development: typecheck + vitest OR py_compile + pytest in a temp
 * folder on this machine. Same commands and parsers as the Nebius sandbox, but NOT
 * isolated, so it is opt-in via PATCHBAY_RUNNER=local and never used by the hosted demo.
 *
 * TS builds use `tsc --noEmit` + `vitest run` from the repo's own node_modules.
 * Python builds probe the host for python 3.12+ and the three pytest-* deps; when
 * everything is present we run the same compileall + pytest --json-report sequence as
 * the sandbox and reuse parsePytestOutput. Missing deps raise a clear error with the
 * exact `pip install` line.
 */
export function createLocalRunner(opts: { root?: string; timeoutMs?: number; pythonBin?: string } = {}): SandboxRunner {
  const root = opts.root ?? findRepoRoot(process.cwd())
  const tscEntry = join(root, 'node_modules', 'typescript', 'bin', 'tsc')
  const vitestEntry = join(root, 'node_modules', 'vitest', 'vitest.mjs')
  const timeout = opts.timeoutMs ?? 120_000
  const pythonBin = opts.pythonBin ?? (process.platform === 'win32' ? 'python' : 'python3')

  return {
    async prepare(log) {
      log('Local runner: tests run on this machine, not in an isolated sandbox')
      // We don't know the language at prepare() time (prepare is called before any
      // files exist). The language-specific probe happens on first runTests call
      // when we actually see which files are coming in.
      return 'local'
    },

    async runTests(_base, files, log) {
      const isPy = files.some((f) => f.path.endsWith('.py'))
      return isPy
        ? runPythonTests(files, log, { root, pythonBin, timeout })
        : runTypeScriptTests(files, log, { root, tscEntry, vitestEntry, timeout })
    },
  }
}

interface TsCtx {
  root: string
  tscEntry: string
  vitestEntry: string
  timeout: number
}

async function runTypeScriptTests(files: GeneratedFile[], log: (m: string) => void, ctx: TsCtx): Promise<TestReport> {
  const workRoot = join(ctx.root, '.fixture-tmp')
  mkdirSync(workRoot, { recursive: true })
  const work = mkdtempSync(join(workRoot, 'run-'))
  try {
    for (const file of files.filter((f) => f.path.endsWith('.ts'))) write(work, file)
    writeFileSync(join(work, 'tsconfig.json'), JSON.stringify(TSCONFIG))
    writeFileSync(join(work, 'vitest.config.mjs'), 'export default { test: { include: ["src/**/*.test.ts"] } }\n')
    log(`Running tsc and vitest in ${work.replace(ctx.root, '.')}`)
    const tsc = await runNodeEntry(ctx.tscEntry, ['--noEmit', '-p', 'tsconfig.json'], work, ctx.timeout)
    await runNodeEntry(ctx.vitestEntry, ['run', '--reporter=json', '--outputFile=result.json'], work, ctx.timeout)
    const json = existsSync(join(work, 'result.json')) ? await readText(join(work, 'result.json')) : ''
    const stdout = `${TSC_MARKER}\n${tsc.code}\n${tsc.output}\n${VITEST_MARKER}\n${json}`
    return parseTestOutput(stdout, 'local')
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

interface PyCtx {
  root: string
  pythonBin: string
  timeout: number
}

async function runPythonTests(files: GeneratedFile[], log: (m: string) => void, ctx: PyCtx): Promise<TestReport> {
  await probePythonEnv(ctx.pythonBin)
  const workRoot = join(ctx.root, '.fixture-tmp')
  mkdirSync(workRoot, { recursive: true })
  const work = mkdtempSync(join(workRoot, 'py-'))
  try {
    for (const file of files.filter((f) => f.path.endsWith('.py'))) write(work, file)
    writeFileSync(join(work, 'pytest.ini'), '[pytest]\nasyncio_mode = auto\n')
    log(`Running py_compile and pytest in ${work.replace(ctx.root, '.')}`)
    const pyc = await runCmd(ctx.pythonBin, ['-m', 'compileall', '-q', '.'], work, ctx.timeout)
    await runCmd(ctx.pythonBin, ['-m', 'pytest', '-q', '--json-report', '--json-report-file=result.json'], work, ctx.timeout)
    const json = existsSync(join(work, 'result.json')) ? await readText(join(work, 'result.json')) : ''
    const stdout = `${PYC_MARKER}\n${pyc.code}\n${pyc.output}\n${PYTEST_MARKER}\n${json}`
    return parsePytestOutput(stdout, 'local')
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

/**
 * Verify the host has python >=3.12 and the three test deps we rely on
 * (pytest, pytest-asyncio, pytest-json-report). Throws with a precise error +
 * `pip install` line listing exactly which deps are missing.
 */
export async function probePythonEnv(pythonBin: string): Promise<void> {
  const versionOut = await runCmd(pythonBin, ['--version'], process.cwd(), 10_000).catch(() => ({ code: 1, output: '' }))
  if (versionOut.code !== 0 || !/^Python\s+(\d+)\.(\d+)/.test(versionOut.output)) {
    throw new Error(`Local runner (python): '${pythonBin}' not found on PATH. Install Python 3.12+ or set PATCHBAY_RUNNER=nebius.`)
  }
  const m = /^Python\s+(\d+)\.(\d+)/.exec(versionOut.output)
  const major = Number(m?.[1] ?? 0)
  const minor = Number(m?.[2] ?? 0)
  if (major < 3 || (major === 3 && minor < 12)) {
    throw new Error(`Local runner (python): found Python ${major}.${minor}, need >=3.12. Upgrade python or set PATCHBAY_RUNNER=nebius.`)
  }
  const missing: string[] = []
  const probe = async (mod: string, pkg: string) => {
    const res = await runCmd(pythonBin, ['-c', `import ${mod}`], process.cwd(), 10_000).catch(() => ({ code: 1, output: '' }))
    if (res.code !== 0) missing.push(pkg)
  }
  await probe('pytest', 'pytest')
  await probe('pytest_asyncio', 'pytest-asyncio')
  await probe('pytest_jsonreport', 'pytest-json-report')
  if (missing.length) {
    throw new Error(
      `Local runner (python): missing ${missing.join(', ')}. Install with:\n` +
        `  ${pythonBin} -m pip install ${missing.join(' ')}\n` +
        `Or set PATCHBAY_RUNNER=nebius to use the hosted sandbox.`,
    )
  }
}

function write(dir: string, file: GeneratedFile) {
  const path = join(dir, file.path)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, file.content)
}

/** Runs a JS entry point with the current node binary, so no shell and no platform-specific wrappers. */
function runNodeEntry(entry: string, args: string[], cwd: string, timeout: number): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    execFile(process.execPath, [entry, ...args], { cwd, timeout, maxBuffer: 10_000_000 }, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0
      resolve({ code, output: `${stdout}${stderr}`.slice(0, 6000) })
    })
  })
}

/** Runs an arbitrary external command (python, pytest, …) and captures combined stdout + stderr. */
function runCmd(bin: string, args: string[], cwd: string, timeout: number): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    execFile(bin, args, { cwd, timeout, maxBuffer: 10_000_000 }, (error, stdout, stderr) => {
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

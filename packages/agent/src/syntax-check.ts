import { spawn } from 'node:child_process'
import { transform } from 'esbuild'
import type { GeneratedFile, Lang, TestReport } from './types'

/**
 * The strong model occasionally produces TypeScript that fails to parse: a stray paren,
 * an unterminated string, a misplaced comma. The sandbox catches it, but burns 15-30s
 * on the fork and a whole repair attempt. Running an esbuild parse here first catches
 * the same class of error offline in milliseconds and returns a report shaped like a
 * sandbox failure, so the repair loop reacts to it the same way.
 *
 * Returns null when every .ts file parses cleanly; otherwise a synthetic TestReport
 * the loop can treat as a failed attempt.
 *
 * For Python, we probe the host for `python` and ask it to AST-parse each .py file.
 * If python is available (dev / CI machines usually have it) we catch syntax errors
 * offline the same way esbuild does for TS. If python is missing (hosted Vercel
 * builds, bare servers) we skip the preflight and let the sandbox's compileall
 * handle it — same behaviour as before, no regression.
 */
export async function preflightSyntax(files: GeneratedFile[], lang: Lang = 'ts'): Promise<TestReport | null> {
  if (lang === 'py') return preflightSyntaxPy(files)
  const tsFiles = files.filter((f) => f.path.endsWith('.ts'))
  const failures: { file: string; message: string; line?: number }[] = []
  await Promise.all(
    tsFiles.map(async (f) => {
      try {
        await transform(f.content, {
          loader: 'ts',
          sourcefile: f.path,
          sourcemap: false,
          target: 'es2022',
        })
      } catch (error) {
        const errs = (error as { errors?: { text?: string; location?: { line?: number; column?: number } }[] }).errors ?? []
        for (const e of errs) {
          failures.push({
            file: f.path,
            line: e.location?.line,
            message: e.text ? `${e.text}${e.location ? ` at ${f.path}:${e.location.line}:${e.location.column ?? 0}` : ''}` : String(error),
          })
        }
        if (!errs.length) failures.push({ file: f.path, message: error instanceof Error ? error.message : String(error) })
      }
    }),
  )
  if (failures.length === 0) return null

  return {
    typecheckOk: false,
    typecheckOutput: failures.map((f) => `${f.file}: ${f.message}`).join('\n'),
    passed: 0,
    failed: failures.length,
    total: failures.length,
    failures: failures.map((f) => ({
      name: `syntax (${f.file}${f.line ? `:${f.line}` : ''})`,
      message: f.message,
    })),
    durationMs: 0,
    ranOn: 'preflight:esbuild',
    passedNames: [],
  }
}

/**
 * Python preflight: ask the host's `python` to AST-parse each .py file. Saves a full
 * sandbox round when the strong model produces syntax-invalid Python. If python is
 * not installed on the host, we silently return null (same as the earlier no-op) so
 * the sandbox's compileall catches syntax errors instead.
 */
let pythonAvailable: boolean | null = null
async function preflightSyntaxPy(files: GeneratedFile[]): Promise<TestReport | null> {
  const pyFiles = files.filter((f) => f.path.endsWith('.py'))
  if (pyFiles.length === 0) return null
  if (pythonAvailable === null) pythonAvailable = await probePython()
  if (!pythonAvailable) return null

  const failures: { file: string; message: string; line?: number }[] = []
  await Promise.all(
    pyFiles.map(async (f) => {
      // Single python invocation per file: pipe stdin with `python -I` (isolated, no
      // path tricks) and `-c "..."` that reads stdin and calls ast.parse. Returns exit 0
      // on parse success, nonzero + a formatted traceback on failure.
      const script = [
        'import sys, ast, json',
        'src = sys.stdin.read()',
        'try:',
        '    ast.parse(src, filename=sys.argv[1])',
        '    sys.exit(0)',
        'except SyntaxError as e:',
        `    print(json.dumps({'line': e.lineno, 'col': e.offset, 'msg': str(e.msg)}))`,
        '    sys.exit(1)',
      ].join('\n')
      const result = await runPython(['-I', '-c', script, f.path], f.content)
      if (result.exit === 0) return
      try {
        const parsed = JSON.parse(result.stdout.trim()) as { line?: number; col?: number; msg?: string }
        failures.push({ file: f.path, line: parsed.line, message: `${parsed.msg ?? 'SyntaxError'}${parsed.col ? ` (col ${parsed.col})` : ''}` })
      } catch {
        failures.push({ file: f.path, message: (result.stdout || result.stderr || 'SyntaxError').slice(0, 400) })
      }
    }),
  )
  if (failures.length === 0) return null

  return {
    typecheckOk: false,
    typecheckOutput: failures.map((f) => `${f.file}${f.line ? `:${f.line}` : ''}: ${f.message}`).join('\n'),
    passed: 0,
    failed: failures.length,
    total: failures.length,
    failures: failures.map((f) => ({
      name: `syntax (${f.file}${f.line ? `:${f.line}` : ''})`,
      message: f.message,
    })),
    durationMs: 0,
    ranOn: 'preflight:ast',
    passedNames: [],
  }
}

async function probePython(): Promise<boolean> {
  const { exit } = await runPython(['-c', 'import ast'], '')
  return exit === 0
}

function runPython(args: string[], stdin: string): Promise<{ exit: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32' ? 'python' : 'python3'
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (b) => (stdout += b.toString()))
    child.stderr.on('data', (b) => (stderr += b.toString()))
    child.on('error', () => resolve({ exit: 127, stdout, stderr: stderr || 'python not found' }))
    child.on('close', (code) => resolve({ exit: code ?? 1, stdout, stderr }))
    child.stdin.end(stdin)
  })
}

/** Reset the cached python-available flag; useful in tests. */
export function _resetPythonProbe(): void {
  pythonAvailable = null
}

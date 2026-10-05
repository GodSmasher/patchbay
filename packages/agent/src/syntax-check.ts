import { transform } from 'esbuild'
import type { GeneratedFile, TestReport } from './types'

/**
 * The strong model occasionally produces TypeScript that fails to parse: a stray paren,
 * an unterminated string, a misplaced comma. The sandbox catches it, but burns 15-30s
 * on the fork and a whole repair attempt. Running an esbuild parse here first catches
 * the same class of error offline in milliseconds and returns a report shaped like a
 * sandbox failure, so the repair loop reacts to it the same way.
 *
 * Returns null when every .ts file parses cleanly; otherwise a synthetic TestReport
 * the loop can treat as a failed attempt.
 */
export async function preflightSyntax(files: GeneratedFile[]): Promise<TestReport | null> {
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

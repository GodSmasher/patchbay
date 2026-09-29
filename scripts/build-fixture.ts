/**
 * Builds packages/agent/src/fixtures/typeform-pipedrive/run.json, the replay shown when no
 * API keys are configured. The code of both attempts is real and the test reports come from
 * actually running tsc + vitest on it, through the same parser the sandbox path uses.
 */
import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderFixtures, withContract } from '../packages/agent/src/contract'
import { parseTestOutput, TSC_MARKER, VITEST_MARKER } from '../packages/agent/src/report'
import type { GeneratedFile, RunEvent, TestReport } from '../packages/agent/src/types'

const root = join(import.meta.dirname, '..')
const fixture = join(root, 'packages/agent/src/fixtures/typeform-pipedrive')
const meta = JSON.parse(readFileSync(join(fixture, 'meta.json'), 'utf8'))
const FILES = ['src/connector.ts', 'src/connector.test.ts', 'README.md']
const fixturesFile = renderFixtures(meta.spec)
for (const dir of ['attempt-1', 'final']) writeFileSync(join(fixture, dir, fixturesFile.path), fixturesFile.content)

const read = (dir: string): GeneratedFile[] => [
  ...FILES.map((path) => ({ path, content: readFileSync(join(fixture, dir, path), 'utf8') })),
  fixturesFile,
]

function test(dir: string): TestReport {
  // inside the repo so `vitest` and `@types/node` resolve from the root node_modules
  mkdirSync(join(root, '.fixture-tmp'), { recursive: true })
  const work = mkdtempSync(join(root, '.fixture-tmp', 'run-'))
  try {
    cpSync(join(fixture, dir, 'src'), join(work, 'src'), { recursive: true })
    writeFileSync(join(work, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, skipLibCheck: true, types: ['node'], lib: ['ES2022', 'DOM'] },
      include: ['src/**/*.ts'],
    }))
    writeFileSync(join(work, 'vitest.config.mjs'), 'export default { test: { include: ["src/**/*.test.ts"] } }\n')
    const bin = (name: string) => join(root, 'node_modules', '.bin', name)
    let tscOut = ''
    let tscCode = 0
    try {
      tscOut = execSync(`"${bin('tsc')}" --noEmit -p tsconfig.json`, { cwd: work, encoding: 'utf8' })
    } catch (error) {
      tscCode = 1
      tscOut = String((error as { stdout?: string }).stdout ?? '')
    }
    try {
      execSync(`"${bin('vitest')}" run --reporter=json --outputFile=result.json`, { cwd: work, stdio: 'ignore' })
    } catch {
      // failing tests exit non-zero; the JSON report is still written
    }
    const stdout = `${TSC_MARKER}\n${tscCode}\n${tscOut}\n${VITEST_MARKER}\n${readFileSync(join(work, 'result.json'), 'utf8')}`
    const report = parseTestOutput(stdout, 'replay')
    for (const failure of report.failures) failure.message = failure.message.replaceAll(work.replace(/\\/g, '/'), '/work').replaceAll(work, '/work')
    return report
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

const first = read('attempt-1')
const final = read('final')
const firstReport = withContract(test('attempt-1'), first)
const finalReport = withContract(test('final'), final)
if (firstReport.failed === 0) throw new Error('attempt-1 is supposed to fail its tests')
if (finalReport.failed !== 0 || !finalReport.typecheckOk) throw new Error(`final fixture must be green: ${JSON.stringify(finalReport.failures)}
${finalReport.typecheckOutput}`)

const plan = meta.plan
const events: RunEvent[] = [
  { type: 'mode', mode: 'live' },
  { type: 'step', step: 'plan', status: 'start' },
  { type: 'plan', plan },
  { type: 'step', step: 'plan', status: 'done', detail: plan.summary },
  { type: 'step', step: 'research', status: 'start' },
  { type: 'log', step: 'research', message: `Searched "${plan.source.docsQuery}": 5 results` },
  { type: 'log', step: 'research', message: `Searched "${plan.target.docsQuery}": 5 results` },
  { type: 'log', step: 'research', message: `Extracted ${meta.sources.length} documentation pages` },
  { type: 'sources', sources: meta.sources },
  { type: 'spec', spec: meta.spec },
  { type: 'step', step: 'research', status: 'done', detail: `${meta.spec.target.length + 1} endpoints from ${meta.sources.length} pages` },
  { type: 'step', step: 'generate', status: 'start' },
  { type: 'files', attempt: 1, files: first },
  { type: 'step', step: 'generate', status: 'done', detail: FILES.join(', ') },
  { type: 'log', step: 'generate', message: 'Wrote src/fixtures.ts from the documented example payload and responses' },
  { type: 'step', step: 'verify', status: 'start' },
  { type: 'log', step: 'verify', message: 'Reusing prepared sandbox image (node 22, typescript, vitest)' },
  { type: 'log', step: 'verify', message: 'Forking checkpoint with 4 files, network off' },
  { type: 'tests', attempt: 1, report: firstReport },
  { type: 'log', step: 'verify', message: `Attempt 1 failed (${firstReport.failed} tests, typecheck ${firstReport.typecheckOk ? 'ok' : 'failed'}), repairing` },
  { type: 'files', attempt: 2, files: final },
  { type: 'log', step: 'verify', message: 'Forking checkpoint with 4 files, network off' },
  { type: 'tests', attempt: 2, report: finalReport },
  { type: 'step', step: 'verify', status: 'done', detail: `${finalReport.passed}/${finalReport.total} tests after 2 attempts` },
  { type: 'step', step: 'package', status: 'start' },
  { type: 'result', ok: true, attempts: 2, files: final, report: finalReport },
  { type: 'step', step: 'package', status: 'done' },
]

writeFileSync(join(fixture, 'run.json'), `${JSON.stringify({ prompt: meta.prompt, origin: 'fixture', events }, null, 2)}\n`)
console.log(`run.json written: attempt 1 ${firstReport.passed}/${firstReport.total}, final ${finalReport.passed}/${finalReport.total}`)

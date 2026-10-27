import type { TestFailure, TestReport } from './types'

export const TSC_MARKER = '@@PATCHBAY_TSC@@'
export const VITEST_MARKER = '@@PATCHBAY_VITEST@@'
export const PYC_MARKER = '@@PATCHBAY_PYC@@'
export const PYTEST_MARKER = '@@PATCHBAY_PYTEST@@'

/**
 * Shell run inside the sandbox. Type-checks, runs vitest with the JSON reporter and
 * prints both results between markers so a single stdout carries everything.
 */
export const TEST_COMMAND = [
  'cd /work',
  'npx tsc --noEmit -p tsconfig.json > /tmp/tsc.txt 2>&1; echo $? > /tmp/tsc.code',
  'npx vitest run --reporter=json --outputFile=/tmp/vitest.json > /tmp/vitest.log 2>&1',
  `echo "${TSC_MARKER}"`,
  'cat /tmp/tsc.code',
  'head -c 6000 /tmp/tsc.txt',
  `echo "${VITEST_MARKER}"`,
  'cat /tmp/vitest.json 2>/dev/null || tail -c 6000 /tmp/vitest.log',
].join('; ')

/**
 * Python counterpart of TEST_COMMAND. Compile every .py file with py_compile first (cheap
 * static check: syntax, undefined-name imports fail at module load), then pytest with the
 * JSON reporter. Both results print between markers so one stdout stream carries everything.
 */
export const TEST_COMMAND_PY = [
  'cd /work',
  'python -m compileall -q . > /tmp/pyc.txt 2>&1; echo $? > /tmp/pyc.code',
  'python -m pytest -q --json-report --json-report-file=/tmp/pytest.json > /tmp/pytest.log 2>&1',
  `echo "${PYC_MARKER}"`,
  'cat /tmp/pyc.code',
  'head -c 6000 /tmp/pyc.txt',
  `echo "${PYTEST_MARKER}"`,
  'cat /tmp/pytest.json 2>/dev/null || tail -c 6000 /tmp/pytest.log',
].join('; ')

interface VitestJson {
  numTotalTests?: number
  numPassedTests?: number
  numFailedTests?: number
  startTime?: number
  testResults?: {
    endTime?: number
    message?: string
    assertionResults?: { fullName?: string; title?: string; status?: string; failureMessages?: string[] }[]
  }[]
}

export function parseTestOutput(stdout: string, ranOn: string): TestReport {
  const tscStart = stdout.indexOf(TSC_MARKER)
  const vitestStart = stdout.indexOf(VITEST_MARKER)
  const tscSection = tscStart >= 0 ? stdout.slice(tscStart + TSC_MARKER.length, vitestStart >= 0 ? vitestStart : undefined).trim() : ''
  const vitestSection = vitestStart >= 0 ? stdout.slice(vitestStart + VITEST_MARKER.length).trim() : stdout.trim()

  const [codeLine = '1', ...tscLines] = tscSection.split('\n')
  const typecheckOk = codeLine.trim() === '0'
  const typecheckOutput = tscLines.join('\n').trim()

  let json: VitestJson | null = null
  try {
    const start = vitestSection.indexOf('{')
    json = start >= 0 ? (JSON.parse(vitestSection.slice(start)) as VitestJson) : null
  } catch {
    json = null
  }

  if (!json) {
    return {
      typecheckOk,
      typecheckOutput,
      passed: 0,
      failed: 1,
      total: 1,
      failures: [{ name: 'vitest', message: truncate(vitestSection || 'vitest produced no output', 4000) }],
      durationMs: 0,
      ranOn,
    }
  }

  const failures: TestFailure[] = []
  const passedNames: string[] = []
  let endTime = json.startTime ?? 0
  for (const file of json.testResults ?? []) {
    endTime = Math.max(endTime, file.endTime ?? 0)
    if ((file.assertionResults ?? []).length === 0 && file.message) {
      failures.push({ name: 'test file', message: truncate(stripAnsi(file.message), 2000) })
    }
    for (const assertion of file.assertionResults ?? []) {
      if (assertion.status === 'passed') passedNames.push(assertion.fullName || assertion.title || '')
      if (assertion.status === 'failed') {
        failures.push({
          name: assertion.fullName || assertion.title || 'unnamed test',
          message: truncate(stripAnsi((assertion.failureMessages ?? []).join('\n')), 2000),
        })
      }
    }
  }

  const total = json.numTotalTests ?? 0
  const failed = Math.max(json.numFailedTests ?? 0, failures.length)
  return {
    typecheckOk,
    typecheckOutput,
    passed: json.numPassedTests ?? Math.max(0, total - failed),
    failed,
    total: Math.max(total, failed),
    failures,
    durationMs: json.startTime && endTime ? Math.max(0, endTime - json.startTime) : 0,
    ranOn,
    passedNames,
  }
}

interface PytestJson {
  created?: number
  duration?: number
  exitcode?: number
  summary?: { passed?: number; failed?: number; error?: number; skipped?: number; total?: number; collected?: number }
  tests?: {
    nodeid?: string
    outcome?: 'passed' | 'failed' | 'skipped' | 'error' | 'xfailed' | 'xpassed'
    call?: { longrepr?: string }
    setup?: { longrepr?: string }
    teardown?: { longrepr?: string }
  }[]
  collectors?: { nodeid?: string; outcome?: string; longrepr?: string }[]
}

/**
 * Parse the two-section Python output: py_compile exit code + pytest JSON report.
 * typecheckOk here means `python -m compileall` printed exit 0 — every .py file parsed.
 * A collection error (e.g. import failure in test_connector.py) still produces a report
 * with failed > 0 so the repair loop reacts to it.
 */
export function parsePytestOutput(stdout: string, ranOn: string): TestReport {
  const pycStart = stdout.indexOf(PYC_MARKER)
  const pytestStart = stdout.indexOf(PYTEST_MARKER)
  const pycSection = pycStart >= 0 ? stdout.slice(pycStart + PYC_MARKER.length, pytestStart >= 0 ? pytestStart : undefined).trim() : ''
  const pytestSection = pytestStart >= 0 ? stdout.slice(pytestStart + PYTEST_MARKER.length).trim() : stdout.trim()

  const [codeLine = '1', ...pycLines] = pycSection.split('\n')
  const typecheckOk = codeLine.trim() === '0'
  const typecheckOutput = pycLines.join('\n').trim()

  let json: PytestJson | null = null
  try {
    const start = pytestSection.indexOf('{')
    json = start >= 0 ? (JSON.parse(pytestSection.slice(start)) as PytestJson) : null
  } catch {
    json = null
  }

  if (!json) {
    return {
      typecheckOk,
      typecheckOutput,
      passed: 0,
      failed: 1,
      total: 1,
      failures: [{ name: 'pytest', message: truncate(pytestSection || 'pytest produced no output', 4000) }],
      durationMs: 0,
      ranOn,
    }
  }

  const failures: TestFailure[] = []
  const passedNames: string[] = []
  for (const collector of json.collectors ?? []) {
    if (collector.outcome === 'failed' && collector.longrepr) {
      failures.push({ name: `collection: ${collector.nodeid ?? 'unknown'}`, message: truncate(stripAnsi(collector.longrepr), 2000) })
    }
  }
  for (const test of json.tests ?? []) {
    const name = test.nodeid ?? 'unnamed test'
    if (test.outcome === 'passed' || test.outcome === 'xpassed') {
      passedNames.push(name)
      continue
    }
    if (test.outcome === 'failed' || test.outcome === 'error') {
      const detail = test.call?.longrepr ?? test.setup?.longrepr ?? test.teardown?.longrepr ?? '(no detail)'
      failures.push({ name, message: truncate(stripAnsi(detail), 2000) })
    }
  }

  const summary = json.summary ?? {}
  const passed = summary.passed ?? passedNames.length
  const summaryFailed = (summary.failed ?? 0) + (summary.error ?? 0)
  const failed = Math.max(summaryFailed, failures.length)
  const total = Math.max(summary.total ?? summary.collected ?? 0, passed + failed)
  return {
    typecheckOk,
    typecheckOutput,
    passed,
    failed,
    total,
    failures,
    durationMs: json.duration ? Math.round(json.duration * 1000) : 0,
    ranOn,
    passedNames,
  }
}

export function isGreen(report: TestReport): boolean {
  const contractOk = report.contract === undefined || report.contract === 'passed'
  return report.typecheckOk && report.failed === 0 && report.total > 0 && contractOk
}

const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '')
const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max)}\n…` : s)

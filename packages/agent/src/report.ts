import type { TestFailure, TestReport } from './types'

export const TSC_MARKER = '@@PATCHBAY_TSC@@'
export const VITEST_MARKER = '@@PATCHBAY_VITEST@@'

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
  let endTime = json.startTime ?? 0
  for (const file of json.testResults ?? []) {
    endTime = Math.max(endTime, file.endTime ?? 0)
    if ((file.assertionResults ?? []).length === 0 && file.message) {
      failures.push({ name: 'test file', message: truncate(stripAnsi(file.message), 2000) })
    }
    for (const assertion of file.assertionResults ?? []) {
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
  }
}

export function isGreen(report: TestReport): boolean {
  return report.typecheckOk && report.failed === 0 && report.total > 0
}

const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '')
const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max)}\n…` : s)

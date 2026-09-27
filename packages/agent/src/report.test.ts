import { describe, expect, it } from 'vitest'
import { isGreen, parseTestOutput, TSC_MARKER, VITEST_MARKER } from './report'

const vitestJson = (failed: boolean) =>
  JSON.stringify({
    numTotalTests: 2,
    numPassedTests: failed ? 1 : 2,
    numFailedTests: failed ? 1 : 0,
    startTime: 1000,
    testResults: [
      {
        endTime: 1450,
        assertionResults: [
          { fullName: 'handle maps fields', status: 'passed', failureMessages: [] },
          { fullName: 'handle sends auth', status: failed ? 'failed' : 'passed', failureMessages: failed ? ['\u001b[31mAssertionError\u001b[39m: expected null to be "t"'] : [] },
        ],
      },
    ],
  })

describe('parseTestOutput', () => {
  it('reads typecheck status and vitest results', () => {
    const report = parseTestOutput(`${TSC_MARKER}\n0\n${VITEST_MARKER}\n${vitestJson(true)}`, 'op-1')
    expect(report).toMatchObject({ typecheckOk: true, passed: 1, failed: 1, total: 2, durationMs: 450, ranOn: 'op-1' })
    expect(report.failures).toEqual([{ name: 'handle sends auth', message: 'AssertionError: expected null to be "t"' }])
    expect(isGreen(report)).toBe(false)
  })

  it('is green only with a clean typecheck and passing tests', () => {
    expect(isGreen(parseTestOutput(`${TSC_MARKER}\n0\n${VITEST_MARKER}\n${vitestJson(false)}`, 'x'))).toBe(true)
    const tscFailed = parseTestOutput(`${TSC_MARKER}\n2\nsrc/connector.ts(3,1): error TS2322\n${VITEST_MARKER}\n${vitestJson(false)}`, 'x')
    expect(tscFailed.typecheckOk).toBe(false)
    expect(tscFailed.typecheckOutput).toContain('TS2322')
    expect(isGreen(tscFailed)).toBe(false)
  })

  it('turns a crashed test run into a single failure', () => {
    const report = parseTestOutput(`${TSC_MARKER}\n0\n${VITEST_MARKER}\nSyntaxError: Unexpected token`, 'x')
    expect(report).toMatchObject({ failed: 1, total: 1 })
    expect(report.failures[0]?.message).toContain('SyntaxError')
  })
})

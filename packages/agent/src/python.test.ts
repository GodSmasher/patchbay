import { describe, it, expect } from 'vitest'
import { parsePytestOutput, PYC_MARKER, PYTEST_MARKER } from './report'
import { renderFixturesPy, contractMissingPy, withContractFor } from './contract'
import type { ApiSpec, GeneratedFile } from './types'

/**
 * Python-path parsers and fixture renderer. The sandbox integration itself is tested
 * end-to-end against a real Nebius sandbox in a separate script; this file covers the
 * pure functions so a wrong edit to prompts/fixtures/report shows up as a red test
 * before burning sandbox time.
 */

function pytestStdout(opts: { pycCode?: string; pycMessage?: string; pytestJson: object }): string {
  return [
    'some-noise-before',
    PYC_MARKER,
    opts.pycCode ?? '0',
    opts.pycMessage ?? '',
    PYTEST_MARKER,
    JSON.stringify(opts.pytestJson),
  ].join('\n')
}

describe('parsePytestOutput', () => {
  it('reports a clean green run', () => {
    const stdout = pytestStdout({
      pytestJson: {
        duration: 0.42,
        exitcode: 0,
        summary: { passed: 3, failed: 0, total: 3 },
        tests: [
          { nodeid: 'test_connector.py::test_contract_handles_documented_example', outcome: 'passed' },
          { nodeid: 'test_connector.py::test_missing_field_raises', outcome: 'passed' },
          { nodeid: 'test_connector.py::test_non_2xx_response_raises', outcome: 'passed' },
        ],
      },
    })
    const report = parsePytestOutput(stdout, 'nebius-sandbox:op-abc')
    expect(report.typecheckOk).toBe(true)
    expect(report.passed).toBe(3)
    expect(report.failed).toBe(0)
    expect(report.total).toBe(3)
    expect(report.failures).toEqual([])
    expect(report.passedNames).toContain('test_connector.py::test_contract_handles_documented_example')
    expect(report.durationMs).toBe(420)
  })

  it('surfaces py_compile errors as typecheck failure', () => {
    const stdout = pytestStdout({
      pycCode: '1',
      pycMessage: "connector.py:14: SyntaxError: invalid syntax",
      pytestJson: {
        duration: 0.01,
        exitcode: 2,
        summary: { passed: 0, failed: 0, error: 0, total: 0 },
        tests: [],
      },
    })
    const report = parsePytestOutput(stdout, 'nebius-sandbox:op-xyz')
    expect(report.typecheckOk).toBe(false)
    expect(report.typecheckOutput).toContain('SyntaxError')
  })

  it('records failed tests with longrepr', () => {
    const stdout = pytestStdout({
      pytestJson: {
        duration: 0.5,
        exitcode: 1,
        summary: { passed: 1, failed: 2, total: 3 },
        tests: [
          { nodeid: 'test_connector.py::test_happy_path', outcome: 'passed' },
          {
            nodeid: 'test_connector.py::test_contract_handles_documented_example',
            outcome: 'failed',
            call: { longrepr: 'AssertionError: expected call to /v1/contacts\n  actual: /v2/contacts' },
          },
          {
            nodeid: 'test_connector.py::test_auth_header',
            outcome: 'failed',
            call: { longrepr: 'AssertionError: header "X-Api-Key" missing' },
          },
        ],
      },
    })
    const report = parsePytestOutput(stdout, 'test')
    expect(report.failed).toBe(2)
    expect(report.passed).toBe(1)
    expect(report.failures).toHaveLength(2)
    expect(report.failures[0]!.name).toContain('test_contract_handles_documented_example')
    expect(report.failures[0]!.message).toContain('expected call to /v1/contacts')
  })

  it('handles collection errors (import failures)', () => {
    const stdout = pytestStdout({
      pytestJson: {
        duration: 0.01,
        exitcode: 2,
        summary: { passed: 0, failed: 0, error: 1, total: 0 },
        collectors: [
          { nodeid: 'test_connector.py', outcome: 'failed', longrepr: "ImportError: No module named 'httpx'" },
        ],
        tests: [],
      },
    })
    const report = parsePytestOutput(stdout, 'test')
    expect(report.failed).toBeGreaterThan(0)
    expect(report.failures[0]!.message).toContain('ImportError')
  })

  it('falls back when pytest JSON is missing (sandbox crashed early)', () => {
    const stdout = `${PYC_MARKER}\n0\n\n${PYTEST_MARKER}\nTraceback (most recent call last):\n  File "/work/conftest.py", line 1, in <module>\n    ...\n`
    const report = parsePytestOutput(stdout, 'test')
    expect(report.failed).toBe(1)
    expect(report.failures[0]!.name).toBe('pytest')
    expect(report.failures[0]!.message).toContain('Traceback')
  })
})

describe('renderFixturesPy', () => {
  const spec: ApiSpec = {
    source: {
      app: 'Stripe',
      role: 'source',
      method: 'POST',
      url: 'https://example.com/webhook',
      auth: { type: 'header', name: 'Stripe-Signature', envVar: 'STRIPE_WEBHOOK_SECRET' },
      example: { id: 'evt_123', type: 'checkout.session.completed', data: { object: { amount_total: 2000, customer_email: 'a@b.co' } } },
      docsUrl: 'https://stripe.com/docs/webhooks',
      notes: [],
    },
    target: [
      {
        app: 'Slack',
        role: 'target',
        method: 'POST',
        url: 'https://slack.com/api/chat.postMessage',
        auth: { type: 'bearer', envVar: 'SLACK_BOT_TOKEN' },
        example: { channel: '#billing', text: 'A payment arrived' },
        responseExample: { ok: true, ts: '1234567890.0' },
        docsUrl: 'https://api.slack.com/methods/chat.postMessage',
        notes: [],
      },
    ],
  }

  it('writes fixtures.py with SOURCE_EXAMPLE, TARGET_ENDPOINTS and contract_fetch', () => {
    const file = renderFixturesPy(spec)
    expect(file.path).toBe('fixtures.py')
    expect(file.content).toContain('SOURCE_EXAMPLE')
    expect(file.content).toContain('TARGET_ENDPOINTS')
    expect(file.content).toContain('def contract_fetch')
    expect(file.content).toContain('def fake_fetch')
    expect(file.content).toContain('def json_response')
    expect(file.content).toContain('evt_123')
    expect(file.content).toContain('slack.com/api/chat.postMessage')
    expect(file.content).toContain('# Source: https://stripe.com/docs/webhooks')
    // No stray double-hash from the docs header substitution.
    expect(file.content).not.toMatch(/^# # Source:/m)
  })

  it('escapes JSON correctly so Python can import it', () => {
    const file = renderFixturesPy(spec)
    // The embedded SOURCE_EXAMPLE must be valid Python literal syntax (JSON is a subset for these simple
    // types). Simplest check: no triple-quote injection or stray backticks.
    expect(file.content).not.toContain('```')
    expect(file.content).not.toContain('"""{')
  })
})

describe('contractMissingPy', () => {
  function py(path: string, content: string): GeneratedFile {
    return { path, content }
  }

  it('passes when the test file imports from fixtures and defines test_contract*', () => {
    const files = [
      py('connector.py', 'async def handle(payload, config):\n    return {}\n'),
      py('test_connector.py', `
from fixtures import SOURCE_EXAMPLE, contract_fetch
from connector import handle
import pytest

async def test_contract_runs_documented_example():
    fetch, calls = contract_fetch()
    await handle(SOURCE_EXAMPLE, { 'fetch': fetch })
    assert len(calls) > 0
`),
    ]
    expect(contractMissingPy(files)).toBeNull()
  })

  it('flags a missing import from fixtures', () => {
    const files = [py('test_connector.py', 'async def test_contract_x(): assert True\n')]
    expect(contractMissingPy(files)).toContain('import')
  })

  it('flags a missing test_contract* function', () => {
    const files = [
      py('test_connector.py', `from fixtures import SOURCE_EXAMPLE, contract_fetch\n\ndef test_happy():\n    assert True\n`),
    ]
    expect(contractMissingPy(files)).toContain('test_contract')
  })
})

describe('withContractFor(py)', () => {
  it('appends a "missing" failure when the static check fails', () => {
    const files = [{ path: 'test_connector.py', content: 'def test_x(): pass\n' } as GeneratedFile]
    const baseReport = {
      typecheckOk: true,
      typecheckOutput: '',
      passed: 1,
      failed: 0,
      total: 1,
      failures: [],
      durationMs: 10,
      ranOn: 'test',
      passedNames: ['test_x'],
    }
    const folded = withContractFor('py', baseReport, files)
    expect(folded.contract).toBe('missing')
    expect(folded.failed).toBe(1)
    expect(folded.failures.at(-1)!.name).toBe('contract (static check)')
  })

  it('marks the run as contract=passed when a test_contract* test passed', () => {
    const files = [
      {
        path: 'test_connector.py',
        content: 'from fixtures import SOURCE_EXAMPLE, contract_fetch\n\nasync def test_contract_x(): pass\n',
      } as GeneratedFile,
    ]
    const baseReport = {
      typecheckOk: true,
      typecheckOutput: '',
      passed: 1,
      failed: 0,
      total: 1,
      failures: [],
      durationMs: 10,
      ranOn: 'test',
      passedNames: ['test_connector.py::test_contract_x'],
    }
    const folded = withContractFor('py', baseReport, files)
    expect(folded.contract).toBe('passed')
    expect(folded.failed).toBe(0)
  })
})

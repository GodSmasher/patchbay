import type { ApiSpec, GeneratedFile, TestReport } from './types'

export const FIXTURES_PATH = 'src/fixtures.ts'

/**
 * The model writes the connector and most of its tests, so those tests share its
 * assumptions. The contract fixtures break that loop: patchbay writes them from the
 * documentation the research step extracted, overwrites them on every attempt, and the
 * test suite must run the connector against them unchanged.
 */
export function renderFixtures(spec: ApiSpec): GeneratedFile {
  const responses: Record<string, unknown> = {}
  const endpoints: { method: string; url: string }[] = []
  for (const target of spec.target) {
    const method = target.method.toUpperCase()
    responses[`${method} ${target.url}`] = target.responseExample ?? {}
    endpoints.push({ method, url: target.url })
  }
  const docs = [spec.source.docsUrl, ...spec.target.map((t) => t.docsUrl)].filter(Boolean)
  const content = [
    '// Written by patchbay from the API documentation. Regenerated on every attempt, do not edit.',
    ...[...new Set(docs)].map((url) => `// Source: ${url}`),
    '',
    '/** Example payload of the source event, as documented. */',
    `export const SOURCE_EXAMPLE = ${JSON.stringify(spec.source.example ?? {}, null, 2)}`,
    '',
    '/** Target endpoints the connector may call, in the documented order. */',
    `export const TARGET_ENDPOINTS: { method: string; url: string }[] = ${JSON.stringify(endpoints, null, 2)}`,
    '',
    '/** Documented response bodies, keyed by "METHOD url". */',
    `export const TARGET_RESPONSES: Record<string, unknown> = ${JSON.stringify(responses, null, 2)}`,
    '',
  ].join('\n')
  return { path: FIXTURES_PATH, content }
}

export type ContractStatus = NonNullable<TestReport['contract']>

/** Static half of the contract check: the suite must actually use the fixtures. */
export function contractMissing(files: GeneratedFile[]): string | null {
  const tests = files.find((f) => f.path === 'src/connector.test.ts')?.content ?? ''
  if (!/from\s+['"]\.\/fixtures['"]/.test(tests)) {
    return 'src/connector.test.ts does not import SOURCE_EXAMPLE / TARGET_RESPONSES from ./fixtures'
  }
  if (!/describe\(\s*['"`]contract/.test(tests)) {
    return 'src/connector.test.ts has no describe("contract", ...) block running handle on SOURCE_EXAMPLE'
  }
  if (!tests.includes('SOURCE_EXAMPLE')) {
    return 'the contract tests never pass SOURCE_EXAMPLE to handle'
  }
  return null
}

/** Folds the static check and the contract test results into the report. */
export function withContract(report: TestReport, files: GeneratedFile[]): TestReport {
  const missing = contractMissing(files)
  if (missing) {
    return {
      ...report,
      contract: 'missing',
      failed: report.failed + 1,
      total: report.total + 1,
      failures: [...report.failures, { name: 'contract (static check)', message: missing }],
    }
  }
  const failed = report.failures.some((f) => /^contract\b/i.test(f.name))
  return { ...report, contract: failed ? 'failed' : 'passed' }
}

/** Keeps the model's files and puts the authoritative fixtures next to them. */
export function withFixtures(files: GeneratedFile[], fixtures: GeneratedFile): GeneratedFile[] {
  return [...files.filter((f) => f.path !== FIXTURES_PATH), fixtures]
}

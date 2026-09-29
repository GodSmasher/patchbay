import type { ApiSpec, GeneratedFile, TestReport } from './types'

export const FIXTURES_PATH = 'src/fixtures.ts'

/**
 * The model writes the connector and most of its tests, so those tests share its
 * assumptions. The contract fixtures break that loop: patchbay writes them from the
 * documentation the research step extracted, overwrites them on every attempt, and the
 * test suite must run the connector against them unchanged.
 *
 * Documented URLs are often templates (`https://usX.api.mailchimp.com/3.0/lists/{list_id}`),
 * so the file ships its own matcher and a ready-made fake fetch instead of asking the model
 * to compare URLs.
 */
export function renderFixtures(spec: ApiSpec): GeneratedFile {
  const endpoints = spec.target.map((target) => ({
    method: target.method.toUpperCase(),
    url: target.url,
    response: target.responseExample ?? {},
  }))
  const docs = [spec.source.docsUrl, ...spec.target.map((t) => t.docsUrl)].filter(Boolean)
  const content = `// Written by patchbay from the API documentation. Regenerated on every attempt, do not edit.
${[...new Set(docs)].map((url) => `// Source: ${url}`).join('\n')}

/** Example payload of the source event, as documented. */
export const SOURCE_EXAMPLE = ${JSON.stringify(spec.source.example ?? {}, null, 2)}

export interface DocumentedEndpoint {
  method: string
  /** As documented; may contain placeholders such as {id}, :id, <id> or a region host like usX. */
  url: string
  response: unknown
}

/** Target endpoints the connector may call, in the documented order, with their documented responses. */
export const TARGET_ENDPOINTS: DocumentedEndpoint[] = ${JSON.stringify(endpoints, null, 2)}

export interface RecordedCall {
  method: string
  url: string
  body: unknown
  headers: Headers
}

/** The documented endpoint a request matches, placeholders and region subdomains included. */
export function findEndpoint(method: string, url: string): DocumentedEndpoint | undefined {
  return TARGET_ENDPOINTS.find((endpoint) => endpoint.method === method.toUpperCase() && urlMatches(endpoint.url, url))
}

/**
 * A fake fetch that answers every documented endpoint with its documented response and
 * rejects anything else. Use it in the contract test:
 *
 *   const { fetch, calls } = contractFetch()
 *   await handle(SOURCE_EXAMPLE as MyInput, { ...config, fetch })
 *   expect(calls.length).toBeGreaterThan(0)
 */
export function contractFetch(): { fetch: typeof fetch; calls: RecordedCall[] } {
  return fakeFetch((url, init) => {
    const method = (init.method ?? 'GET').toUpperCase()
    const endpoint = findEndpoint(method, url)
    if (!endpoint) throw new Error(\`contract: \${method} \${url} is not a documented endpoint\`)
    return jsonResponse(endpoint.response)
  })
}

/**
 * A correctly typed fake fetch for every other test. The handler gets the URL as a string
 * and the RequestInit; calls are recorded with the parsed JSON body.
 *
 *   const { fetch, calls } = fakeFetch(() => jsonResponse({ id: 1 }, 201))
 */
export function fakeFetch(
  handler: (url: string, init: RequestInit) => Response | Promise<Response>,
): { fetch: typeof fetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  const fake = async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input)
    const method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    calls.push({ method, url, body: parseBody(init.body), headers: new Headers(init.headers) })
    return handler(url, { ...init, method })
  }
  return { fetch: fake as typeof fetch, calls }
}

/** A JSON Response, e.g. jsonResponse({ ok: true }) or jsonResponse({ error: 'nope' }, 400). */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function parseBody(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function urlMatches(template: string, actual: string): boolean {
  const t = splitUrl(template)
  const a = splitUrl(actual)
  if (!t || !a) return false
  const tHost = t.host.split('.')
  const aHost = a.host.split('.')
  if (tHost.slice(-2).join('.') !== aHost.slice(-2).join('.')) return false
  const tPath = t.path.replace(/\\/+$/, '').split('/')
  const aPath = a.path.replace(/\\/+$/, '').split('/')
  if (tPath.length !== aPath.length) return false
  return tPath.every((segment, i) => isPlaceholder(segment) || segment === aPath[i])
}

function splitUrl(url: string): { host: string; path: string } | null {
  const match = url.match(/^https?:\\/\\/([^/?#]+)([^?#]*)/i)
  return match ? { host: (match[1] ?? '').toLowerCase(), path: match[2] || '/' } : null
}

function isPlaceholder(segment: string): boolean {
  return /^\\{[^}]+\\}$|^:[A-Za-z_]\\w*$|^<[^>]+>$/.test(segment)
}
`
  return { path: FIXTURES_PATH, content }
}

export type ContractStatus = NonNullable<TestReport['contract']>

/** Static half of the contract check: the suite must actually use the fixtures. */
export function contractMissing(files: GeneratedFile[]): string | null {
  const tests = files.find((f) => f.path === 'src/connector.test.ts')?.content ?? ''
  if (!/from\s+['"]\.\/fixtures['"]/.test(tests)) {
    return 'src/connector.test.ts does not import SOURCE_EXAMPLE and contractFetch from ./fixtures'
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
  if (failed) return { ...report, contract: 'failed' }
  const ran = (report.passedNames ?? []).some((name) => /^contract\b/i.test(name))
  if (!ran) {
    return {
      ...report,
      contract: 'failed',
      failed: report.failed + 1,
      total: report.total + 1,
      failures: [
        ...report.failures,
        { name: 'contract (did not run)', message: 'The contract test never passed; the test file probably failed to load.' },
      ],
    }
  }
  return { ...report, contract: 'passed' }
}

/** Keeps the model's files and puts the authoritative fixtures next to them. */
export function withFixtures(files: GeneratedFile[], fixtures: GeneratedFile): GeneratedFile[] {
  return [...files.filter((f) => f.path !== FIXTURES_PATH), fixtures]
}

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ApiSpec, GeneratedFile, Lang, TestReport } from './types'

export const FIXTURES_PATH = 'src/fixtures.ts'
export const FIXTURES_PATH_PY = 'fixtures.py'

/**
 * Python fixtures runtime. Lives as a real .py file beside the module (so Python
 * tooling, linters, and reviewers see Python code, not a 150-line template literal
 * inside a .ts file), and gets read once at module load. renderFixturesPy
 * substitutes two markers — SOURCE_EXAMPLE and TARGET_ENDPOINTS — and prepends
 * documentation URLs as comments. Everything else is static.
 *
 * The file ships both at src/ (for dev / vitest / typecheck) and at dist/ (copied
 * by tsup's onSuccess hook), so both the source tree and the bundled package work.
 */
const PY_TEMPLATE_PATH = resolvePyTemplatePath()
const PY_TEMPLATE = readFileSync(PY_TEMPLATE_PATH, 'utf8')

function resolvePyTemplatePath(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  // In source mode (vitest), the template sits next to this .ts file.
  // In published mode (dist/), tsup copies it next to the bundled .js file.
  // Both resolve by looking in __dirname first.
  return join(here, 'fixtures-py.template.py')
}

export function fixturesPathFor(lang: Lang): string {
  return lang === 'py' ? FIXTURES_PATH_PY : FIXTURES_PATH
}

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
  /** The request body exactly as sent (usually a JSON string). */
  body: string | undefined
  /** The body parsed as JSON, or undefined when it is not JSON. */
  json: unknown
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
  return fakeFetch((request) => {
    const endpoint = findEndpoint(request.method, request.url)
    if (!endpoint) throw new Error(\`contract: \${request.method} \${request.url} is not a documented endpoint\`)
    return jsonResponse(endpoint.response)
  })
}

/**
 * A correctly typed fake fetch for every other test. The handler receives the recorded
 * request: { method, url, body (string as sent), json (parsed body), headers (Headers) }.
 *
 *   const { fetch, calls } = fakeFetch((req) => req.url.endsWith('/deals') ? jsonResponse({ id: 1 }, 201) : jsonResponse({}, 404))
 */
export function fakeFetch(
  handler: (request: RecordedCall) => Response | Promise<Response>,
): { fetch: typeof fetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  const fake = async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input)
    const method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const body = typeof init.body === 'string' ? init.body : init.body == null ? undefined : String(init.body)
    const call: RecordedCall = { method, url, body, json: parseJson(body), headers: new Headers(init.headers) }
    calls.push(call)
    return handler(call)
  }
  return { fetch: fake as typeof fetch, calls }
}

const STATUS_TEXT: Record<number, string> = {
  200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict',
  422: 'Unprocessable Entity', 429: 'Too Many Requests',
  500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
}

/** A JSON Response with the standard status text, e.g. jsonResponse({ error: 'nope' }, 401) -> "401 Unauthorized". */
export function jsonResponse(body: unknown, status = 200): Response {
  const init = { status, statusText: STATUS_TEXT[status] ?? '', headers: { 'Content-Type': 'application/json' } }
  return new Response(status === 204 ? null : JSON.stringify(body), init)
}

function parseJson(raw: string | undefined): unknown {
  if (raw === undefined) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
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
  // Vitest's fullName joins every surrounding describe title with a space, so a nested
  // describe('contract', ...) inside describe('connector', ...) shows up as
  // "connector contract handles the documented example payload". A word-boundary match
  // catches that as well as top-level contract blocks.
  const failed = report.failures.some((f) => /\bcontract\b/i.test(f.name))
  if (failed) return { ...report, contract: 'failed' }
  const ran = (report.passedNames ?? []).some((name) => /\bcontract\b/i.test(name))
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
  return [...files.filter((f) => f.path !== fixtures.path), fixtures]
}

/**
 * Python counterpart of renderFixtures. Same contract: patchbay writes fixtures.py from
 * the researched API spec, the model writes a connector + test file that imports from it,
 * and the test suite must run a contract test (name starts with `test_contract`) that
 * passes SOURCE_EXAMPLE through handle() with contract_fetch injected.
 *
 * The runtime (FakeResponse / fake_fetch / contract_fetch / URL matcher) lives in
 * fixtures-py.template.py as real Python; we only inject the spec-specific pieces
 * (SOURCE_EXAMPLE, TARGET_ENDPOINTS, documentation URLs) via marker substitution.
 */
export function renderFixturesPy(spec: ApiSpec): GeneratedFile {
  const endpoints = spec.target.map((target) => ({
    method: target.method.toUpperCase(),
    url: target.url,
    response: target.responseExample ?? {},
  }))
  const docs = [...new Set([spec.source.docsUrl, ...spec.target.map((t) => t.docsUrl)].filter(Boolean))]
  // The template line is `# {{PATCHBAY_DOCS_HEADER}}` so we substitute the TEXT only.
  // Multi-line docs join with newline + `# ` so each line stays a comment.
  const docsHeader = docs.length ? docs.map((url) => `Source: ${url}`).join('\n# ') : 'generated from the research step'
  const content = PY_TEMPLATE
    .replace('{{PATCHBAY_DOCS_HEADER}}', docsHeader)
    .replace('{{PATCHBAY_SOURCE_EXAMPLE}}', pythonRepr(spec.source.example ?? {}, 0))
    .replace('{{PATCHBAY_TARGET_ENDPOINTS}}', pythonRepr(endpoints, 0))
  return { path: FIXTURES_PATH_PY, content }
}

/**
 * Convert a JSON-safe value to its Python literal form. The spec examples come from the LLM
 * as JSON, so the only type-mismatch between JS and Python is: true/false/null → True/False/None.
 * Everything else is a 1:1 lift. Strings keep their JSON escapes, which Python also understands.
 */
function pythonRepr(value: unknown, indent: number): string {
  const pad = (n: number) => '  '.repeat(n)
  if (value === null || value === undefined) return 'None'
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'None'
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value.map((v) => `${pad(indent + 1)}${pythonRepr(v, indent + 1)}`).join(',\n')
    return `[\n${items},\n${pad(indent)}]`
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return '{}'
    const items = entries
      .map(([k, v]) => `${pad(indent + 1)}${JSON.stringify(k)}: ${pythonRepr(v, indent + 1)}`)
      .join(',\n')
    return `{\n${items},\n${pad(indent)}}`
  }
  return 'None'
}

/** Static half of the Python contract check: the suite must actually use fixtures.py. */
export function contractMissingPy(files: GeneratedFile[]): string | null {
  const tests = files.find((f) => f.path === 'test_connector.py')?.content ?? ''
  if (!/from\s+fixtures\s+import/.test(tests) && !/import\s+fixtures/.test(tests)) {
    return 'test_connector.py does not import from fixtures'
  }
  if (!/\bdef\s+test_contract/.test(tests)) {
    return 'test_connector.py has no test_contract* function running handle on SOURCE_EXAMPLE'
  }
  if (!tests.includes('SOURCE_EXAMPLE')) {
    return 'the contract tests never pass SOURCE_EXAMPLE to handle'
  }
  return null
}

/** Dispatch: pick the right static contract check for the connector's language. */
export function contractMissingFor(lang: Lang, files: GeneratedFile[]): string | null {
  return lang === 'py' ? contractMissingPy(files) : contractMissing(files)
}

/** Dispatch: render fixtures for the connector's language. */
export function renderFixturesFor(lang: Lang, spec: ApiSpec): GeneratedFile {
  return lang === 'py' ? renderFixturesPy(spec) : renderFixtures(spec)
}

/** Language-aware fold of the static check + contract test results into the report. */
export function withContractFor(lang: Lang, report: TestReport, files: GeneratedFile[]): TestReport {
  const missing = contractMissingFor(lang, files)
  if (missing) {
    return {
      ...report,
      contract: 'missing',
      failed: report.failed + 1,
      total: report.total + 1,
      failures: [...report.failures, { name: 'contract (static check)', message: missing }],
    }
  }
  const failed = report.failures.some((f) => /\bcontract\b/i.test(f.name) || /test_contract/.test(f.name))
  if (failed) return { ...report, contract: 'failed' }
  const ran = (report.passedNames ?? []).some((name) => /\bcontract\b/i.test(name) || /test_contract/.test(name))
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

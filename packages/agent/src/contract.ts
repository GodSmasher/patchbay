import type { ApiSpec, GeneratedFile, Lang, TestReport } from './types'

export const FIXTURES_PATH = 'src/fixtures.ts'
export const FIXTURES_PATH_PY = 'fixtures.py'

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
 * The URL matcher is a Python port of the TS one — placeholders ({id}, :id, <id>) and
 * region subdomains both match the documented endpoint.
 */
export function renderFixturesPy(spec: ApiSpec): GeneratedFile {
  const endpoints = spec.target.map((target) => ({
    method: target.method.toUpperCase(),
    url: target.url,
    response: target.responseExample ?? {},
  }))
  const docs = [spec.source.docsUrl, ...spec.target.map((t) => t.docsUrl)].filter(Boolean)
  const sourceExample = pythonRepr(spec.source.example ?? {}, 0)
  const targetEndpoints = pythonRepr(endpoints, 0)
  const content = `# Written by patchbay from the API documentation. Regenerated on every attempt, do not edit.
${[...new Set(docs)].map((url) => `# Source: ${url}`).join('\n')}

"""Contract fixtures for the connector under test.

Exports:
  SOURCE_EXAMPLE   dict  — documented event payload
  TARGET_ENDPOINTS list  — endpoints the connector may call, in documented order
  contract_fetch()       — fake async transport answering documented endpoints, raising otherwise
  fake_fetch(handler)    — fake async transport driven by a user handler
  json_response(body, status=200, headers=None)
"""
from __future__ import annotations

import json as _json
import re as _re
from typing import Any, Awaitable, Callable, TypedDict

#: Example payload of the source event, as documented.
SOURCE_EXAMPLE: dict[str, Any] = ${sourceExample}


class DocumentedEndpoint(TypedDict):
    method: str
    url: str
    response: Any


#: Target endpoints the connector may call, in the documented order, with documented responses.
TARGET_ENDPOINTS: list[DocumentedEndpoint] = ${targetEndpoints}


class RecordedCall(TypedDict):
    method: str
    url: str
    body: Any
    json: Any
    headers: dict[str, str]


class FakeResponse:
    """Minimal response object: status_code, headers (dict), text, json(), raise_for_status()."""

    def __init__(self, body: Any, status: int = 200, headers: dict[str, str] | None = None) -> None:
        self.status_code = status
        self.status = status  # alias
        self.headers = dict(headers or {})
        if status == 204:
            self._raw = b''
        elif isinstance(body, (bytes, bytearray)):
            self._raw = bytes(body)
        elif isinstance(body, str):
            self._raw = body.encode('utf-8')
        else:
            self._raw = _json.dumps(body).encode('utf-8')
            self.headers.setdefault('Content-Type', 'application/json')

    @property
    def content(self) -> bytes:
        return self._raw

    @property
    def text(self) -> str:
        return self._raw.decode('utf-8', errors='replace')

    def json(self) -> Any:
        return _json.loads(self._raw.decode('utf-8')) if self._raw else None

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise Exception(f"HTTP {self.status_code}")


FetchHandler = Callable[[RecordedCall], FakeResponse | Awaitable[FakeResponse]]


def _parse_json(raw: Any) -> Any:
    if raw is None:
        return None
    # dict / list already parsed — most connectors pass body=<dict>, not body=json.dumps(dict)
    if isinstance(raw, (dict, list)):
        return raw
    if isinstance(raw, (bytes, bytearray)):
        try:
            return _json.loads(raw.decode('utf-8'))
        except Exception:
            return None
    if isinstance(raw, str):
        try:
            return _json.loads(raw)
        except Exception:
            return None
    return None


_URL = _re.compile(r'^https?://([^/?#]+)([^?#]*)', _re.IGNORECASE)
_PLACEHOLDER = _re.compile(r'^\\{[^}]+\\}$|^:[A-Za-z_]\\w*$|^<[^>]+>$')


def _split_url(url: str) -> tuple[str, str] | None:
    m = _URL.match(url)
    if not m:
        return None
    host = m.group(1).lower()
    path = m.group(2) or '/'
    return host, path


def _url_matches(template: str, actual: str) -> bool:
    t, a = _split_url(template), _split_url(actual)
    if not t or not a:
        return False
    t_host, t_path = t
    a_host, a_path = a
    if '.'.join(t_host.split('.')[-2:]) != '.'.join(a_host.split('.')[-2:]):
        return False
    t_segs = t_path.rstrip('/').split('/')
    a_segs = a_path.rstrip('/').split('/')
    if len(t_segs) != len(a_segs):
        return False
    for ts, as_ in zip(t_segs, a_segs):
        if _PLACEHOLDER.match(ts):
            continue
        if ts != as_:
            return False
    return True


def find_endpoint(method: str, url: str) -> DocumentedEndpoint | None:
    for ep in TARGET_ENDPOINTS:
        if ep['method'] == method.upper() and _url_matches(ep['url'], url):
            return ep
    return None


def fake_fetch(handler: FetchHandler) -> tuple[Callable[..., Awaitable[FakeResponse]], list[RecordedCall]]:
    """A correctly-typed fake async fetch for every non-contract test.

    The handler receives the recorded request dict: method, url, body, json, headers.
    It may return a FakeResponse directly or an awaitable.
    """
    calls: list[RecordedCall] = []

    async def fetch(url: str, method: str = 'GET', body: Any = None, headers: dict[str, str] | None = None, **_: Any) -> FakeResponse:
        call: RecordedCall = {
            'method': method.upper(),
            'url': url,
            'body': body,
            'json': _parse_json(body),
            'headers': dict(headers or {}),
        }
        calls.append(call)
        result = handler(call)
        if hasattr(result, '__await__'):
            return await result  # type: ignore[return-value]
        return result  # type: ignore[return-value]

    return fetch, calls


def contract_fetch() -> tuple[Callable[..., Awaitable[FakeResponse]], list[RecordedCall]]:
    """Fake async fetch that answers every documented endpoint with its documented response
    and raises on anything else. Use it in the contract test:

        fetch, calls = contract_fetch()
        await handle(SOURCE_EXAMPLE, { 'fetch': fetch, ... })
        assert len(calls) > 0
    """

    def _handler(req: RecordedCall) -> FakeResponse:
        ep = find_endpoint(req['method'], req['url'])
        if not ep:
            raise AssertionError(f"contract: {req['method']} {req['url']} is not a documented endpoint")
        return json_response(ep['response'])

    return fake_fetch(_handler)


_STATUS_TEXT: dict[int, str] = {
    200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict',
    422: 'Unprocessable Entity', 429: 'Too Many Requests',
    500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
}


def json_response(body: Any, status: int = 200, headers: dict[str, str] | None = None) -> FakeResponse:
    """A JSON FakeResponse with the standard status text and content-type.

    Extra response headers (Retry-After for 429 tests, Location for redirects, etc.) can be passed via
    the headers= kwarg and are merged on top of the content-type header.
    """
    merged: dict[str, str] = {'Content-Type': 'application/json'}
    if headers:
        merged.update(headers)
    return FakeResponse(body, status, headers=merged)
`
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

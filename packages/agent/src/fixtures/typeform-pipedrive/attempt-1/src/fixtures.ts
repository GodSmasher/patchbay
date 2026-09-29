// Written by patchbay from the API documentation. Regenerated on every attempt, do not edit.
// Source: https://www.typeform.com/developers/webhooks/example-payload/
// Source: https://developers.pipedrive.com/docs/api/v1/Organizations
// Source: https://developers.pipedrive.com/docs/api/v1/Persons
// Source: https://developers.pipedrive.com/docs/api/v1/Deals

/** Example payload of the source event, as documented. */
export const SOURCE_EXAMPLE = {
  "event_id": "01H...",
  "event_type": "form_response",
  "form_response": {
    "form_id": "lT4Z3j",
    "token": "a3a12ec67a1365927098a606107fac15",
    "submitted_at": "2026-10-01T09:00:00Z",
    "answers": [
      {
        "type": "text",
        "field": {
          "id": "f1",
          "ref": "lead_name",
          "type": "short_text"
        },
        "text": "Ada Lovelace"
      },
      {
        "type": "email",
        "field": {
          "id": "f2",
          "ref": "lead_email",
          "type": "email"
        },
        "email": "ada@example.com"
      }
    ]
  }
}

export interface DocumentedEndpoint {
  method: string
  /** As documented; may contain placeholders such as {id}, :id, <id> or a region host like usX. */
  url: string
  response: unknown
}

/** Target endpoints the connector may call, in the documented order, with their documented responses. */
export const TARGET_ENDPOINTS: DocumentedEndpoint[] = [
  {
    "method": "POST",
    "url": "https://api.pipedrive.com/v1/organizations",
    "response": {
      "success": true,
      "data": {
        "id": 11
      }
    }
  },
  {
    "method": "POST",
    "url": "https://api.pipedrive.com/v1/persons",
    "response": {
      "success": true,
      "data": {
        "id": 22
      }
    }
  },
  {
    "method": "POST",
    "url": "https://api.pipedrive.com/v1/deals",
    "response": {
      "success": true,
      "data": {
        "id": 33
      }
    }
  }
]

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
    if (!endpoint) throw new Error(`contract: ${request.method} ${request.url} is not a documented endpoint`)
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
  const tPath = t.path.replace(/\/+$/, '').split('/')
  const aPath = a.path.replace(/\/+$/, '').split('/')
  if (tPath.length !== aPath.length) return false
  return tPath.every((segment, i) => isPlaceholder(segment) || segment === aPath[i])
}

function splitUrl(url: string): { host: string; path: string } | null {
  const match = url.match(/^https?:\/\/([^/?#]+)([^?#]*)/i)
  return match ? { host: (match[1] ?? '').toLowerCase(), path: match[2] || '/' } : null
}

function isPlaceholder(segment: string): boolean {
  return /^\{[^}]+\}$|^:[A-Za-z_]\w*$|^<[^>]+>$/.test(segment)
}

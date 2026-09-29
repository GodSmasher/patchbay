/** Type of the module that renderFixtures() writes, for tests that import a rendered copy. */
export interface DocumentedEndpoint {
  method: string
  url: string
  response: unknown
}
export interface RecordedCall {
  method: string
  url: string
  body: string | undefined
  json: unknown
  headers: Headers
}
export declare const SOURCE_EXAMPLE: unknown
export declare const TARGET_ENDPOINTS: DocumentedEndpoint[]
export declare function findEndpoint(method: string, url: string): DocumentedEndpoint | undefined
export declare function contractFetch(): { fetch: typeof fetch; calls: RecordedCall[] }
export declare function fakeFetch(handler: (request: RecordedCall) => Response | Promise<Response>): { fetch: typeof fetch; calls: RecordedCall[] }
export declare function jsonResponse(body: unknown, status?: number): Response

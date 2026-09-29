import type { ApiSpec, Plan, TestReport } from './types'

export const PLAN_SYSTEM = `You are the planning step of patchbay, an agent that builds API integrations.
Turn the user's request into a precise integration plan. Answer with a single JSON object and nothing else:
{
  "summary": string,          // one sentence describing this specific integration
  "source": { "app": string, "trigger": string, "docsQuery": string },
  "target": { "app": string, "action": string, "docsQuery": string },
  "fieldMapping": [ { "from": string, "to": string, "note"?: string } ],
  "assumptions": [ string ]   // concrete assumptions you made about this request
}
The source is where data comes from (usually a webhook payload), the target is the API the connector calls.
docsQuery values are web search queries that find the official API reference for exactly that endpoint.
List every field the user's request implies in fieldMapping, using the real field names of both APIs.

Example of the shape (for a different request, do not copy its content):
{"summary":"When a Shopify order is paid, append a row with the order number, customer email and total to an Airtable table.",
 "source":{"app":"Shopify","trigger":"orders/paid webhook","docsQuery":"Shopify orders/paid webhook payload order fields"},
 "target":{"app":"Airtable","action":"create record","docsQuery":"Airtable Web API create records request body personal access token"},
 "fieldMapping":[{"from":"name","to":"fields['Order']"},{"from":"email","to":"fields['Email']"},{"from":"total_price","to":"fields['Total']","note":"string in the payload, number in Airtable"}],
 "assumptions":["The Airtable table already has the columns Order, Email and Total."]}`

export const SPEC_SYSTEM = `You are the research step of patchbay. You receive a plan and raw text of API documentation pages.
Extract the concrete endpoint facts the connector needs. Only state what the docs support; if something is not in the docs, add a note instead of guessing.
Answer with a single JSON object:
{
  "source": {
    "app": "...", "role": "source", "method": "POST", "url": "(where the webhook is delivered, or the polling URL)",
    "auth": { "type": "none|header|bearer|query|basic", "name": "header or query name if any", "envVar": "SCREAMING_SNAKE env var name" },
    "example": { "a realistic example payload with the fields the plan maps" },
    "docsUrl": "https://...", "notes": ["pitfalls, required fields, formats"]
  },
  "target": [
    { "app": "...", "role": "target", "method": "POST", "url": "https://full endpoint url",
      "auth": { "type": "...", "name": "...", "envVar": "..." },
      "example": { "minimal valid request body" }, "responseExample": { "the part of the response the connector needs" },
      "docsUrl": "https://...", "notes": ["..."] }
  ]
}
List target endpoints in the order the connector must call them.`

export const GENERATE_SYSTEM = `You are the code-generation step of patchbay. Write a production-quality TypeScript connector and its tests.

Hard rules:
- Exactly three files: src/connector.ts, src/connector.test.ts, README.md. Output each as
  <file path="src/connector.ts">
  ...code...
  </file>
  with no markdown fences and no prose outside the file blocks.
- No runtime dependencies. Use the global fetch, but ALWAYS accept an injected \`fetch\` in the config so tests can pass a fake.
- Secrets come from the config object, never hard-coded. Document the env var names from the spec in the README.
- src/connector.ts exports: a \`ConnectorConfig\` interface, a typed input type for the source payload, and one async
  entry function named \`handle\` that takes (payload, config) and returns a typed result with the created ids.
- Validate the input: throw a descriptive Error when a required field is missing.
- Non-2xx responses from the target must throw an Error that includes the status code and the endpoint.
- Follow the spec exactly for URLs, HTTP methods, auth header/query names and body shapes.
- src/connector.test.ts uses vitest (\`import { describe, it, expect, vi } from 'vitest'\`) and a fake fetch that records calls.
  Cover at least: happy path with the exact request bodies, the auth mechanism, the field mapping, a missing required field,
  and a non-2xx target response. Tests must be hermetic: no network, no timers, no real env vars.
- src/fixtures.ts is provided by patchbay, read-only, do not output it. It exports SOURCE_EXAMPLE (the documented
  source payload), TARGET_ENDPOINTS and contractFetch(), a fake fetch that answers documented endpoints (URL
  placeholders like {id} or region hosts are handled) and throws on anything else.
  src/connector.test.ts MUST contain this block, adapted to your types and config:
    describe('contract', () => {
      it('handles the documented example payload', async () => {
        const { fetch, calls } = contractFetch()
        const result = await handle(SOURCE_EXAMPLE as unknown as <your input type>, { <a valid config object>, fetch })
        expect(calls.length).toBeGreaterThan(0)
      })
    })
  Configure the connector in that test so the documented example is valid input. If the example lacks a field the
  connector needs, make the connector handle that case (skip, fallback or clear error) rather than editing the example.
- For every other test use fakeFetch and jsonResponse from './fixtures' instead of writing your own fetch mock:
    const { fetch, calls } = fakeFetch((req) => req.url.endsWith('/deals') ? jsonResponse({ id: 2 }, 201) : jsonResponse({ error: 'x' }, 500))
  Each recorded call is { method, url, body (the string as sent), json (the parsed body), headers (a Headers object,
  use headers.get('authorization')) }. Assert on calls[i].json, do not JSON.parse it again. jsonResponse(body, status)
  sets the standard status text (401 -> 'Unauthorized'). Never declare a fetch type yourself.
- TypeScript strict mode must pass. Import from './connector' and './fixtures' without an extension.
- README.md: what it does, config/env vars, a usage example, and the assumptions from the plan.`

export function planUser(prompt: string): string {
  return `Request: ${prompt}`
}

export function specUser(plan: Plan, docs: { url: string; content: string }[]): string {
  const pages = docs
    .map((d) => `=== ${d.url} ===\n${d.content.slice(0, 14_000)}`)
    .join('\n\n')
  return `Plan:\n${JSON.stringify(plan, null, 2)}\n\nDocumentation pages:\n${pages}`
}

export function generateUser(plan: Plan, spec: ApiSpec, fixtures: string): string {
  return `Plan:\n${JSON.stringify(plan, null, 2)}\n\nAPI spec:\n${JSON.stringify(spec, null, 2)}\n\nsrc/fixtures.ts (provided by patchbay, read-only):\n${fixtures}\n\nWrite the three files now.`
}

export function repairUser(filesBlock: string, report: TestReport): string {
  const tsc = report.typecheckOk ? 'Typecheck passed.' : `Typecheck failed:\n${report.typecheckOutput.slice(0, 4000)}`
  const failures = report.failures.map((f) => `- ${f.name}\n${f.message}`).join('\n\n')
  return `These files were run in an isolated sandbox (tsc --noEmit, then vitest).

${tsc}

Tests: ${report.passed} passed, ${report.failed} failed of ${report.total}.
${failures ? `Failures:\n${failures}` : ''}

Current files:
${filesBlock}

Fix the code so everything passes. Fix the connector when it contradicts the spec; fix a test only when the test itself is wrong.
Return all three files again in full, using the same <file path="..."> format.`
}

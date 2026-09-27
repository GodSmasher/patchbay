import type { ApiSpec, Plan, TestReport } from './types'

export const PLAN_SYSTEM = `You are the planning step of patchbay, an agent that builds API integrations.
Turn the user's one-sentence request into a precise integration plan.
Answer with a single JSON object and nothing else, shaped exactly like:
{
  "summary": "one sentence",
  "source": { "app": "Typeform", "trigger": "new form response (webhook)", "docsQuery": "Typeform webhook form_response payload format" },
  "target": { "app": "Pipedrive", "action": "create person and deal", "docsQuery": "Pipedrive API v1 create person and create deal request body authentication" },
  "fieldMapping": [ { "from": "answer with field ref 'email'", "to": "person.email[0].value" } ],
  "assumptions": [ "short, testable assumptions you had to make" ]
}
The source is where data comes from (usually a webhook payload), the target is the API the connector calls.
docsQuery values are web search queries that will find the official API reference for exactly that endpoint.`

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
- TypeScript strict mode must pass. Import from './connector' without an extension.
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

export function generateUser(plan: Plan, spec: ApiSpec): string {
  return `Plan:\n${JSON.stringify(plan, null, 2)}\n\nAPI spec:\n${JSON.stringify(spec, null, 2)}\n\nWrite the three files now.`
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

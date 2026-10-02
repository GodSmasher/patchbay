export type StepId = 'plan' | 'research' | 'generate' | 'verify' | 'package'

export interface Plan {
  summary: string
  source: { app: string; trigger: string; docsQuery: string }
  target: { app: string; action: string; docsQuery: string }
  fieldMapping: { from: string; to: string; note?: string }[]
  assumptions: string[]
}

export interface AuthSpec {
  type: 'header' | 'bearer' | 'query' | 'basic' | 'none'
  /** Header or query parameter name, e.g. `x-api-token` or `api_token`. */
  name?: string
  /** Environment variable the generated connector reads the secret from. */
  envVar: string
}

export interface EndpointSpec {
  app: string
  role: 'source' | 'target'
  method: string
  url: string
  auth: AuthSpec
  /** Minimal but realistic example of the request body (target) or event payload (source). */
  example: unknown
  /** Example of what the endpoint returns, when the connector needs the response. */
  responseExample?: unknown
  docsUrl: string
  notes: string[]
}

export interface ApiSpec {
  source: EndpointSpec
  target: EndpointSpec[]
}

export interface Source {
  title: string
  url: string
  /** The page is on the vendor's own domain. */
  official?: boolean
}

export interface GeneratedFile {
  path: string
  content: string
}

export interface TestFailure {
  name: string
  message: string
}

export interface TestReport {
  typecheckOk: boolean
  typecheckOutput: string
  passed: number
  failed: number
  total: number
  failures: TestFailure[]
  durationMs: number
  /** Where the tests ran: a Nebius sandbox operation id, `local`, or `replay`. */
  ranOn: string
  /** Did the suite run the connector against the documented example payload, and did that pass? */
  contract?: 'passed' | 'failed' | 'missing'
  /** Full names of the tests that passed. */
  passedNames?: string[]
}

export interface Usage {
  model: string
  promptTokens: number
  completionTokens: number
  costUsd: number
}

export type RunEvent =
  | { type: 'mode'; mode: 'live' | 'replay' }
  | { type: 'step'; step: StepId; status: 'start' | 'done' | 'error'; detail?: string }
  | { type: 'log'; step: StepId; message: string }
  | { type: 'plan'; plan: Plan }
  | { type: 'sources'; sources: Source[] }
  | { type: 'spec'; spec: ApiSpec }
  | { type: 'files'; attempt: number; files: GeneratedFile[] }
  | { type: 'tests'; attempt: number; report: TestReport; branches?: Array<{ branch: number; passed: number; total: number; typecheckOk: boolean; green: boolean }> }
  | { type: 'usage'; usage: Usage[] }
  | { type: 'result'; ok: boolean; attempts: number; files: GeneratedFile[]; report: TestReport | null }
  | { type: 'error'; message: string }

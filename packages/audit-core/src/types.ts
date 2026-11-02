export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type Confidence = 'high' | 'medium' | 'low'

export type TargetKind = 'remote-url' | 'local-command' | 'directory' | 'patchbay-connector'

export interface RemoteProbe {
  url: string
  reachable: boolean
  usesTls: boolean
  initializeOk: boolean
  toolsListOk: boolean
  authRequired: boolean
  acceptedAuthHeader?: 'bearer' | 'api-key' | 'none'
  tools: Array<{ name: string; description?: string; scopes?: string[] }>
  oauthProtectedResource?: Record<string, unknown>
  oauthAuthServer?: Record<string, unknown>
  originValidation?: 'strict' | 'permissive' | 'unknown'
  rawErrors: string[]
}

export interface DirectoryProbe {
  root: string
  files: Array<{ path: string; snippet?: string }>
  secretHits: Array<{ path: string; line: number; pattern: string; match: string }>
  envVarsUsed: string[]
  hasRefreshTokenPath: boolean
  scopeManifest?: Record<string, string[]>
}

export interface TargetSnapshot {
  kind: TargetKind
  target: string
  remote?: RemoteProbe
  directory?: DirectoryProbe
  capturedAt: string
}

export interface Finding {
  id: string
  severity: Severity
  confidence: Confidence
  title: string
  evidence: string
  fix: string
  docsUrl: string
  autofixTemplate?: string
}

export interface Check {
  id: string
  severity: Severity
  title: string
  run: (snapshot: TargetSnapshot) => Finding[]
}

export interface AuditReport {
  target: string
  kind: TargetKind
  findings: Finding[]
  summary: Record<Severity, number>
  durationMs: number
  capturedAt: string
}

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type Confidence = 'high' | 'medium' | 'low'

export type TargetKind = 'remote-url' | 'local-command' | 'directory' | 'patchbay-connector'

export type Transport = 'streamable-http' | 'legacy-sse' | 'unknown'

export interface RemoteProbe {
  url: string
  reachable: boolean
  usesTls: boolean
  transport: Transport
  effectiveEndpoint?: string
  initializeOk: boolean
  toolsListOk: boolean
  authRequired: boolean
  acceptedAuthHeader?: 'bearer' | 'api-key' | 'none'
  tools: Array<ToolDescriptor>
  oauthProtectedResource?: Record<string, unknown>
  oauthAuthServer?: Record<string, unknown>
  originValidation?: 'strict' | 'permissive' | 'unknown'
  redirectLocalhostInconsistent?: boolean
  publicByDesign?: boolean
  publicByDesignEvidence?: string
  aiCatalog?: Record<string, unknown>
  manifestDelta?: ManifestDelta
  rawErrors: string[]
}

export interface ToolDescriptor {
  name: string
  description?: string
  scopes?: string[]
  inputSchema?: Record<string, unknown>
}

/**
 * Pinned manifest stored on disk per server (hash + tool set), so we can
 * detect supply-chain-style updates between runs: new tools, description
 * changes, inputSchema changes.
 */
export interface ManifestEntry {
  serverId: string
  pinnedHash: string
  tools: ToolDescriptor[]
  firstSeen: string
  lastSeen: string
}

export type ManifestDeltaKind =
  | 'tool-added'
  | 'tool-removed'
  | 'description-changed'
  | 'input-schema-changed'

export interface ManifestDeltaItem {
  kind: ManifestDeltaKind
  toolName: string
  detail?: string
}

export interface ManifestDelta {
  serverId: string
  pinnedHash: string
  currentHash: string
  changes: ManifestDeltaItem[]
  firstSeen: string
}

export interface DirectoryProbe {
  root: string
  files: Array<{ path: string; snippet?: string }>
  secretHits: Array<{ path: string; line: number; pattern: string; match: string }>
  envVarsUsed: string[]
  secretEnvVarsUsed: string[]
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
  snapshot: TargetSnapshot
}

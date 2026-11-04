export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type Confidence = 'high' | 'medium' | 'low'

export type TargetKind = 'remote-url' | 'stdio-command' | 'local-command' | 'directory' | 'patchbay-connector'

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
  audienceProbe?: AudienceProbeResult
  rawErrors: string[]
}

/**
 * Result of the AUDIENCE-001 cross-audience token probe. When the user
 * supplies a bearer token minted for a DIFFERENT resource on the same
 * authorisation server, we send tools/list with it and record how the
 * server responded.
 *
 *   accepted:  server returned 2xx with a valid tools/list response.
 *              Means the server does NOT validate the `aud` claim, so
 *              any sibling resource at the same AS can replay tokens.
 *              AUDIENCE-001 critical.
 *   rejected:  server returned 401 or 403. Correct behaviour per
 *              RFC 8707. No finding.
 *   inconclusive: network error or non-2xx-non-401/403. We can't tell.
 *              AUDIENCE-001 info.
 */
export interface AudienceProbeResult {
  attempted: boolean
  outcome: 'accepted' | 'rejected' | 'inconclusive'
  httpStatus?: number
  reason?: string
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
  stdio?: StdioProbe
  capturedAt: string
}

/**
 * Snapshot of an MCP server reached over stdio (child-process) transport.
 *
 * This is what Claude Desktop and most local MCP clients use. There is
 * no HTTP endpoint, so OAuth-related checks (AUTH-*, AUDIENCE-001, SCOPE-*)
 * do not apply. What stdio DOES give us is a tool list, which lets
 * MANIFEST-001 catch supply-chain-style updates (new write tool, changed
 * description, inputSchema permission escalation) between runs.
 */
export interface StdioProbe {
  /** Raw command string the user passed in (e.g. "npx -y @foo/mcp /tmp"). */
  command: string
  /** Parsed binary path and args. */
  binary: string
  args: string[]
  /** Did the child process spawn without an immediate exec failure? */
  spawned: boolean
  /** Did initialize round-trip successfully? */
  initializeOk: boolean
  /** Did tools/list round-trip successfully? */
  toolsListOk: boolean
  tools: ToolDescriptor[]
  /** Final exit code of the child, if it had already exited when we checked. */
  exitCode?: number
  /** First N characters of stderr, useful for diagnosing silent failures. */
  stderrSnippet?: string
  manifestDelta?: ManifestDelta
  rawErrors: string[]
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

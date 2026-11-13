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
  /**
   * Resources advertised by the server via resources/list, and the
   * contents of the first few fetched via resources/read. Powers
   * POISONING-002 content-level scanning. Only populated when the
   * crawler is in non-metadata-only mode (resources/read returns
   * actual data that we should not pull from third-party servers
   * without authorisation).
   */
  resources?: Array<ResourceDescriptor>
  /**
   * Prompts advertised via prompts/list and the materialised argument
   * descriptions + example messages from prompts/get. Second half of
   * the POISONING-002 surface.
   */
  prompts?: Array<PromptDescriptor>
  oauthProtectedResource?: Record<string, unknown>
  oauthAuthServer?: Record<string, unknown>
  originValidation?: 'strict' | 'permissive' | 'unknown'
  redirectLocalhostInconsistent?: boolean
  /**
   * Response headers captured from the first reachable probe response
   * (initialize or the auth-required 401). Keys are lowercased. Used by
   * HEADERS-001 to evaluate CORS, HSTS, X-Frame-Options, Content-Type
   * sniffing posture without making any additional request.
   */
  responseHeaders?: Record<string, string>
  /**
   * HTTP status returned when we posted tools/list with a dummy bearer
   * ("patchbay-probe-token"). Populated only when authRequired is true
   * AND the dummy bearer was NOT accepted (rejection path). Used by
   * AUTH-007 to verify the server returns 401 per MCP 2026-07-28.
   */
  invalidTokenStatus?: number
  /**
   * WWW-Authenticate header on the rejection response above. Populated
   * only when invalidTokenStatus is set. AUTH-007 uses it to check that
   * the server advertises how to authenticate.
   */
  invalidTokenWwwAuthenticate?: string
  dcrLoopback?: DcrLoopbackResult
  publicByDesign?: boolean
  publicByDesignEvidence?: string
  aiCatalog?: Record<string, unknown>
  manifestDelta?: ManifestDelta
  audienceProbe?: AudienceProbeResult
  missingAudProbe?: MissingAudProbeResult
  headlessOauth?: HeadlessOauthResult
  rawErrors: string[]
}

/**
 * Result of the headless OAuth probe battery. Opt-in via
 * `probeHeadlessOauth: true`. Registers a throw-away client via DCR,
 * then sends four authorization requests crafted to violate OAuth 2.1
 * requirements and records whether the server rejected each one.
 *
 * Powers PKCE-001, PKCE-002, IMPLICIT-001, REDIRECT-002.
 *
 * ProbeOutcome:
 *   skipped:      probe not attempted (no authorization_endpoint, DCR
 *                 failed, or caller did not opt in).
 *   rejected:     server redirected with ?error= / #error= (good).
 *   accepted:     server issued an authorization code despite the
 *                 OAuth 2.1 violation (BAD — the finding fires).
 *   inconclusive: server returned a consent page or unexpected status,
 *                 so we cannot tell what would happen on user approval.
 */
export interface HeadlessOauthResult {
  attempted: boolean
  authorizationEndpoint?: string
  dcrClientId?: string
  dcrOutcome: 'no-endpoint' | 'rejected' | 'network-error' | 'ok' | 'skipped'
  dcrReason?: string
  pkceMissing?: HeadlessProbeOutcome
  pkcePlain?: HeadlessProbeOutcome
  implicit?: HeadlessProbeOutcome
  redirectMismatch?: HeadlessProbeOutcome
}

export interface HeadlessProbeOutcome {
  outcome: 'skipped' | 'rejected' | 'accepted' | 'inconclusive'
  httpStatus?: number
  errorCode?: string
  reason?: string
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
/**
 * Result of the AUTH-006 Dynamic Client Registration loopback probe.
 * Registers a throw-away client with loopback redirect URIs
 * ("http://127.0.0.1:PORT/callback" and "http://localhost:PORT/callback")
 * to verify RFC 8252 Section 7.3 compliance — native/CLI MCP clients
 * can only complete an authorization code flow when the AS accepts
 * these redirect URIs with an arbitrary port.
 *
 *   accepted:    DCR returned 2xx, both loopback URIs registered.
 *                No finding.
 *   rejected:    DCR returned 400 "invalid_redirect_uri" (or similar).
 *                AUTH-006 high.
 *   inconclusive: non-2xx / non-400 (auth required, 5xx, network error).
 *                No finding; recorded for diagnostics.
 *   no-endpoint: authServer metadata has no registration_endpoint.
 *                No finding (AUTH-005 covers that).
 */
export interface DcrLoopbackResult {
  attempted: boolean
  outcome: 'accepted' | 'rejected' | 'inconclusive' | 'no-endpoint'
  httpStatus?: number
  reason?: string
}

export interface AudienceProbeResult {
  attempted: boolean
  outcome: 'accepted' | 'rejected' | 'inconclusive'
  httpStatus?: number
  reason?: string
}

/**
 * Result of the AUDIENCE-002 probe: tools/list is sent with a bearer
 * token whose JWT payload has NO `aud` claim at all. Catches servers
 * whose defensive validation is written as `if (aud && aud !== me) reject`
 * (missing aud makes the first condition false and skips the reject).
 * See Issue #5.
 */
export interface MissingAudProbeResult {
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
 * Resource advertised by the server. `uri`, `name` and `description` come
 * from resources/list; `contents` holds the text returned by a follow-up
 * resources/read when the crawler was allowed to fetch it. POISONING-002
 * scans all text fields for hidden Unicode and role-marker patterns.
 */
export interface ResourceDescriptor {
  uri: string
  name?: string
  description?: string
  mimeType?: string
  contents?: Array<{ uri?: string; mimeType?: string; text?: string }>
}

/**
 * Prompt template advertised by the server. `arguments[].description`
 * comes from prompts/list; `messages[].content.text` is the materialised
 * example from prompts/get. Both are read as instruction context by the
 * model when a client uses the prompt, so POISONING-002 scans them with
 * the same patterns it applies to tool descriptions.
 */
export interface PromptDescriptor {
  name: string
  description?: string
  arguments?: Array<{ name?: string; description?: string; required?: boolean }>
  messages?: Array<{ role?: string; content?: { type?: string; text?: string } }>
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
  // Fine-grained kinds emitted alongside 'input-schema-changed' for the same
  // tool (MANIFEST-001 keeps using the coarse kind, MANIFEST-002 reads the
  // fine-grained ones). `detail` carries the specifics named below.
  | 'param-added'           // detail: 'param: <name> (optional)' or 'param: <name> (required)'
  | 'param-removed'         // detail: 'param: <name>'
  | 'param-made-required'   // detail: 'param: <name>'
  | 'param-type-changed'    // detail: '<name>: <old-type> -> <new-type>'
  | 'param-enum-shrunk'     // detail: '<name>: removed [X, Y]'

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

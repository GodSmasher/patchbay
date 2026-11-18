import type { FindingVerification } from './types'

/**
 * Per-check metadata that fills in the audit-core 0.12.0 Finding Schema
 * v2 fields when a check does not set them inline. A check's run() can
 * still override any of these per-finding; this table is the default
 * consumers get when the check returns only the legacy (id, severity,
 * confidence, title, evidence, fix, docsUrl) shape.
 *
 * `affectedComponents` is a template, with {{target}} replaced at
 * enrichment time by the TargetSnapshot's `target` string. Checks that
 * already know a more specific component (a tool name, a file path, a
 * header) should set the Finding's `affectedComponents` directly.
 *
 * `reproductionSteps` is a short, concrete recipe a reader can follow
 * to see the same result. Multi-line by convention.
 *
 * `verification` follows the rule: deterministic static reads are
 * source-confirmed; active probes that observed server behaviour are
 * runtime-verified; pattern matches with context-dependent reliability
 * are potential-fp (and the check's own run() should promote them to
 * source-confirmed when the context holds).
 */
export interface CheckMetadata {
  verification: FindingVerification
  affectedComponents: string[]
  reproductionSteps: string
  remediation: string
}

/**
 * Default metadata for every check in ALL_CHECKS. If a new check is
 * added without a row here, the enrichment layer logs a warning and
 * falls back to a conservative generic default.
 */
export const CHECK_METADATA: Record<string, CheckMetadata> = {
  // ===== AUTH posture (RFC 9728 / RFC 8414 metadata reads) =====
  'AUTH-001': {
    verification: 'runtime-verified',
    affectedComponents: ['{{target}}/mcp', '{{target}}/.well-known/oauth-protected-resource'],
    reproductionSteps: 'POST {"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}} to the MCP endpoint without an Authorization header. If the server returns 200 with a tools array, this finding applies.',
    remediation: 'Require a valid bearer token on every MCP method call. Return 401 with a WWW-Authenticate header pointing at the PRM document (RFC 9728) on unauthenticated requests.',
  },
  'AUTH-002': {
    verification: 'source-confirmed',
    affectedComponents: ['{{target}}/.well-known/oauth-protected-resource'],
    reproductionSteps: 'GET {{target}}/.well-known/oauth-protected-resource. Check whether the document is served and whether `resource` matches the MCP endpoint.',
    remediation: 'Serve a RFC 9728 Protected Resource Metadata document whose `resource` equals the MCP endpoint and whose `authorization_servers` lists only trusted issuers.',
  },
  'AUTH-003': {
    verification: 'source-confirmed',
    affectedComponents: ['{{target}}/.well-known/oauth-authorization-server'],
    reproductionSteps: 'GET {{target}}/.well-known/oauth-authorization-server. Check `code_challenge_methods_supported`.',
    remediation: 'Add "S256" to `code_challenge_methods_supported` in the AS metadata. S256 is required by OAuth 2.1; plain is not acceptable alone.',
  },
  'AUTH-004': {
    verification: 'source-confirmed',
    affectedComponents: ['{{target}}'],
    reproductionSteps: 'Retired check — kept in index for schema stability. No reproduction.',
    remediation: 'No action; this check id is retired.',
  },
  'AUTH-005': {
    verification: 'source-confirmed',
    affectedComponents: ['{{target}}/.well-known/oauth-authorization-server'],
    reproductionSteps: 'GET the AS metadata. Check for presence of `registration_endpoint`.',
    remediation: 'Expose a Dynamic Client Registration endpoint (RFC 7591) so native MCP clients can self-register without an operator pre-provisioning them.',
  },
  'AUTH-006': {
    verification: 'runtime-verified',
    affectedComponents: ['{{target}}/register (DCR endpoint)'],
    reproductionSteps: 'POST a DCR request with `redirect_uris: ["http://127.0.0.1:PORT/callback", "http://localhost:PORT/callback"]`. If the AS rejects, native/CLI clients cannot complete the authorization code flow.',
    remediation: 'Accept loopback redirect URIs with arbitrary ports per RFC 8252 Section 7.3. These are a requirement, not an option.',
  },
  'AUTH-007': {
    verification: 'runtime-verified',
    affectedComponents: ['{{target}}/mcp'],
    reproductionSteps: 'POST tools/list with Authorization: Bearer patchbay-probe-token. Observe HTTP status and WWW-Authenticate header. Per MCP 2026-07-28 the server must return 401 with a WWW-Authenticate header pointing at the PRM.',
    remediation: 'Return 401 Unauthorized for invalid bearer tokens and include WWW-Authenticate: Bearer resource_metadata="{PRM URL}".',
  },

  // ===== AUDIENCE validation (RFC 8707) =====
  'AUDIENCE-001': {
    verification: 'runtime-verified',
    affectedComponents: ['{{target}}/mcp (token audience validation)'],
    reproductionSteps: 'Mint a token at the same AS but for a DIFFERENT resource. POST tools/list with it. If the server accepts, it is not checking the `aud` claim.',
    remediation: 'Reject bearer tokens whose `aud` claim does not match this MCP endpoint. Required by RFC 8707.',
  },
  'AUDIENCE-002': {
    verification: 'runtime-verified',
    affectedComponents: ['{{target}}/mcp (token audience validation)'],
    reproductionSteps: 'Mint a token with NO `aud` claim at all. POST tools/list. A naive `if (aud && aud !== me) reject` will let it through.',
    remediation: 'Reject tokens whose `aud` claim is missing entirely. Treat absence as mismatch, not as permission.',
  },

  // ===== SCOPE hygiene =====
  'SCOPE-001': {
    verification: 'source-confirmed',
    affectedComponents: ['{{target}} (tool list)'],
    reproductionSteps: 'Call tools/list. If every tool advertises the same scope, destructive tools share the gate with read-only ones.',
    remediation: 'Define per-capability scopes (read, write, admin, …) and assign each tool only the minimum. A write tool and a read tool should not share one scope.',
  },
  'SCOPE-002': {
    verification: 'source-confirmed',
    affectedComponents: ['{{target}} (tool list)'],
    reproductionSteps: 'Call tools/list. Look for a destructive tool (delete_, drop_, purge_, …) and a read-only tool (get_, list_, read_, …) sharing a scope.',
    remediation: 'Split destructive tools into their own scope so a read token cannot authorise destruction.',
  },

  // ===== SECRET exposure =====
  'SECRET-001': {
    verification: 'source-confirmed',
    affectedComponents: ['source files in the target directory'],
    reproductionSteps: 'Clone the repository, grep the matched path at the matched line. The scanner has been tightened in 0.11.1 to reject product URL slugs, test fixtures and placeholder env values.',
    remediation: 'Rotate the exposed credential immediately. Scrub it from git history with git filter-repo. Add the leaking file to .gitignore. Wire a pre-commit secret scanner (see scripts/precommit-secret-scan.sh in this repo).',
  },
  'SECRET-002': {
    verification: 'source-confirmed',
    affectedComponents: ['environment-variable usage in the target directory'],
    reproductionSteps: 'Grep the target directory for process.env.<name>. Any env var whose name looks like a secret (contains KEY, TOKEN, SECRET, …) that is used but not declared in .env.example signals a missing operator setup doc.',
    remediation: 'Add every secret-shaped env var to .env.example with a placeholder value and a brief comment so operators know what to provide.',
  },

  // ===== TRANSPORT posture =====
  'TRANSPORT-001': {
    verification: 'source-confirmed',
    affectedComponents: ['{{target}} (URL scheme)'],
    reproductionSteps: 'Inspect the URL scheme. http:// is not acceptable for production MCP endpoints.',
    remediation: 'Serve the MCP endpoint over https:// only. Redirect http:// to https:// at the load balancer or in the framework.',
  },
  'TRANSPORT-002': {
    verification: 'runtime-verified',
    affectedComponents: ['{{target}} (transport negotiation)'],
    reproductionSteps: 'Open an SSE connection. If the server responds with the legacy SSE transport rather than streamable-http, it is on a deprecated transport.',
    remediation: 'Migrate to the streamable-http transport introduced in the MCP 2026-07-28 spec revision. Legacy SSE support is removed in the following revision.',
  },

  // ===== REDIRECT posture =====
  'REDIRECT-001': {
    verification: 'source-confirmed',
    affectedComponents: ['{{target}} (redirect behaviour on auth bounce)'],
    reproductionSteps: 'Send a request that would trigger the OAuth bounce. Inspect the Location header for redirect URI reflection vulnerabilities.',
    remediation: 'Register all legitimate redirect URIs with the AS and reject any redirect_uri on /authorize that is not pre-registered.',
  },
  'REDIRECT-002': {
    verification: 'runtime-verified',
    affectedComponents: ['{{target}}/authorize (redirect URI validation)'],
    reproductionSteps: 'POST /authorize with a client_id registered via DCR and a redirect_uri the server has NOT seen before. If the AS issues a code, redirect validation is broken.',
    remediation: 'Validate redirect_uri against the DCR-registered set on every /authorize call. An unregistered redirect must get error=invalid_request, not a code.',
  },

  // ===== PKCE enforcement =====
  'PKCE-001': {
    verification: 'runtime-verified',
    affectedComponents: ['{{target}}/authorize (PKCE enforcement)'],
    reproductionSteps: 'POST /authorize with no code_challenge parameter. If the AS still returns a code, PKCE is advisory, not required.',
    remediation: 'Require code_challenge on every /authorize request. OAuth 2.1 makes PKCE mandatory, not optional.',
  },
  'PKCE-002': {
    verification: 'runtime-verified',
    affectedComponents: ['{{target}}/authorize (PKCE method)'],
    reproductionSteps: 'POST /authorize with code_challenge_method=plain. If the AS accepts, plain PKCE is still enabled.',
    remediation: 'Disable the "plain" PKCE method. Accept only S256 per OAuth 2.1.',
  },
  'IMPLICIT-001': {
    verification: 'runtime-verified',
    affectedComponents: ['{{target}}/authorize (grant type)'],
    reproductionSteps: 'POST /authorize with response_type=token. If the AS returns a token fragment, the implicit grant is still enabled.',
    remediation: 'Remove `token` from response_types_supported. OAuth 2.1 drops the implicit grant entirely.',
  },

  // ===== MANIFEST drift =====
  'MANIFEST-001': {
    verification: 'source-confirmed',
    affectedComponents: ['{{target}} (tool manifest)'],
    reproductionSteps: 'Compare the current tools/list with the manifest patchbay pinned on the previous run. Any change in tool set, description or schema shows up here.',
    remediation: 'Review the diff. If it is a legitimate server update, re-pin with --trust-current-manifest. If not, investigate — tool manifests are a supply-chain surface.',
  },
  'MANIFEST-002': {
    verification: 'source-confirmed',
    affectedComponents: ['{{target}} (tool inputSchema)'],
    reproductionSteps: 'Compare per-tool inputSchema against the pinned manifest. Looks for silently added parameters, newly required fields, type widenings, enum shrinks — the fine-grained drift MANIFEST-001 summarises.',
    remediation: 'Audit each schema diff. A silently added "path" or "command" parameter is a classic supply-chain injection vector.',
  },

  // ===== POISONING (hidden instructions in server-provided text) =====
  'POISONING-001': {
    verification: 'source-confirmed',
    affectedComponents: ['{{target}} (tool descriptions)'],
    reproductionSteps: 'Call tools/list and inspect each tool.description for zero-width characters (U+200B, U+200C, U+200D, U+FEFF), bidi overrides (U+202E, U+2066-2069) and role markers ("<SYSTEM>", "Ignore previous instructions", …).',
    remediation: 'Scrub tool descriptions of invisible Unicode. Never include imperative instructions targeted at the model — descriptions are read as context.',
  },
  'POISONING-002': {
    verification: 'source-confirmed',
    affectedComponents: ['{{target}} (resources, resource contents, prompts, prompt messages)'],
    reproductionSteps: 'Call resources/list, resources/read on each, prompts/list, prompts/get on each. Scan every text field for the same hidden-Unicode / role-marker patterns as POISONING-001.',
    remediation: 'Audit every resource body and prompt message that gets rendered into the model context. These are instruction-equivalent and must be treated as such.',
  },
  'POISONING-003': {
    verification: 'runtime-verified',
    affectedComponents: ['{{target}} (tool call responses)'],
    reproductionSteps: 'Opt-in with --probe-tool-calls. The scanner calls tools classified as safe (readOnlyHint, no required args) and scans the returned content[].text for the POISONING-001 patterns.',
    remediation: 'Sanitise tool outputs before returning them. A tool whose description is clean but whose body returns `<SYSTEM>...</SYSTEM>` is a classic late-binding injection.',
  },
  'ANNOTATIONS-001': {
    verification: 'source-confirmed',
    affectedComponents: ['{{target}} (tool annotations)'],
    reproductionSteps: 'Call tools/list. Look for a tool whose name contains a destructive verb (delete_, drop_, purge_) with annotations.destructiveHint set to false, or a write-sounding name with annotations.readOnlyHint set to true.',
    remediation: 'Align annotations with the actual tool behaviour. A destructive tool must set destructiveHint:true. Clients route confirmation prompts on these hints; lying bypasses them.',
  },
  'URITEMPLATE-001': {
    verification: 'source-confirmed',
    affectedComponents: ['{{target}} (resources/templates/list)'],
    reproductionSteps: 'Call resources/templates/list. Look for filesystem-shaped URI templates (file://, s3://, gs://, ftp, no-scheme) with {path*} unbounded explode or {name} in a path segment.',
    remediation: 'Replace {path*} with a constrained parameter whose value is validated against an allowlist. Never expand user input directly into a filesystem path.',
  },

  // ===== SPEC currency =====
  'SAMPLING-001': {
    verification: 'source-confirmed',
    affectedComponents: ['{{target}} (advertised capabilities)'],
    reproductionSteps: 'Call initialize. Inspect capabilities. If `sampling` is present, the server still negotiates a capability deprecated in MCP 2026-07-28.',
    remediation: 'Remove the `sampling` capability from the initialize response. The spec removal date is 2027-07-28.',
  },
  'DEPRECATED-001': {
    verification: 'source-confirmed',
    affectedComponents: ['{{target}} (advertised capabilities)'],
    reproductionSteps: 'Call initialize. If capabilities includes `logging` or `roots`, the server advertises capabilities deprecated in MCP 2026-07-28.',
    remediation: 'Remove `logging` and `roots` from the initialize response capabilities. Hygiene signal; no exploit path, but ages the server to pre-2026-07 revision.',
  },

  // ===== OAUTH posture =====
  'OAUTH-REVOCATION-001': {
    verification: 'source-confirmed',
    affectedComponents: ['{{target}}/.well-known/oauth-authorization-server'],
    reproductionSteps: 'GET the AS metadata. If `grant_types_supported` includes `refresh_token` but no `revocation_endpoint` is set, leaked refresh tokens cannot be rotated out.',
    remediation: 'Expose a revocation_endpoint per RFC 7009. Wire it to actually invalidate the token in your session store. Refresh tokens without revocation are an incident response dead end.',
  },

  // ===== SUPPLY CHAIN =====
  'SDK-CVE-001': {
    verification: 'source-confirmed',
    affectedComponents: ['{{target}} (server identification)'],
    reproductionSteps: 'Inspect the initialize serverInfo and response headers for SDK version strings. Cross-reference against the KNOWN_CVES table in audit-core.',
    remediation: 'Upgrade the SDK to a version outside the known-vulnerable range. See the referenced CVE for details.',
  },

  // ===== RESOURCE posture =====
  'RESOURCE-001': {
    verification: 'source-confirmed',
    affectedComponents: ['{{target}}/.well-known/oauth-protected-resource'],
    reproductionSteps: 'Read the PRM document. The `resource` value must equal the MCP endpoint URL. A mismatch misdirects clients to the wrong audience.',
    remediation: 'Set `resource` in the PRM to the exact MCP endpoint URL, matching what you expect in the `aud` claim of accepted bearer tokens.',
  },

  // ===== HEADER hygiene =====
  'HEADERS-001': {
    verification: 'runtime-verified',
    affectedComponents: ['{{target}} (response headers)'],
    reproductionSteps: 'Inspect the response headers on the first reachable request. Flags missing HSTS, X-Frame-Options, X-Content-Type-Options, overly permissive CORS, and credentialled wildcard origins.',
    remediation: 'Add HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, and a strict CORS origin list. Never pair access-control-allow-origin: * with access-control-allow-credentials: true.',
  },

  // ===== Agent-identity propagation =====
  'IDENTITY-001': {
    verification: 'source-confirmed',
    affectedComponents: ['{{target}}/.well-known/oauth-authorization-server'],
    reproductionSteps: 'GET {{target}}/.well-known/oauth-authorization-server. Inspect `grant_types_supported`. If the array does not include `urn:ietf:params:oauth:grant-type:token-exchange`, clients cannot discover OBO support; every agent-driven tools/call reaches the MCP server with only the agent\'s identity.',
    remediation: 'Add `urn:ietf:params:oauth:grant-type:token-exchange` to `grant_types_supported` and implement RFC 8693 at the token endpoint so an AI agent can exchange its own access token plus a user assertion for a token whose `sub` identifies the end user.',
  },

  // ===== ISS parameter =====
  'ISS-001': {
    verification: 'source-confirmed',
    affectedComponents: ['{{target}}/.well-known/oauth-authorization-server'],
    reproductionSteps: 'GET the AS metadata. Check `authorization_response_iss_parameter_supported`. If false or missing, clients cannot defend against mix-up attacks per RFC 9207.',
    remediation: 'Set authorization_response_iss_parameter_supported to true and include the `iss` parameter in authorization responses.',
  },

  // ===== META =====
  'PROBE-001': {
    verification: 'potential-fp',
    affectedComponents: ['{{target}}'],
    reproductionSteps: 'Inconclusive probe. Finding exists only to flag that the audit could not reach the server reliably (timeout, TLS failure, non-MCP response).',
    remediation: 'No remediation on the operator side. Re-run the audit from a network that can reach the host.',
  },
}

export function resolveCheckMetadata(checkId: string): CheckMetadata {
  const m = CHECK_METADATA[checkId]
  if (m) return m
  return {
    verification: 'source-confirmed',
    affectedComponents: ['{{target}}'],
    reproductionSteps: 'No reproduction steps registered for ' + checkId + ' yet. Add an entry to check-metadata.ts.',
    remediation: 'See docsUrl on the finding for remediation.',
  }
}

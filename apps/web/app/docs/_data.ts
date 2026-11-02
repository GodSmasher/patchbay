export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface DocEntry {
  id: string
  title: string
  severity: Severity
  oneLiner: string
  whatItMeans: string
  howToFix: string
  spec?: string
  specUrl?: string
}

export const DOCS: DocEntry[] = [
  {
    id: 'auth-001',
    title: 'No authentication required',
    severity: 'critical',
    oneLiner: 'Server returns tools/list without any credential, and at least one tool name looks mutating.',
    whatItMeans: `patchbay audit calls the server's tools/list endpoint without any Authorization or x-api-key header. If the server returns a tool list, no authentication is being enforced. The check is only critical when at least one tool name reads as mutating (create/delete/send/execute/start-...). A server that only exposes read-shaped tools (get/list/search/...) is downgraded to info level and labelled "public read-only server", which the MCP spec documents as a legitimate pattern for public data endpoints.`,
    howToFix: `Require OAuth 2.1 bearer tokens on initialize and tools/*. Serve /.well-known/oauth-protected-resource pointing to an authorization server, and reject unauthenticated calls with 401. If this server is intended to be public read-only, no action needed; the finding will downgrade automatically once no mutating tool names are present.`,
    spec: 'MCP 2025-03-26 §Security',
    specUrl: 'https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization',
  },
  {
    id: 'auth-002',
    title: 'Static credential accepted, no OAuth discovery',
    severity: 'critical',
    oneLiner: 'Server accepts bearer or API-key auth but serves no .well-known OAuth metadata.',
    whatItMeans: `The server accepts an Authorization: Bearer or x-api-key header (patchbay confirmed this with a probe token that returned 2xx), but neither /.well-known/oauth-protected-resource nor /.well-known/oauth-authorization-server is served. MCP clients that follow the spec cannot negotiate PKCE, scopes or resource indicators. They have to be configured out of band with a static credential.`,
    howToFix: `Replace static credentials with OAuth 2.1. Publish discovery metadata at the two well-known paths so clients can auto-configure. Support PKCE with S256, resource indicators (RFC 8707), and dynamic client registration (RFC 7591).`,
    spec: 'MCP 2025-03-26 §Authorization',
    specUrl: 'https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization',
  },
  {
    id: 'auth-003',
    title: 'PKCE S256 not advertised',
    severity: 'high',
    oneLiner: 'OAuth metadata exists but code_challenge_methods_supported does not include "S256".',
    whatItMeans: `OAuth 2.1 requires PKCE with S256 for all authorization code flows. The authorization server metadata at /.well-known/oauth-authorization-server either lacks the code_challenge_methods_supported field or lists only "plain". Clients cannot discover whether S256 is supported, so interoperable OAuth 2.1 flows cannot be established automatically. Confidence is medium: the server may enforce S256 at runtime without advertising it. This finding is about metadata completeness.`,
    howToFix: `Set "code_challenge_methods_supported": ["S256"] in your authorization server metadata response. Enforce S256 server-side on all authorization code requests; reject "plain" and absent code_challenge values.`,
    spec: 'RFC 9126 §5.2 (OAuth 2.1 PKCE)',
    specUrl: 'https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13',
  },
  {
    id: 'auth-004',
    title: 'Resource indicators not advertised (RFC 8707)',
    severity: 'medium',
    oneLiner: 'OAuth metadata does not advertise "resource_indicators_supported": true.',
    whatItMeans: `RFC 8707 lets clients bind issued tokens to a specific resource server via the "resource" parameter on authorization and token requests. Without it, a token issued for audience A can be replayed against audience B if both trust the same issuer. The server's metadata doesn't advertise resource_indicators_supported, so clients cannot discover whether to send the parameter. Confidence is medium: the server may validate audience at runtime without advertising it.`,
    howToFix: `Accept the "resource" parameter on authorization and token endpoints. Validate the resulting token's audience claim matches this server. Advertise "resource_indicators_supported": true in authorization server metadata.`,
    spec: 'RFC 8707',
    specUrl: 'https://datatracker.ietf.org/doc/html/rfc8707',
  },
  {
    id: 'auth-005',
    title: 'Dynamic Client Registration not supported',
    severity: 'high',
    oneLiner: 'OAuth metadata is served but "registration_endpoint" is missing.',
    whatItMeans: `MCP clients built by third parties cannot register themselves with your authorization server without a registration endpoint. Every client has to be onboarded manually, which doesn't scale across the MCP ecosystem. RFC 7591 defines the dynamic client registration protocol; MCP spec references it as the expected mechanism.`,
    howToFix: `Implement RFC 7591 Dynamic Client Registration. Expose POST /register that accepts client metadata and returns client_id (+ client_secret for confidential clients). Advertise the URL in authorization server metadata as "registration_endpoint".`,
    spec: 'RFC 7591',
    specUrl: 'https://datatracker.ietf.org/doc/html/rfc7591',
  },
  {
    id: 'scope-001',
    title: 'No per-tool scopes',
    severity: 'high',
    oneLiner: 'Server advertises OAuth but tools either share one scope or declare none.',
    whatItMeans: `When all tools share a scope (or no scopes are declared at all) on an OAuth-protected server, there's no way to grant a client access to "read my data" without also granting "delete my data". The check only fires when there's OAuth context: either an OAuth discovery document is served, or the directory contains a scopes.json. On non-OAuth servers it stays silent, since scopes aren't applicable there.`,
    howToFix: `Give each tool its own scope with a verb-shaped suffix: user:read, user:write, email:send. Reject tool calls whose token lacks the required scope. If you ship a connector repo, commit scopes.json at the root mapping each tool name to its scope list.`,
  },
  {
    id: 'scope-002',
    title: 'Write and read tools share a scope',
    severity: 'medium',
    oneLiner: 'A scope that covers write/destructive tools also covers read tools.',
    whatItMeans: `Patchbay tokenises each tool name on separators (_, -, space, /) and classifies tokens as "write" (create, update, delete, send, pay, charge, transfer, execute, run, post, put, patch, destroy, remove, insert, write, add, set, kill, stop, start, deploy, publish) or "read" (get, list, read, search, find, query, fetch, lookup, describe, show, inspect, view). If a scope maps to both a write tool and a read tool, revoking write access also revokes reads, which is almost never what the user wanted. Confidence is medium: the regex is a heuristic and will mislabel some tool names (post_user = "user who posted", not "HTTP POST a user").`,
    howToFix: `Split the shared scope into separate read and write scopes. Example: instead of user:all for both get_user and delete_user, use user:read and user:write.`,
  },
  {
    id: 'secret-001',
    title: 'Hardcoded secret in source',
    severity: 'critical',
    oneLiner: 'A credential-shaped string literal is checked into a non-test source file.',
    whatItMeans: `patchbay audit scans each source file (.ts, .tsx, .js, .mjs, .cjs, .py, .json, .yaml, .yml, .env) for known credential patterns: sk-* (OpenAI/Stripe/Anthropic), AKIA* (AWS), ghp_* (GitHub personal access tokens), xoxb-* (Slack bot tokens), and generic 32+ character hex strings assigned to variables named key/token/secret/password. Test files, fixture directories, docs and example patterns (sk-example, your_key, xxxxx, dummy, placeholder) are skipped to avoid false positives.`,
    howToFix: `Move the secret into an environment variable. Rotate the leaked value immediately: assume anyone with git history access has it, which includes GitHub search. Add a secret scanner to CI so future leaks are caught before merge.`,
  },
  {
    id: 'secret-002',
    title: 'Long-lived credential in env, no refresh flow',
    severity: 'medium',
    oneLiner: 'Code reads credentials from env but never calls a refresh_token flow.',
    whatItMeans: `patchbay found environment variables with names matching KEY|TOKEN|SECRET|PASSWORD being read in source, but no code path that handles OAuth refresh tokens. This means the credential rotates only when someone manually updates the env, which in practice is never. Long-lived credentials in env are the most common leak path for connectors because they end up in Docker images, CI logs, and backup files.`,
    howToFix: `Switch to OAuth 2.1 with refresh tokens. Store only the refresh token; derive access tokens from it on each run with a short TTL. Rotate the refresh token on every refresh.`,
  },
  {
    id: 'transport-001',
    title: 'Server reachable over plain HTTP',
    severity: 'high',
    oneLiner: 'The MCP endpoint URL starts with http:// and is not a localhost dev server.',
    whatItMeans: `Any bearer token sent to this URL traverses the network in cleartext. Any attacker on-path (coffee shop WiFi, compromised router, hostile network middlebox) can read tokens and replay them. Localhost URLs (localhost, 127.0.0.1, [::1]) are exempted because dev servers legitimately run over plain HTTP.`,
    howToFix: `Serve the MCP endpoint over HTTPS only. On the HTTP port, respond with 301 redirect to the HTTPS equivalent, or close the connection. A .dev TLD is HSTS-preloaded in Chrome and Firefox and will refuse plain HTTP automatically.`,
  },
  {
    id: 'transport-002',
    title: 'Server accepts spoofed Origin header',
    severity: 'low',
    oneLiner: 'A tools/list call with Origin: https://attacker.example got a 2xx response.',
    whatItMeans: `patchbay sent a probe with a bogus Origin header. The server didn't reject it. This matters for servers that are intended to be called from browser clients: a user who visits https://attacker.example could trigger tool calls on their behalf (DNS rebinding, CSRF). For server-to-server MCP endpoints (called by stdio or server-side HTTP) Origin validation is not required, so this finding is low severity by default. If you don't accept browser clients, you can ignore it.`,
    howToFix: `Validate the Origin header against an allowlist of expected client origins. Reject requests with unknown or missing Origin on state-changing operations.`,
  },
  {
    id: 'redirect-001',
    title: 'Token endpoint treats localhost and 127.0.0.1 inconsistently',
    severity: 'medium',
    oneLiner: 'The token endpoint responded with different status codes for redirect_uri=http://localhost/cb vs http://127.0.0.1/cb.',
    whatItMeans: `RFC 8252 §7.3 (OAuth 2.0 for Native Apps) requires that authorization servers treat loopback IP literals (localhost, 127.0.0.1, [::1]) as equivalent when validating redirect_uri. If a client sends one form and the server accepts only the other, the client flow breaks. This is a well-known interop issue that patchbay catches by sending two probe requests and comparing status codes.`,
    howToFix: `Normalise all loopback redirect_uri values before comparison. Treat localhost, 127.0.0.1 and [::1] as equivalent per RFC 8252 §7.3. Accept any port on loopback addresses, since native app ports are ephemeral.`,
    spec: 'RFC 8252 §7.3',
    specUrl: 'https://datatracker.ietf.org/doc/html/rfc8252#section-7.3',
  },
  {
    id: 'probe-001',
    title: 'Probe inconclusive',
    severity: 'info',
    oneLiner: 'patchbay could reach the server but could not learn enough to judge auth posture.',
    whatItMeans: `There are two shapes of this finding. If the server requires auth before any endpoint responds and we have no credentials, we report "Auth-walled server, not audited". This is the expected state for a correctly configured OAuth 2.1 server and is not a problem. The second shape fires when the server responded but no MCP initialize, no tools/list and no .well-known/oauth-* metadata succeeded. The server may use a different transport (stdio, SSE at a path we didn't try), require a specific protocol version, or just be a non-MCP endpoint at this URL.`,
    howToFix: `For auth-walled servers: no action needed. A future --auth flag will let you pass credentials for a deeper audit. For inconclusive probes: re-run with --json to see the raw snapshot (initializeOk, toolsListOk, rawErrors) and check whether the URL is correct, whether the transport is Streamable HTTP, and whether the server actually serves MCP at this path.`,
  },
  {
    id: 'check-crashed',
    title: 'Check crashed internally',
    severity: 'info',
    oneLiner: 'A patchbay check function threw an exception while evaluating this snapshot.',
    whatItMeans: `This is a bug in patchbay itself, not in the server you audited. The snapshot still captured what the probe saw; one check function threw while interpreting it. The finding evidence contains the error message.`,
    howToFix: `Open an issue at github.com/GodSmasher/patchbay with the --json output and the error message. Attach the snapshot if you can share it.`,
  },
]

export function getDoc(id: string): DocEntry | undefined {
  return DOCS.find((d) => d.id === id)
}

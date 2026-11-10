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
    oneLiner: 'Server returns tools/list without any credential and at least one tool name looks mutating.',
    whatItMeans: `patchbay audit calls the server's tools/list endpoint without any Authorization or x-api-key header. If the server returns a tool list, no authentication is being enforced. The check is only critical when at least one tool name reads as mutating (create/delete/send/execute/start-...). A server that only exposes read-shaped tools (get/list/search/...) is downgraded to info level and labelled "public read-only server", which the MCP spec documents as a legitimate pattern for public data endpoints.`,
    howToFix: `Require OAuth 2.1 bearer tokens on initialize and tools/*. Serve /.well-known/oauth-protected-resource pointing to an authorization server and reject unauthenticated calls with 401. If this server is intended to be public read-only, no action needed; the finding will downgrade automatically once no mutating tool names are present.`,
    spec: 'MCP authorization spec (2025-06-18)',
    specUrl: 'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
  },
  {
    id: 'auth-002',
    title: 'Static credential accepted, no OAuth discovery',
    severity: 'critical',
    oneLiner: 'Server accepts bearer or API-key auth but serves no .well-known OAuth metadata.',
    whatItMeans: `The server accepts an Authorization: Bearer or x-api-key header (patchbay confirmed this with a probe token that returned 2xx), but neither /.well-known/oauth-protected-resource nor /.well-known/oauth-authorization-server is served. MCP clients that follow the spec cannot negotiate PKCE, scopes or resource indicators. They have to be configured out of band with a static credential.`,
    howToFix: `Replace static credentials with OAuth 2.1. Publish discovery metadata at the two well-known paths so clients can auto-configure. Support PKCE with S256, resource indicators (RFC 8707) and dynamic client registration (RFC 7591).`,
    spec: 'MCP authorization spec (2025-06-18)',
    specUrl: 'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
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
    title: 'Retired: resource indicators flag in OAuth metadata',
    severity: 'info',
    oneLiner: 'OAuth metadata does not advertise "resource_indicators_supported": true.',
    whatItMeans: `This check was retired on 2026-11-10 and no longer runs. Reports created before that date are shown without it. It looked for "resource_indicators_supported": true in the authorization server metadata. That field is not defined by RFC 8707, it is not in the IANA registry of authorization server metadata and the MCP authorization spec does not mention it. The spec tells clients to send the "resource" parameter whether or not the server announces support. A server without this flag can be fully compliant.

What actually matters is whether the server binds tokens to its own audience and rejects tokens issued for another resource. Metadata cannot show that. The AUDIENCE-001 probe tests it directly.`,
    howToFix: `No fix is required for this finding on its own. Make sure the authorization server accepts the "resource" parameter on authorization and token requests (RFC 8707) and that the MCP server validates the audience of every token. Then confirm it with the AUDIENCE-001 probe.`,
    spec: 'RFC 8707',
    specUrl: 'https://datatracker.ietf.org/doc/html/rfc8707',
  },
  {
    id: 'auth-005',
    title: 'No client registration mechanism advertised',
    severity: 'high',
    oneLiner: 'OAuth metadata is served but offers neither Client ID Metadata Documents nor a "registration_endpoint".',
    whatItMeans: `An MCP client needs a client_id before it can start the OAuth flow. The MCP authorization spec (2026-07-28) names three ways to get one: Client ID Metadata Documents, pre-registration and Dynamic Client Registration (RFC 7591). Metadata documents are the recommended route. Dynamic registration is deprecated but still allowed.

This finding is high when the server metadata advertises neither "client_id_metadata_document_supported": true nor a "registration_endpoint". Third party clients then have no automatic way in and every one of them has to be registered by hand.

If the server only offers dynamic registration the finding is reported at info level and does not affect the grade. A server that supports metadata documents passes.`,
    howToFix: `Support Client ID Metadata Documents and advertise "client_id_metadata_document_supported": true in authorization server metadata. For older clients also expose a Dynamic Client Registration endpoint (RFC 7591): POST /register accepts client metadata and returns a client_id. Advertise it as "registration_endpoint".`,
    spec: 'MCP authorization spec (2026-07-28), client registration',
    specUrl: 'https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization',
  },
  {
    id: 'auth-006',
    title: 'Authorization server rejects loopback redirect URIs',
    severity: 'high',
    oneLiner: 'Dynamic Client Registration refused "http://127.0.0.1:PORT/callback" and "http://localhost:PORT/callback" as redirect URIs.',
    whatItMeans: `Native and CLI MCP clients (Claude Code, Claude Desktop, editor integrations) finish the OAuth authorization code flow by listening on a local port and using a loopback redirect URI such as http://127.0.0.1:53124/callback. The port is picked by the operating system at request time, so it is different on every login. RFC 8252 §7.3 says the authorization server MUST allow any port for loopback IP redirect URIs for exactly this reason.

This finding fires when patchbay tried to register a client with loopback redirect URIs and the registration endpoint rejected them. For users the symptom is a login that hangs or errors after they click "Allow": the browser flow works, but the client can never receive the callback.

The check is opt-in because it sends a real registration request. Run it with --probe-dcr-loopback. It stays silent if the server has no registration endpoint (see AUTH-005) or if the probe was inconclusive.`,
    howToFix: `Accept loopback redirect URIs in Dynamic Client Registration and at the authorization endpoint: http://127.0.0.1:PORT/callback and http://localhost:PORT/callback, with any port number. Match on scheme, host and path and ignore the port for loopback hosts only. Keep rejecting plain http:// redirect URIs for every non-loopback host.

Re-run to confirm:
  npx -y @patchbay-nebius/agent audit <url> --probe-dcr-loopback`,
    spec: 'RFC 8252 §7.3',
    specUrl: 'https://datatracker.ietf.org/doc/html/rfc8252#section-7.3',
  },
  {
    id: 'auth-007',
    title: 'Invalid bearer token returns wrong HTTP status',
    severity: 'medium',
    oneLiner: 'The server rejected a made-up bearer token with a status other than 401.',
    whatItMeans: `patchbay sends one tools/list request with a bearer token that cannot be valid. The MCP authorization spec says invalid or expired tokens must receive HTTP 401. This finding fires when the server rejected the token with a different status. The most common one is 403.

The difference matters to clients. 401 means the token is not good and the client should get a new one. 403 means the token is fine but not allowed to do this. A client that receives 403 for an expired token has no reason to refresh it, so the user sees a permission error where a silent token refresh would have fixed it.

The check stays silent if the server needs no authentication. It also stays silent if the server accepted the made-up token, because that case is AUTH-002.`,
    howToFix: `Return 401 with a WWW-Authenticate header for every request that carries an invalid or expired token. Keep 403 for requests with a valid token that lacks the required scope and send WWW-Authenticate with error="insufficient_scope" there.`,
    spec: 'MCP authorization spec (2026-07-28)',
    specUrl: 'https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization',
  },
  {
    id: 'audience-001',
    title: 'Server accepts cross-audience bearer tokens',
    severity: 'critical',
    oneLiner: 'tools/list succeeded with a bearer token that was minted for a different resource on the same authorization server.',
    whatItMeans: `One authorization server often issues tokens for several resources: your MCP server, an internal API, a sibling product. Each token carries an "aud" (audience) claim naming the resource it was issued for. If your MCP server does not check that claim, a token issued for any sibling resource also works against the MCP server, so whoever holds or can obtain a token for the weakest sibling can call your tools.

Discovery metadata cannot reveal this. No standard metadata field states that a server validates the audience, which is why this check sends a real request.

The check only runs when you supply a probe token with --probe-audience=<token> (or the PATCHBAY_PROBE_AUDIENCE_TOKEN environment variable). Use a token you are entitled to hold, minted for a different resource on the same authorization server. If the probe gets no clear answer, the finding is reported as info ("probe inconclusive") instead of critical.`,
    howToFix: `Validate the "aud" claim on every incoming bearer token. The expected audience is this MCP server's own resource identifier, the value you publish as "resource" in /.well-known/oauth-protected-resource. Reject any token whose audience does not match with HTTP 401.`,
    spec: 'RFC 8707 §2',
    specUrl: 'https://datatracker.ietf.org/doc/html/rfc8707#section-2',
  },
  {
    id: 'manifest-001',
    title: 'Tool manifest changed since last run',
    severity: 'medium',
    oneLiner: 'The set of tools this server exposes is different from the manifest patchbay pinned on an earlier run.',
    whatItMeans: `Approving an MCP server is a one-time decision, but the server can change afterwards. It can add a tool that writes or executes, give an existing read-only tool a new "command" or "path" parameter, or rewrite a tool description so it starts instructing the model. None of that triggers a new approval prompt in most clients.

patchbay pins the tool manifest the first time it audits a server and diffs against it on later runs. Severity follows the most serious change in the diff:
  critical: a new write-shaped tool, or a read tool that gained a write-shaped parameter
  medium: an existing tool's description changed
  low: an input schema changed structurally, or a new read-only tool appeared
  info: a tool was removed`,
    howToFix: `Review the diff in the finding. If every change is expected because you updated the server on purpose, re-pin the manifest:
  npx -y @patchbay-nebius/agent audit <url> --trust

If a change is unexpected, do not re-pin. Check the server's release notes, or the deployment log for a self-hosted server, before you let an agent call it again.`,
  },
  {
    id: 'manifest-002',
    title: 'Manifest change classified',
    severity: 'medium',
    oneLiner: 'The tool manifest changed since the pinned run and this check sorts the change into breaking, additive or semantic drift.',
    whatItMeans: `MANIFEST-001 fires one line when anything in the tool manifest changes. This check is the breakdown. It sorts every change into one of three buckets so a reviewer can tell at a glance whether client code needs to change.

Breaking (critical): a tool was removed, a parameter was removed, a parameter was made required, a parameter's type was narrowed or an enum lost a value. Existing clients will fail.

Semantic drift (medium): the shape is identical but a tool description changed. The schema that a client codes against has not moved, but the text the model reads to plan has. The tool can start behaving differently without any code change on the client side.

Additive (low): a new tool or a new optional parameter appeared. Existing clients keep working.

MANIFEST-001 and MANIFEST-002 fire on the same change. 001 is the single alert, 002 is the detail. The check stays silent when no earlier run was pinned.`,
    howToFix: `For breaking changes treat the server like a major version bump: notify clients or hold until they upgrade. For semantic drift read the description diff and confirm it still matches what the tool actually does. For additive changes no action is needed. In all cases re-pin the manifest with \`--trust\` once the change has been reviewed.`,
  },
  {
    id: 'resource-001',
    title: 'Protected Resource Metadata missing',
    severity: 'high',
    oneLiner: 'The server uses OAuth but serves no usable /.well-known/oauth-protected-resource document.',
    whatItMeans: `Protected Resource Metadata (RFC 9728) is how a client finds out where to log in. The document names the authorization servers that issue tokens for this MCP server. The MCP authorization spec has required it since revision 2025-06-18 and still does in 2026-07-28.

This finding has two shapes. Either the document is not served at all, or it is served without a non-empty "authorization_servers" list. In both cases a client that follows the spec cannot start the login without being configured by hand.

The check only runs on servers that use OAuth, meaning the server required authentication or published authorization server metadata. A server that needs no login is not flagged here.`,
    howToFix: `Serve /.well-known/oauth-protected-resource as JSON. Include "authorization_servers" with at least one issuer URL, the same issuer you publish in your authorization server metadata. Set "resource" to the canonical URL of your MCP endpoint.`,
    spec: 'RFC 9728',
    specUrl: 'https://datatracker.ietf.org/doc/html/rfc9728',
  },
  {
    id: 'poisoning-001',
    title: 'Tool metadata contains prompt injection patterns',
    severity: 'high',
    oneLiner: 'A tool description or input schema description contains hidden characters or text that addresses the model.',
    whatItMeans: `MCP clients pass tool descriptions and the descriptions inside input schemas to the model. Whatever stands there is read as context for planning. A description that carries instructions for the model can steer an agent without the user noticing.

The check looks for two things:
  high: characters a person would not see in a catalog, such as zero-width characters, bidirectional overrides and Unicode tag characters
  medium: visible text aimed at the model, such as <system> style tags, role prefixes like "System:", or phrases like "ignore previous instructions"

The medium band works with patterns and can be wrong. A harmless description that says "you must call this tool first" matches too, so read the quoted text before you act on it. The check only sees tools the server lists without credentials. It does not judge what a tool does.`,
    howToFix: `Remove hidden characters from every tool description and schema description and add a check for them to your build. Rewrite flagged descriptions so they say what the tool does for a human reader. If you did not write the flagged text yourself, treat the server as compromised until you know where it came from.`,
  },
  {
    id: 'audience-002',
    title: 'Server accepts bearer tokens with no audience claim',
    severity: 'critical',
    oneLiner: 'tools/list was accepted with a bearer token whose JWT payload has no aud claim at all.',
    whatItMeans: `AUDIENCE-001 catches servers that accept a token issued for a different resource. This check catches a related mistake: a server whose audience check is written so that a missing aud claim slips through. The common shape is \`if (aud && aud !== me) reject\`. A token with no aud makes the first condition false and the reject never runs.

Per RFC 9068 Section 4, a resource server must reject any JWT whose aud does not contain its own identifier. "Does not contain" includes "is not there at all." A token with no aud is as invalid as a token with the wrong aud.

The check is opt-in because it needs a validly signed bearer token for the server's authorization server whose payload has no aud claim. Without that token the check stays silent.`,
    howToFix: `Rewrite audience validation so a missing claim is a reject. For a single-string aud: \`if (aud !== me) reject\`. For an array aud: \`if (!Array.isArray(aud) || !aud.includes(me)) reject\`. Never fall back to accepting a token whose aud is absent.`,
    spec: 'RFC 9068 Section 4',
    specUrl: 'https://datatracker.ietf.org/doc/html/rfc9068#section-4',
  },
  {
    id: 'headers-001',
    title: 'Weak transport-security response headers',
    severity: 'medium',
    oneLiner: 'The server is missing one or more standard security headers on its responses, or opens itself to any browser origin.',
    whatItMeans: `The scanner reads the response headers that come back on the first probe and reports four common problems:

  - Access-Control-Allow-Origin set to "*" together with Access-Control-Allow-Credentials "true". Browsers reject this combination and it is often an auth bypass misconfiguration. "*" alone is also flagged with a milder note because it opens the server to any browser origin.
  - No Strict-Transport-Security header on an HTTPS endpoint. The first connection over HTTPS is still open to a downgrade attack.
  - No X-Frame-Options and no frame-ancestors directive in a Content-Security-Policy, or a frame-ancestors directive that allows anyone. The response can be framed cross-origin.
  - X-Content-Type-Options is not "nosniff". Error responses may be MIME-sniffed by browsers.

All four are passive. No extra request is made. The check stays silent if the server was not reachable.`,
    howToFix: `Set X-Content-Type-Options: nosniff on every response. On HTTPS set Strict-Transport-Security with a max-age of at least 15552000. Set X-Frame-Options: DENY or a Content-Security-Policy with a restrictive frame-ancestors directive (not "*"). Review Access-Control-Allow-Origin if the endpoint is not meant to be reachable from arbitrary browser origins.`,
  },
  {
    id: 'iss-001',
    title: 'RFC 9207 iss parameter not advertised in OAuth metadata',
    severity: 'low',
    oneLiner: 'The authorization server does not set authorization_response_iss_parameter_supported to true.',
    whatItMeans: `RFC 9207 defines an iss parameter that the authorization server sends back on every authorization response. It names the authorization server that signed the response. A client that validates it catches mix-up attacks between two authorization servers configured for the same resource.

MCP clients must validate this parameter per RFC 9207 Section 2.4, but only when the authorization server advertises support. The signal is authorization_response_iss_parameter_supported: true in the metadata. Without the flag a client has no reason to look for the parameter and the mitigation is off.

The MCP spec marks this as SHOULD today and says a future revision will raise it to MUST. The check is low severity for now and will likely rise.`,
    howToFix: `Set "authorization_response_iss_parameter_supported": true in /.well-known/oauth-authorization-server. Include the iss parameter in every authorization response, including error responses.`,
    spec: 'RFC 9207 Section 2.4',
    specUrl: 'https://datatracker.ietf.org/doc/html/rfc9207#section-2.4',
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
    whatItMeans: `patchbay audit scans each source file (.ts, .tsx, .js, .mjs, .cjs, .py, .json, .yaml, .yml, .env) for known credential patterns: sk-* (OpenAI/Stripe/Anthropic), AKIA* (AWS), ghp_* (GitHub personal access tokens), xoxb-* (Slack bot tokens) and generic 32+ character hex strings assigned to variables named key/token/secret/password. Test files, fixture directories, docs and example patterns (sk-example, your_key, xxxxx, dummy, placeholder) are skipped to avoid false positives.`,
    howToFix: `Move the secret into an environment variable. Rotate the leaked value immediately: assume anyone with git history access has it, which includes GitHub search. Add a secret scanner to CI so future leaks are caught before merge.`,
  },
  {
    id: 'secret-002',
    title: 'Long-lived credential in env, no refresh flow',
    severity: 'medium',
    oneLiner: 'Code reads credentials from env but never calls a refresh_token flow.',
    whatItMeans: `patchbay found environment variables with names matching KEY|TOKEN|SECRET|PASSWORD being read in source, but no code path that handles OAuth refresh tokens. This means the credential rotates only when someone manually updates the env, which in practice is never. Long-lived credentials in env are the most common leak path for connectors because they end up in Docker images, CI logs and backup files.`,
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
    howToFix: `For auth-walled servers: no action needed. A future --auth flag will let you pass credentials for a deeper audit. For inconclusive probes: re-run with --json to see the raw snapshot (initializeOk, toolsListOk, rawErrors) and check whether the URL is correct, whether the transport is Streamable HTTP and whether the server actually serves MCP at this path.`,
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

import type { Metadata } from 'next'
import Link from 'next/link'

const TITLE = 'Methodology and sources · patchbay'
const DESCRIPTION =
  "Where each patchbay check gets its authority from, how we score, what we deliberately don't do, and where we know we have gaps."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/methodology' },
  openGraph: { type: 'article', url: '/methodology', title: TITLE, description: DESCRIPTION, siteName: 'patchbay' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
}

const A = 'text-ink underline underline-offset-2 decoration-ink-mute hover:decoration-ink'

interface NormRef {
  name: string
  what: string
  checks: string
}

const NORMATIVE_REFS: NormRef[] = [
  { name: 'MCP Authorization spec (modelcontextprotocol.io, revision 2026-07-28)', what: 'The authoritative definition of how MCP servers are supposed to do OAuth 2.1', checks: 'AUTH-001-007, RESOURCE-001, PKCE-001-003, AUDIENCE-001/002, SCOPE-001' },
  { name: 'RFC 9728 Protected Resource Metadata (Oct 2024, mandatory for MCP since mid-2025)', what: 'Defines the /.well-known/oauth-protected-resource document shape and semantics', checks: 'RESOURCE-001' },
  { name: 'RFC 7636 PKCE', what: 'Authorization code flow proof-key exchange', checks: 'AUTH-003, PKCE-001/002/003' },
  { name: 'RFC 8707 Resource Indicators', what: 'How to bind access tokens to specific resource audiences', checks: 'AUDIENCE-001/002' },
  { name: 'RFC 9207 iss parameter', what: 'Mix-up attack mitigation on OAuth response', checks: 'ISS-001' },
  { name: 'RFC 8693 Token Exchange', what: 'On-behalf-of delegation flows', checks: 'IDENTITY-001' },
  { name: 'RFC 7009 Token Revocation', what: 'Revocation endpoint semantics', checks: 'OAUTH-REVOCATION-001' },
  { name: 'RFC 7591 Dynamic Client Registration (deprecated by MCP spec, retained for backwards compatibility)', what: 'Server-driven client registration', checks: 'AUTH-005, DCR-OPEN-HTTPS, DCR-OPEN-TOTAL' },
  { name: 'OAuth Client ID Metadata Documents (CIMD) draft', what: 'The modern replacement for DCR', checks: 'AUTH-005' },
  { name: 'RFC 8252 OAuth 2.0 for Native Apps', what: 'Loopback redirect behaviour', checks: 'AUTH-006' },
  { name: 'OAuth 2.1 draft', what: 'The umbrella protocol', checks: 'AUTH-002, AUTH-007, SCOPE-001, implicit-flow deprecation' },
  { name: 'RFC 6797 HSTS', what: 'HTTPS enforcement header', checks: 'HEADERS-001.5, .6, .7' },
  { name: 'RFC 7034 X-Frame-Options', what: 'Click-jacking header', checks: 'HEADERS-001.1, .2' },
  { name: 'Content Security Policy Level 3', what: 'Script and resource policy', checks: 'HEADERS-001.8, .9' },
  { name: 'Referrer Policy (W3C)', what: 'Referrer leakage control', checks: 'HEADERS-001.10' },
  { name: 'Fetch standard CORS section', what: 'Cross-origin request handling', checks: 'HEADERS-001.11' },
  { name: 'OWASP Secure Headers Project', what: 'Industry recommendations for value thresholds', checks: 'HEADERS-001.6 (HSTS 120d floor)' },
  { name: 'RFC 6570 URI Templates', what: 'Template syntax', checks: 'URITEMPLATE-001' },
]

type Confidence = 'HIGH' | 'MEDIUM' | 'CONTEXTUAL'

interface CheckRow {
  check: string
  category: string
  primarySource: string
  confidence: Confidence
}

// MATRIX:START (generated — do not edit, run scripts/generate-methodology-matrix.mjs)
const CHECK_MATRIX: CheckRow[] = [
  {
    check: 'ANNOTATIONS-001',
    category: 'MCP',
    primarySource: 'MCP spec §tool annotations: destructiveHint, readOnlyHint contract vs tool-name shape',
    confidence: 'CONTEXTUAL',
  },
  {
    check: 'AUDIENCE-001',
    category: 'OAuth',
    primarySource: 'RFC 8707 §2 resource parameter + MCP audience-binding requirement',
    confidence: 'HIGH',
  },
  {
    check: 'AUDIENCE-002',
    category: 'OAuth',
    primarySource: 'RFC 8707 + sibling-resource acceptance test',
    confidence: 'HIGH',
  },
  {
    check: 'AUTH-001',
    category: 'OAuth',
    primarySource: 'MCP Authorization spec §auth-required + three-way severity matrix for tool-verb shape',
    confidence: 'CONTEXTUAL',
  },
  {
    check: 'AUTH-002',
    category: 'OAuth',
    primarySource: 'OAuth 2.1 §5.2 Protected Resource behaviour',
    confidence: 'HIGH',
  },
  {
    check: 'AUTH-003',
    category: 'OAuth / PKCE',
    primarySource: 'RFC 7636 + MCP spec §PKCE-required',
    confidence: 'HIGH',
  },
  {
    check: 'AUTH-005',
    category: 'OAuth / Registration',
    primarySource: 'RFC 7591 + CIMD draft + MCP spec July 2026 revision',
    confidence: 'HIGH',
  },
  {
    check: 'AUTH-006',
    category: 'OAuth / Native',
    primarySource: 'RFC 8252 §7.3',
    confidence: 'HIGH',
  },
  {
    check: 'AUTH-007',
    category: 'OAuth',
    primarySource: 'OAuth 2.1 §5.3 status code semantics',
    confidence: 'HIGH',
  },
  {
    check: 'AUTHORITY-ATTESTATION-001',
    category: 'MCP',
    primarySource: 'patchbay-original: positive pattern — server advertises an MCP authority-attestation header',
    confidence: 'MEDIUM',
  },
  {
    check: 'DEPRECATED-001',
    category: 'MCP',
    primarySource: 'MCP spec revision history: sampling, logging, roots capabilities deprecated',
    confidence: 'HIGH',
  },
  {
    check: 'DUAL-RESOURCE-001',
    category: 'Metadata',
    primarySource: 'Split-brain PRM: server advertises two conflicting resource metadata sources. patchbay-original check, inspired by observed deployment mistakes',
    confidence: 'MEDIUM',
  },
  {
    check: 'HEADERS-001',
    category: 'Transport headers',
    primarySource: 'RFC 6797 + RFC 7034 + CSP L3 + Referrer-Policy + Fetch + OWASP Secure Headers',
    confidence: 'HIGH',
  },
  {
    check: 'IDENTITY-001',
    category: 'OAuth',
    primarySource: 'RFC 8693 §1.4 token exchange flow',
    confidence: 'MEDIUM',
  },
  {
    check: 'IDENTITY-002',
    category: 'OAuth',
    primarySource: 'RFC 8693 token exchange + patchbay unauth-accepting-token-endpoint deployment check',
    confidence: 'MEDIUM',
  },
  {
    check: 'IMPLICIT-001',
    category: 'OAuth',
    primarySource: 'OAuth 2.1 §3.1.2 implicit grant removal',
    confidence: 'HIGH',
  },
  {
    check: 'ISS-001',
    category: 'OAuth',
    primarySource: 'RFC 9207 §2 iss parameter requirement',
    confidence: 'HIGH',
  },
  {
    check: 'MANIFEST-001',
    category: 'MCP',
    primarySource: 'MCP spec §tool-manifest + patchbay drift-detection scheme',
    confidence: 'MEDIUM',
  },
  {
    check: 'MANIFEST-002',
    category: 'MCP',
    primarySource: 'Manifest-change classification: patchbay-original severity ladder',
    confidence: 'MEDIUM',
  },
  {
    check: 'OAUTH-REVOCATION-001',
    category: 'OAuth',
    primarySource: 'RFC 7009 + lifetime-flag inspection heuristic',
    confidence: 'MEDIUM',
  },
  {
    check: 'PKCE-001',
    category: 'OAuth',
    primarySource: 'RFC 7636 §4.1 code challenge requirement',
    confidence: 'HIGH',
  },
  {
    check: 'PKCE-002',
    category: 'OAuth',
    primarySource: 'RFC 7636 §4.3 plain method deprecation',
    confidence: 'HIGH',
  },
  {
    check: 'POISONING-001',
    category: 'LLM-specific',
    primarySource: 'Simon Willison\'s prompt-injection research + Anthropic safety research + OWASP LLM Top 10',
    confidence: 'CONTEXTUAL',
  },
  {
    check: 'POISONING-002',
    category: 'LLM-specific',
    primarySource: 'Unicode TR 36 hidden characters list + bidi character class + patchbay pattern catalogue',
    confidence: 'CONTEXTUAL',
  },
  {
    check: 'POISONING-003',
    category: 'LLM-specific',
    primarySource: 'Tool-manifest drift detection; patchbay-original scheme',
    confidence: 'CONTEXTUAL',
  },
  {
    check: 'REDIRECT-001',
    category: 'OAuth / Native',
    primarySource: 'RFC 8252 §8.3 loopback IP literal equivalence',
    confidence: 'HIGH',
  },
  {
    check: 'REDIRECT-002',
    category: 'OAuth',
    primarySource: 'OAuth 2.1 §4.1.2.1 redirect_uri pre-registration requirement',
    confidence: 'HIGH',
  },
  {
    check: 'RESOURCE-001',
    category: 'Metadata',
    primarySource: 'RFC 9728 §3 Protected Resource Metadata document',
    confidence: 'HIGH',
  },
  {
    check: 'SAMPLING-001',
    category: 'MCP',
    primarySource: 'MCP spec §sampling capability deprecation notice',
    confidence: 'HIGH',
  },
  {
    check: 'SCOPE-001',
    category: 'OAuth',
    primarySource: 'OAuth 2.1 §3.3 + least-privilege scope recommendation',
    confidence: 'MEDIUM',
  },
  {
    check: 'SCOPE-002',
    category: 'OAuth',
    primarySource: 'OAuth 2.1 §3.3 least-privilege + patchbay write-read-scope-shared anti-pattern',
    confidence: 'MEDIUM',
  },
  {
    check: 'SDK-CVE-001',
    category: 'Vulnerability',
    primarySource: 'NVD CVE-2026-52869 (Python SDK) + CVE-2026-25536 (TypeScript SDK) + fingerprint matching',
    confidence: 'HIGH',
  },
  {
    check: 'SECRET-001',
    category: 'Config',
    primarySource: 'Common credential-pattern regex library + NIST credential guidance',
    confidence: 'CONTEXTUAL',
  },
  {
    check: 'SECRET-002',
    category: 'Config',
    primarySource: 'Env-variable leakage pattern; patchbay-original',
    confidence: 'CONTEXTUAL',
  },
  {
    check: 'SESSION-BINDING-001',
    category: 'Session',
    primarySource: 'OAuth 2.1 session fixation + patchbay deployment-mistake catalogue',
    confidence: 'MEDIUM',
  },
  {
    check: 'TRANSPORT-001',
    category: 'Transport',
    primarySource: 'OWASP Secure Headers Project + patchbay HTTPS-required policy',
    confidence: 'HIGH',
  },
  {
    check: 'TRANSPORT-002',
    category: 'Transport',
    primarySource: 'Fetch CORS semantics + patchbay foreign-origin heuristic',
    confidence: 'MEDIUM',
  },
  {
    check: 'UPSTREAM-IDENTITY-BYPASS-001',
    category: 'OAuth',
    primarySource: 'OAuth 2.1 §5.2 + patchbay client-supplied-identity-header attack-pattern',
    confidence: 'HIGH',
  },
  {
    check: 'URITEMPLATE-001',
    category: 'Resources',
    primarySource: 'RFC 6570 URI Template + patchbay traversal-risk heuristic',
    confidence: 'MEDIUM',
  },
]
// MATRIX:END

const CONFIDENCE_CLASS: Record<Confidence, string> = {
  HIGH: 'text-ink',
  MEDIUM: 'text-ink-soft',
  CONTEXTUAL: 'text-ink-mute',
}

const SEVERITY_WEIGHTS = [
  { severity: 'critical', weight: '−30', rationale: 'Three critical findings alone take a server from 100 to 10' },
  { severity: 'high', weight: '−15', rationale: 'Caps the score impact so no one check dominates' },
  { severity: 'medium', weight: '−5', rationale: 'Five medium findings = one critical equivalent' },
  { severity: 'low', weight: '−1', rationale: 'Signal, not grade-driver' },
  { severity: 'info', weight: '0', rationale: "Reported but doesn't affect score" },
]

const GRADE_CUTOFFS = [
  { score: '95-100', grade: 'A+' },
  { score: '85-94', grade: 'A' },
  { score: '75-84', grade: 'B' },
  { score: '60-74', grade: 'C' },
  { score: '40-59', grade: 'D' },
  { score: '0-39', grade: 'F' },
]

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: 'Methodology and sources',
  description: DESCRIPTION,
  url: 'https://patchbay-mcp.dev/methodology',
  dateModified: '2026-11-28',
  author: { '@type': 'Organization', name: 'patchbay' },
}

export default function MethodologyPage() {
  return (
    <main className="bg-paper text-ink px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold text-ink">Methodology and sources</h1>

        <div className="mt-6 rounded border-l-4 border-ink-mute bg-paper-card px-5 py-4 text-sm text-ink-soft">
          <p><strong className="text-ink">Last reviewed:</strong> 2026-11-28. <strong className="text-ink">Next scheduled review:</strong> 2027-02-28 (quarterly).</p>
          <p className="mt-2">The check-source matrix is kept in sync with the actual check code on every PR via CI gate. Deep-dive sections, scoring, and gaps lists are reviewed quarterly. Changelog at bottom.</p>
        </div>

        <p className="mt-6 text-lg text-ink-soft">
          This page exists because people have asked, directly and reasonably, where our checks get their authority from. Security tools that can&apos;t answer that question aren&apos;t worth trusting. We can answer it, and we think the honest version of the answer is more useful than a marketing version.
        </p>
        <p className="mt-4 text-ink-soft">
          This isn&apos;t a research paper. Patchbay is informed engineering judgment backed by published specifications, documented CVEs, and the actual behaviour we observe on the 6,225-endpoint public <Link href="/leaderboard" className={A}>leaderboard</Link>. Every check cites its source. Where we make judgment calls about severity or priority, we say so.
        </p>

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-ink">What you&apos;ll find here</h2>
          <ul className="mt-3 list-disc pl-6 space-y-1 text-ink-soft">
            <li>Which specs and standards patchbay enforces compliance against</li>
            <li>A per-check source matrix with confidence tiers</li>
            <li>Deep-dive explanations for the most consequential checks</li>
            <li>The scoring formula, including the parts that are convention rather than derivation</li>
            <li>Out-of-scope items we deliberately don&apos;t check</li>
            <li>Known gaps in our current coverage</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-ink">What you won&apos;t find here</h2>
          <ul className="mt-3 list-disc pl-6 space-y-1 text-ink-soft">
            <li>Claims of completeness. The MCP ecosystem is a year old. New attack classes get published and we add checks for them. Patchbay today is not patchbay in six months.</li>
            <li>Peer-reviewed cryptographic analysis. We&apos;re not a research lab.</li>
            <li>Proprietary threat models. If a check is doing something non-obvious, we explain the reasoning in its docs page.</li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-ink">Normative references</h2>
          <p className="mt-2 text-ink-soft">The specifications patchbay checks compliance against:</p>
          <div className="mt-6 overflow-x-auto rounded border border-paper-line">
            <table className="w-full text-sm">
              <thead className="border-b border-paper-line bg-paper-card text-left text-ink">
                <tr>
                  <th className="px-3 py-2 font-medium">Reference</th>
                  <th className="px-3 py-2 font-medium">What it defines</th>
                  <th className="px-3 py-2 font-medium">Patchbay checks that cite it</th>
                </tr>
              </thead>
              <tbody className="text-ink-soft">
                {NORMATIVE_REFS.map((r) => (
                  <tr key={r.name} className="border-t border-paper-line align-top">
                    <td className="px-3 py-2 text-ink">{r.name}</td>
                    <td className="px-3 py-2">{r.what}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.checks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-ink">Check-to-source matrix</h2>
          <p className="mt-2 text-ink-soft">
            Every published check with its primary source and our confidence tier. Confidence tiers:
          </p>
          <ul className="mt-3 list-disc pl-6 space-y-1 text-ink-soft">
            <li><strong className="text-ink">HIGH</strong>: directly implements a MUST or SHALL clause from a normative spec. Interpretation is tight.</li>
            <li><strong className="text-ink">MEDIUM</strong>: implements a SHOULD or recommended-practice from a spec or OWASP. Some interpretation room.</li>
            <li><strong className="text-ink">CONTEXTUAL</strong>: relies on context inference (e.g. tool name verb matching) rather than a hard spec clause. We explain our heuristic.</li>
          </ul>
          <div className="mt-6 overflow-x-auto rounded border border-paper-line">
            <table className="w-full text-sm">
              <thead className="border-b border-paper-line bg-paper-card text-left text-ink">
                <tr>
                  <th className="px-3 py-2 font-medium">Check</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Primary source</th>
                  <th className="px-3 py-2 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody className="text-ink-soft">
                {CHECK_MATRIX.map((r) => (
                  <tr key={r.check} className="border-t border-paper-line align-top">
                    <td className="px-3 py-2 font-mono text-xs text-ink">{r.check}</td>
                    <td className="px-3 py-2">{r.category}</td>
                    <td className="px-3 py-2">{r.primarySource}</td>
                    <td className={`px-3 py-2 font-mono text-xs ${CONFIDENCE_CLASS[r.confidence]}`}>{r.confidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-ink">Deep dives: the checks that matter most</h2>

          <h3 className="mt-8 text-lg font-semibold text-ink">AUTH-001: unauthenticated heavy-write tools</h3>
          <p className="mt-2 text-ink-soft">
            What it does: fires critical when a server exposes tools whose names contain heavy-write verbs (<code>delete</code>, <code>send</code>, <code>transfer</code>, <code>create</code>, <code>update</code>, <code>revoke</code>, <code>approve</code>, <code>archive</code>, <code>deploy</code>, <code>publish</code>, and about 15 others) via <code>tools/list</code> without requiring an OAuth bearer.
          </p>
          <p className="mt-3 text-ink-soft">
            Where the verb list comes from: aggregated from observed tool shapes on the public leaderboard plus English-language convention. Not a published list, which is why this check is CONTEXTUAL confidence rather than HIGH.
          </p>
          <p className="mt-3 text-ink-soft">Severity matrix (applied after the verb-match):</p>
          <ul className="mt-2 list-disc pl-6 space-y-1 text-ink-soft">
            <li>Heavy-write verb present, unauth: <strong className="text-ink">critical</strong></li>
            <li>Scaffolding-only verb (<code>start</code>, <code>run</code>, <code>execute</code>, <code>init</code>, <code>scaffold</code>, <code>bootstrap</code>): <strong className="text-ink">high</strong> (scanner cannot prove destructive without actually calling the tool)</li>
            <li>Read-only tool with no write verb: <strong className="text-ink">info</strong> (documented public read-only pattern)</li>
          </ul>
          <p className="mt-3 text-ink-soft">
            Why the matrix exists: a first draft of AUTH-001 fired critical on every WRITES-shaped tool, which put dev-scaffolding servers (Clerk MCP, Convex MCP) at the same tier as a genuine unauthenticated <code>send_payment</code> endpoint. External feedback (not from the companies, from our own dogfooding of the leaderboard output) made it clear this was wrong. PR #62 introduced the three-way matrix.
          </p>
          <p className="mt-3 text-ink-soft">
            Known limitation: a tool named <code>get_user_profile</code> that internally mutates state (sends a notification, logs an event) will not fire AUTH-001 because the verb doesn&apos;t match. We mitigate this by complementing with ANNOTATIONS-001 which checks the server-declared <code>readOnlyHint</code> and <code>destructiveHint</code> against the name.
          </p>

          <h3 className="mt-10 text-lg font-semibold text-ink">RESOURCE-001: no Protected Resource Metadata</h3>
          <p className="mt-2 text-ink-soft">
            What it does: fires when a server that otherwise uses OAuth doesn&apos;t serve <code>/.well-known/oauth-protected-resource</code>.
          </p>
          <p className="mt-3 text-ink-soft">
            Where the authority comes from: RFC 9728 §3, which is normative. MCP spec revision 2025-06-18 made this mandatory for MCP servers.
          </p>
          <p className="mt-3 text-ink-soft">
            Confidence: HIGH. This is literally &ldquo;fetch a well-known URL, check if the document exists and parses as valid JSON per §3&rdquo;. Interpretation room is near zero.
          </p>

          <h3 className="mt-10 text-lg font-semibold text-ink">PKCE-001: PKCE S256 not advertised</h3>
          <p className="mt-2 text-ink-soft">
            What it does: fires when the server&apos;s <code>/.well-known/oauth-authorization-server</code> metadata doesn&apos;t advertise <code>S256</code> in <code>code_challenge_methods_supported</code>.
          </p>
          <p className="mt-3 text-ink-soft">
            Where the authority comes from: RFC 7636 defines PKCE; MCP spec requires its advertisement in discovery metadata so compliant clients can use it. If the server enforces PKCE at runtime but doesn&apos;t advertise it, spec-compliant MCP clients refuse to start the flow because the metadata doesn&apos;t advertise support.
          </p>
          <p className="mt-3 text-ink-soft">Confidence: HIGH. The advertisement is a MUST per the spec.</p>
          <p className="mt-3 text-ink-soft">
            Known subtlety: the server may enforce PKCE perfectly at runtime even without the advertisement. The check fires because the advertisement itself is the violation. We flag both severity (medium) and rationale (discovery metadata gap) explicitly in the finding evidence.
          </p>

          <h3 className="mt-10 text-lg font-semibold text-ink">HEADERS-001: response header posture (depth-upgraded)</h3>
          <p className="mt-2 text-ink-soft">
            This check was recently upgraded from presence to value validation. See the dedicated post: <Link href="/blog/headers-001-depth-upgrade" className={A}>HEADERS-001: from presence to value-validation</Link>.
          </p>
          <p className="mt-3 text-ink-soft">Sources per sub-finding:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1 text-ink-soft">
            <li><code>.1</code>/<code>.2</code> X-Frame-Options: RFC 7034 + MDN browser-behaviour reference</li>
            <li><code>.3</code>/<code>.4</code> X-Content-Type-Options: Fetch standard + MDN</li>
            <li><code>.5</code>/<code>.6</code>/<code>.7</code> HSTS: RFC 6797 + OWASP Secure Headers Project (120-day minimum)</li>
            <li><code>.8</code>/<code>.9</code> CSP: Content Security Policy Level 3</li>
            <li><code>.10</code> Referrer-Policy: W3C Referrer Policy recommendation</li>
            <li><code>.11</code> CORS wildcard + credentials: Fetch standard §CORS protocol, which rejects this combination outright in browsers</li>
          </ul>
          <p className="mt-3 text-ink-soft">Confidence per sub-finding: HIGH. Each sub-finding checks a named spec clause with narrow interpretation room.</p>

          <h3 className="mt-10 text-lg font-semibold text-ink">POISONING-001 through -003</h3>
          <p className="mt-2 text-ink-soft">The weakest-confidence checks we publish, and we say so openly.</p>
          <p className="mt-3 text-ink-soft">Sources:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1 text-ink-soft">
            <li>Anthropic&apos;s prompt-injection research publications</li>
            <li>Simon Willison&apos;s prompt-injection taxonomy</li>
            <li>OWASP LLM Applications Top 10 (2024 revision)</li>
            <li>Observed poisoning patterns on the leaderboard</li>
          </ul>
          <p className="mt-3 text-ink-soft">
            Why CONTEXTUAL confidence: prompt-injection is an open research area. There is no standardised test suite, no RFC-equivalent authority. We implement pattern-matching against a catalogue of known-malicious structures. We will miss novel poisoning techniques until someone publishes them and we add to the catalogue.
          </p>
          <p className="mt-3 text-ink-soft">
            If this is a concern for your deployment, the honest recommendation is to treat POISONING check results as a floor, not a ceiling. A server that passes POISONING-001-003 is not provably clean. A server that fails one of these checks is observably carrying a known-bad pattern.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-ink">Scoring methodology</h2>
          <p className="mt-2 text-ink-soft">
            Patchbay converts per-check findings into a 0-100 score and then a letter grade. Here are the formulas and their origins.
          </p>

          <h3 className="mt-6 text-lg font-semibold text-ink">Severity weights</h3>
          <div className="mt-4 overflow-x-auto rounded border border-paper-line">
            <table className="w-full text-sm">
              <thead className="border-b border-paper-line bg-paper-card text-left text-ink">
                <tr>
                  <th className="px-3 py-2 font-medium">Severity</th>
                  <th className="px-3 py-2 font-medium">Points deducted per finding</th>
                  <th className="px-3 py-2 font-medium">Rationale</th>
                </tr>
              </thead>
              <tbody className="text-ink-soft">
                {SEVERITY_WEIGHTS.map((r) => (
                  <tr key={r.severity} className="border-t border-paper-line align-top">
                    <td className="px-3 py-2 font-mono text-xs text-ink">{r.severity}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.weight}</td>
                    <td className="px-3 py-2">{r.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-ink-soft">
            These weights are convention. They match the weights used in audit-core since the first version. They aren&apos;t derived from a formal CVSS-style threat calculus. If you think medium should be −7 instead of −5, we&apos;d read the argument.
          </p>

          <h3 className="mt-8 text-lg font-semibold text-ink">Grade cutoffs</h3>
          <div className="mt-4 overflow-x-auto rounded border border-paper-line">
            <table className="w-full max-w-xs text-sm">
              <thead className="border-b border-paper-line bg-paper-card text-left text-ink">
                <tr>
                  <th className="px-3 py-2 font-medium">Score</th>
                  <th className="px-3 py-2 font-medium">Grade</th>
                </tr>
              </thead>
              <tbody className="text-ink-soft">
                {GRADE_CUTOFFS.map((r) => (
                  <tr key={r.grade} className="border-t border-paper-line">
                    <td className="px-3 py-2 font-mono text-xs">{r.score}</td>
                    <td className="px-3 py-2 font-mono text-xs text-ink">{r.grade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-ink-soft">Also convention. The leaderboard collapses A+ into A for the 5-bucket display.</p>
          <p className="mt-3 text-ink-soft">The cutoffs are tuned so that:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1 text-ink-soft">
            <li>A server with one medium finding stays in A</li>
            <li>A server with three medium findings drops to B</li>
            <li>One critical finding drops to C</li>
            <li>Two criticals drop to D or F depending on other findings</li>
          </ul>
          <p className="mt-3 text-ink-soft">
            Hosts that disagree with the calibration can email <a href="mailto:sarah@patchbay-mcp.dev" className={A}>sarah@patchbay-mcp.dev</a> with their specific case. We&apos;ve already shifted the matrix once (PR #62) based on external observation.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-ink">What we deliberately don&apos;t do</h2>
          <ul className="mt-3 list-disc pl-6 space-y-2 text-ink-soft">
            <li><strong className="text-ink">No active exploitation.</strong> Patchbay doesn&apos;t attempt to actually mutate state, bypass auth, or exfiltrate data. Every check is passive or metadata-read-only.</li>
            <li><strong className="text-ink">No browser-behavioural testing.</strong> We don&apos;t run a real browser to verify that Chrome actually respects a given header. The scanner stays deterministic. Browser-reality comes from spec citation and known browser behaviour documentation.</li>
            <li><strong className="text-ink">No proprietary threat intelligence.</strong> We don&apos;t claim access to private disclosure lists or embargoed CVEs. When we flag a CVE we cite the public NVD entry.</li>
            <li><strong className="text-ink">No credential testing.</strong> We don&apos;t attempt to actually sign in, phish for tokens, or probe credential strength. Any check that would need to is marked out-of-scope.</li>
            <li><strong className="text-ink">No DOS or stress testing.</strong> The crawler hits each server once per week for a few requests. We will not be the reason your server falls over.</li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-ink">Known gaps we&apos;re transparent about</h2>
          <ul className="mt-3 list-disc pl-6 space-y-2 text-ink-soft">
            <li><strong className="text-ink">Novel attack classes.</strong> We cover what has been publicly described. The first week after a new MCP-specific attack class drops, patchbay has zero coverage until we ship the check.</li>
            <li><strong className="text-ink">Semantic CSP analysis.</strong> HEADERS-001 doesn&apos;t inspect whether a CSP is actually restrictive for the operator&apos;s use case. HEADERS-002 scope is open for this.</li>
            <li><strong className="text-ink">Behavioural AUTH-001.</strong> Current AUTH-001 is name-pattern-based. A behavioural version that actually calls the tool (with aggressive side-effect safeguards) is the biggest Q1 engineering item.</li>
            <li><strong className="text-ink">Full-flow OAuth testing.</strong> PKCE-001 checks the advertised metadata. It doesn&apos;t actually run a flow with broken PKCE params to verify runtime enforcement. On the Q1 depth-upgrade list.</li>
            <li><strong className="text-ink">CWE mapping.</strong> We don&apos;t currently map each check to Common Weakness Enumeration IDs. Planned.</li>
            <li><strong className="text-ink">Adversarial validation.</strong> No red-team has adversarially tested patchbay&apos;s checks for false negatives. We know this is a gap. Open to collaboration.</li>
            <li><strong className="text-ink">Peer review.</strong> Checks are code-reviewed internally and by occasional external contributors. There is no formal external review board. We&apos;re small.</li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-ink">How to push back</h2>
          <p className="mt-3 text-ink-soft">
            If you think a check is wrong (false positive, false negative, incorrect severity, poorly cited source), send the specific case to <a href="mailto:sarah@patchbay-mcp.dev" className={A}>sarah@patchbay-mcp.dev</a>. Include:
          </p>
          <ul className="mt-2 list-disc pl-6 space-y-1 text-ink-soft">
            <li>The check ID</li>
            <li>The host you&apos;re disagreeing about (or synthetic case)</li>
            <li>What you think the correct outcome should be</li>
            <li>The source you&apos;re basing your argument on</li>
          </ul>
          <p className="mt-3 text-ink-soft">
            We&apos;ve already revised checks based on external feedback (Adam Johns at trigger.dev found a scoring-consistency bug on 2026-11-28 that produced PRs #71 and #72; the AUTH-001 severity matrix came from internal dogfooding). Correction-friendly is the goal.
          </p>
          <p className="mt-3 text-ink-soft">
            Pull requests to the check logic itself are welcome at <a href="https://github.com/GodSmasher/patchbay" target="_blank" rel="noopener noreferrer" className={A}>github.com/GodSmasher/patchbay</a>. Every check has a <code>*.test.ts</code> file with documented cases.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-ink">Changelog</h2>
          <ul className="mt-3 list-disc pl-6 space-y-1 text-ink-soft">
            <li>2026-11-28: Initial version.</li>
          </ul>
        </section>
      </div>
    </main>
  )
}

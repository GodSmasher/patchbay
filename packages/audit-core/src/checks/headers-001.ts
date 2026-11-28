import type { Check, CheckOutput, Severity } from '../types'

/**
 * HEADERS-001: response-header posture (value-validation depth pass).
 *
 * The previous version of this check only looked at header presence
 * (missing XFO, missing HSTS, missing nosniff, wildcard CORS). That
 * meant a server with `X-Frame-Options: ALLOWALL` passed because *some*
 * header was set, even though the value itself provides no protection.
 * adam@trigger.tools-class credibility hit: anyone validating patchbay
 * against a well-known header-checker would spot the gap.
 *
 * This pass checks VALUES per-header and emits one sub-finding per
 * concrete gap with its own severity. Behaviour is deterministic and
 * side-effect-free: everything comes from the response headers already
 * captured by probeRemote().
 *
 * Sub-findings (peer-coordinated spec):
 *   .1   X-Frame-Options missing (and CSP frame-ancestors doesn't fill in)
 *   .2   X-Frame-Options value not DENY / SAMEORIGIN
 *   .3   X-Content-Type-Options missing
 *   .4   X-Content-Type-Options value not "nosniff"
 *   .5   Strict-Transport-Security missing on HTTPS
 *   .6   HSTS max-age too short (< 120 days, OWASP cheat sheet)
 *   .7   HSTS missing includeSubDomains
 *   .8   CSP contains unsafe-inline without a nonce/hash exception
 *   .9   CSP contains unsafe-eval
 *   .10  Referrer-Policy weak (unsafe-url / no-referrer-when-downgrade /
 *          origin-when-cross-origin) or missing
 *   .11  CORS wildcard with credentials (browser-rejected anti-pattern)
 *
 * Scope boundaries: this is value-validation only. Semantic CSP
 * analysis (per-directive allowlist review, hash/nonce verification
 * against actual script tags) belongs in a separate check (HEADERS-002)
 * when there's a request for it. Browser-behavioural testing is
 * explicitly out of scope — scanner stays deterministic.
 */

const MIN_HSTS_MAX_AGE_SECONDS = 10_368_000 // 120 days per OWASP Secure Headers project
const VALID_XFO = new Set(['DENY', 'SAMEORIGIN'])
const WEAK_REFERRER = new Set([
  'unsafe-url',
  'no-referrer-when-downgrade',
  'origin-when-cross-origin',
])

interface SubFinding {
  id: string
  severity: Severity
  title: string
  evidence: string
  fix: string
}

function parseHstsMaxAge(value: string): number | null {
  const m = value.match(/max-age\s*=\s*"?(\d+)"?/i)
  return m ? Number(m[1]) : null
}

function hasHstsFlag(value: string, flag: 'includesubdomains' | 'preload'): boolean {
  return new RegExp(`(^|[;\\s,])${flag}(\\s|;|,|$)`, 'i').test(value)
}

function cspUnsafeInlineWithoutException(csp: string): boolean {
  // `unsafe-inline` is only neutered when the same directive also carries
  // a nonce- or hash- source. We don't verify the nonce value matches an
  // actual tag — that's HEADERS-002 territory.
  if (!/'unsafe-inline'/i.test(csp)) return false
  const directives = csp.split(';').map((d) => d.trim()).filter(Boolean)
  for (const dir of directives) {
    if (!/'unsafe-inline'/i.test(dir)) continue
    if (/'nonce-[^']+'|'sha(256|384|512)-[^']+'|'strict-dynamic'/i.test(dir)) return false
  }
  return true
}

function parseFrameAncestors(csp: string): string | null {
  const m = csp.match(/frame-ancestors\s+([^;]+)/i)
  return m ? (m[1] ?? '').trim() : null
}

/**
 * Methodology metadata — read by scripts/generate-methodology-matrix.mjs
 * at build time to regenerate the check-to-source table on /methodology.
 * Keep in sync with any change to this check or its severity rationale.
 */
export const METADATA = {
  id: 'HEADERS-001',
  category: 'Transport headers',
  primarySource: 'RFC 6797 + RFC 7034 + CSP L3 + Referrer-Policy + Fetch + OWASP Secure Headers',
  confidence: 'HIGH',
  published: true,
} as const

export const headers001: Check = {
  id: 'HEADERS-001',
  severity: 'medium',
  title: 'Response-header posture',
  run: (snapshot): CheckOutput[] => {
    const r = snapshot.remote
    if (!r || !r.reachable || !r.responseHeaders) return []
    const h = r.responseHeaders
    const findings: SubFinding[] = []

    // .1 / .2 X-Frame-Options value validation. A frame-ancestors
    // directive in CSP overrides the need for XFO per the Fetch spec,
    // provided it's not a wildcard.
    const xfoRaw = h['x-frame-options']
    const csp = h['content-security-policy'] ?? ''
    const frameAncestors = parseFrameAncestors(csp)
    const frameAncestorsWildcard =
      frameAncestors === '*' || /(^|\s)\*(\s|$)/.test(frameAncestors ?? '')
    const frameAncestorsRestrictive = !!frameAncestors && !frameAncestorsWildcard
    if (!xfoRaw && !frameAncestorsRestrictive) {
      findings.push({
        id: 'HEADERS-001.1',
        severity: 'medium',
        title: 'X-Frame-Options missing',
        evidence: `No X-Frame-Options header${frameAncestorsWildcard ? ' and CSP frame-ancestors is wildcard `*` which is not a restriction' : ' and no frame-ancestors directive in Content-Security-Policy'}. Response can be framed from any origin.`,
        fix: "Set `X-Frame-Options: DENY` unless the endpoint must be framed, in which case set `X-Frame-Options: SAMEORIGIN`. Alternatively use `Content-Security-Policy: frame-ancestors 'self'` which takes precedence.",
      })
    } else if (xfoRaw) {
      // Case-sensitive per spec. Treating any non-DENY/SAMEORIGIN value
      // (ALLOWALL, ALLOW-FROM, malformed, lowercase) as a value gap.
      const xfo = xfoRaw.trim()
      if (!VALID_XFO.has(xfo)) {
        findings.push({
          id: 'HEADERS-001.2',
          severity: 'medium',
          title: 'X-Frame-Options value invalid',
          evidence: `X-Frame-Options is "${xfoRaw}". The spec only recognises DENY or SAMEORIGIN (case-sensitive); other values are ignored by browsers, so this gives no clickjacking protection.`,
          fix: 'Replace with exactly `X-Frame-Options: DENY` or `X-Frame-Options: SAMEORIGIN`. `ALLOW-FROM` is obsolete; `ALLOWALL` was never part of the spec.',
        })
      }
    }

    // .3 / .4 X-Content-Type-Options. "nosniff" is the only valid token.
    const xctoRaw = h['x-content-type-options']
    if (!xctoRaw) {
      findings.push({
        id: 'HEADERS-001.3',
        severity: 'medium',
        title: 'X-Content-Type-Options missing',
        evidence: 'No X-Content-Type-Options header. Browsers may MIME-sniff error responses and promote them to a different type than the server intended.',
        fix: 'Set `X-Content-Type-Options: nosniff` on every response.',
      })
    } else if (xctoRaw.trim().toLowerCase() !== 'nosniff') {
      findings.push({
        id: 'HEADERS-001.4',
        severity: 'medium',
        title: 'X-Content-Type-Options value invalid',
        evidence: `X-Content-Type-Options is "${xctoRaw}". "nosniff" is the only token browsers recognise; any other value is treated as missing.`,
        fix: 'Replace with exactly `X-Content-Type-Options: nosniff`.',
      })
    }

    // .5 / .6 / .7 HSTS. Only enforced on HTTPS endpoints.
    if (r.usesTls) {
      const hstsRaw = h['strict-transport-security']
      if (!hstsRaw) {
        findings.push({
          id: 'HEADERS-001.5',
          severity: 'high',
          title: 'Strict-Transport-Security missing',
          evidence: 'No Strict-Transport-Security header on an HTTPS endpoint. First-contact TLS stripping attacks are not blocked for new clients.',
          fix: 'Set `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` on every HTTPS response.',
        })
      } else {
        const maxAge = parseHstsMaxAge(hstsRaw)
        if (maxAge === null || maxAge < MIN_HSTS_MAX_AGE_SECONDS) {
          findings.push({
            id: 'HEADERS-001.6',
            severity: 'medium',
            title: 'HSTS max-age too short',
            evidence: `Strict-Transport-Security max-age is ${maxAge === null ? 'absent or unparseable' : `${maxAge} seconds`}, below the OWASP-recommended minimum of ${MIN_HSTS_MAX_AGE_SECONDS} (120 days). Browsers forget the policy quickly, re-opening the first-contact window.`,
            fix: 'Raise `max-age` to at least 15552000 (6 months) and ideally 31536000 (1 year) once you are sure HSTS causes no breakage.',
          })
        }
        // includeSubDomains is OWASP-recommended on apex hosts, lower
        // severity because many sub-domain deployments deliberately opt
        // out.
        if (!hasHstsFlag(hstsRaw, 'includesubdomains')) {
          findings.push({
            id: 'HEADERS-001.7',
            severity: 'low',
            title: 'HSTS missing includeSubDomains',
            evidence: 'Strict-Transport-Security has no `includeSubDomains` flag. A subdomain of this host can still be reached over plain HTTP by a first-time visitor.',
            fix: 'Add `includeSubDomains` to the HSTS header once every subdomain is HTTPS-only.',
          })
        }
      }
    }

    // .8 / .9 CSP value gaps.
    if (csp) {
      if (cspUnsafeInlineWithoutException(csp)) {
        findings.push({
          id: 'HEADERS-001.8',
          severity: 'medium',
          title: 'CSP uses unsafe-inline without nonce/hash exception',
          evidence: "Content-Security-Policy contains `'unsafe-inline'` but no nonce-, hash-, or strict-dynamic source in the same directive. Inline script and style execute unrestricted, which is what CSP is supposed to prevent.",
          fix: "Replace `'unsafe-inline'` with per-request nonces (`'nonce-<random>'`) or content hashes (`'sha256-<hash>'`). Keep `'unsafe-inline'` only as a fallback alongside `'strict-dynamic'`.",
        })
      }
      if (/'unsafe-eval'/i.test(csp)) {
        findings.push({
          id: 'HEADERS-001.9',
          severity: 'medium',
          title: 'CSP allows unsafe-eval',
          evidence: "Content-Security-Policy contains `'unsafe-eval'`. `eval`, `setTimeout(string)`, and `new Function(string)` are permitted, which is almost always unnecessary for API-backed MCP admin surfaces.",
          fix: "Remove `'unsafe-eval'` from the relevant directive. Audit any build-time template compilers (`Function(...)` in Vue 2, old Angular, etc.) that would break and move them to precompiled output.",
        })
      }
    }

    // .10 Referrer-Policy. Missing is OK (browser default is already
    // `strict-origin-when-cross-origin`), but explicitly weak values are
    // a signal of a leaking admin surface.
    const referrerRaw = h['referrer-policy']
    if (referrerRaw) {
      const value = referrerRaw.trim().toLowerCase()
      if (WEAK_REFERRER.has(value)) {
        findings.push({
          id: 'HEADERS-001.10',
          severity: 'low',
          title: 'Referrer-Policy weak',
          evidence: `Referrer-Policy is "${referrerRaw}". Full-URL (with path and query) referrers leak cross-origin on navigation and sub-resource requests, which can carry session tokens or MCP endpoint paths.`,
          fix: 'Set `Referrer-Policy: strict-origin-when-cross-origin` (the modern browser default) or stricter (`no-referrer`, `same-origin`, `strict-origin`).',
        })
      }
    }

    // .11 CORS wildcard with credentials. Browsers block this combo
    // outright, but servers that advertise it are almost always
    // misconfigured.
    const corsOrigin = h['access-control-allow-origin']
    const corsCreds = h['access-control-allow-credentials']
    if (corsOrigin === '*' && corsCreds?.toLowerCase() === 'true') {
      findings.push({
        id: 'HEADERS-001.11',
        severity: 'critical',
        title: 'CORS wildcard origin with credentials',
        evidence: 'Access-Control-Allow-Origin "*" combined with Access-Control-Allow-Credentials "true". Browsers reject this combination at request time, so it ships broken. More importantly it signals an auth model where the server trusted any origin with credentials, which is usually an auth bypass.',
        fix: 'If this endpoint is truly public (no credentials), remove the Credentials header. Otherwise echo the Origin header back for only your allowed origins and drop the wildcard.',
      })
    }

    if (findings.length === 0) return []

    return findings.map<CheckOutput>((f) => ({
      id: f.id,
      severity: f.severity,
      confidence: 'high',
      title: f.title,
      evidence: `At ${r.url}: ${f.evidence}`,
      fix: f.fix,
      docsUrl: 'https://patchbay-mcp.dev/docs/headers-001',
    }))
  },
}

import type { Check, Finding } from '../types'

/**
 * HEADERS-001: weak transport-security response headers.
 *
 * Browser-reachable MCP endpoints inherit the same browser attack surface
 * as any other HTTP service. Missing or over-permissive headers make the
 * server a cheap target for:
 *   - wildcard-CORS credential leaks: Access-Control-Allow-Origin: *
 *     together with Access-Control-Allow-Credentials: true is a browser
 *     anti-pattern and often an auth bypass.
 *   - cross-origin iframing + clickjacking of any browser-rendered admin
 *     surface on the same host: missing X-Frame-Options / no
 *     frame-ancestors in CSP.
 *   - downgrade attacks on first contact over HTTPS: missing HSTS.
 *   - MIME sniffing attacks on error responses: missing
 *     X-Content-Type-Options: nosniff.
 *
 * All four are passive (no additional request), driven by the headers
 * captured from the initialize probe. Fires medium per gap; aggregated
 * into one finding with a bulleted list in evidence.
 *
 * Skips when the server is not reachable (no headers to evaluate).
 * HSTS check skips on plain-HTTP targets (TRANSPORT-001 reports those).
 */
export const headers001: Check = {
  id: 'HEADERS-001',
  severity: 'medium',
  title: 'Weak transport-security response headers',
  run: (snapshot): Finding[] => {
    const r = snapshot.remote
    if (!r || !r.reachable || !r.responseHeaders) return []
    const h = r.responseHeaders

    const gaps: string[] = []

    const corsOrigin = h['access-control-allow-origin']
    const corsCreds = h['access-control-allow-credentials']
    if (corsOrigin === '*' && corsCreds?.toLowerCase() === 'true') {
      gaps.push('Access-Control-Allow-Origin "*" combined with Access-Control-Allow-Credentials "true" is a browser-rejected anti-pattern and often an auth-bypass misconfiguration.')
    } else if (corsOrigin === '*') {
      gaps.push('Access-Control-Allow-Origin "*" opens the server to any browser origin; acceptable only for fully public read-only endpoints.')
    }

    if (r.usesTls && !h['strict-transport-security']) {
      gaps.push('No Strict-Transport-Security header on an HTTPS endpoint. First-contact TLS stripping attacks are not blocked.')
    }

    const xfo = h['x-frame-options']
    const csp = h['content-security-policy'] ?? ''
    const hasFrameAncestors = /\bframe-ancestors\b/i.test(csp)
    if (!xfo && !hasFrameAncestors) {
      gaps.push('No X-Frame-Options and no frame-ancestors directive in Content-Security-Policy. Response can be framed cross-origin.')
    }

    const xcto = (h['x-content-type-options'] ?? '').toLowerCase()
    if (xcto !== 'nosniff') {
      gaps.push('X-Content-Type-Options is not "nosniff". Error responses may be MIME-sniffed by browsers.')
    }

    if (gaps.length === 0) return []

    return [
      {
        id: 'HEADERS-001',
        severity: 'medium',
        confidence: 'high',
        title: `${gaps.length} transport-security header gap(s)`,
        evidence: `At ${r.url}:\n- ${gaps.join('\n- ')}`,
        fix: 'Set the missing headers on every response from the MCP endpoint. Start with X-Content-Type-Options: nosniff, Strict-Transport-Security on HTTPS (max-age at least 15552000), and either X-Frame-Options: DENY or a Content-Security-Policy frame-ancestors directive. Review Access-Control-Allow-Origin if the endpoint is not meant to be reachable from arbitrary browser origins.',
        docsUrl: 'https://patchbay-mcp.dev/docs/headers-001',
      },
    ]
  },
}

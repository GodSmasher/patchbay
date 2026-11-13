import type { Check, Finding, ResourceDescriptor } from '../types'

/**
 * URITEMPLATE-001: resource URI templates (RFC 6570) that expand to
 * path-traversal-shaped values.
 *
 * MCP servers advertise parameterised resources via
 * resources/templates/list with an `uriTemplate` string like
 * `file:///docs/{path}` or `s3://bucket/{path*}`. When the server
 * naively inserts the parameter into the filesystem path or S3 key
 * without sanitisation, a client (or a model manipulated into picking
 * values) can read anything the process has access to:
 *
 *   {path} = ../../etc/passwd
 *   {path} = ..%2F..%2F..%2Froot%2F.ssh%2Fid_rsa
 *   {path} = /etc/shadow
 *
 * We can't test the server's sanitisation remotely without actually
 * calling resources/read with a malicious value — and that's an active
 * probe we don't do against third-party hosts. So this check is
 * strictly a METADATA check: it reads the uriTemplate string and flags
 * three shapes that indicate the template author didn't scope the
 * parameter:
 *
 *   high: {path*} explode (RFC 6570 unbounded path expansion) directly
 *         into a filesystem-looking scheme (file:// or no scheme with
 *         a / path) or into a bucket key
 *   medium: {name} (simple string) directly in a filesystem path
 *         segment with no obvious prefix constraint
 *   info: same but in a non-filesystem scheme (https://, custom://) —
 *         still worth noting but less likely to be local path traversal
 */
export const uriTemplate001: Check = {
  id: 'URITEMPLATE-001',
  severity: 'high',
  title: 'Resource URI template expands without path-traversal guards',
  run: (snapshot): Finding[] => {
    const resources = snapshot.remote?.resources ?? []
    const templates = resources.filter((r) => r.uriTemplate)
    if (templates.length === 0) return []

    const highHits: Array<{ tpl: string; name?: string }> = []
    const mediumHits: Array<{ tpl: string; name?: string }> = []

    for (const r of templates) {
      const tpl = r.uriTemplate!
      const classification = classify(tpl, r)
      if (classification === 'high') highHits.push({ tpl, name: r.name })
      else if (classification === 'medium') mediumHits.push({ tpl, name: r.name })
    }

    const findings: Finding[] = []
    if (highHits.length > 0) {
      const sample = highHits.slice(0, 5).map((h) => (h.name ? h.name + ' — ' : '') + h.tpl).join('; ')
      findings.push({
        id: 'URITEMPLATE-001',
        severity: 'high',
        confidence: 'medium',
        title: 'Resource URI template with unbounded path expansion',
        evidence: highHits.length + ' resource template(s) use RFC 6570 `{path*}` (or an equivalent unbounded string) directly inside a filesystem-shaped scheme: ' + sample + '. Without an allowlist on the server side, a client supplying `../../etc/passwd` or `..%2F..%2F..%2F` sequences can walk out of the intended root and read arbitrary files the MCP process has access to.',
        fix: 'Scope the template to a specific base directory and enforce it server-side. Reject expansions that contain `..`, `./`, URL-encoded path separators (`%2F`, `%5C`), absolute paths or null bytes before resolving the resource. Prefer `{id}` with a server-maintained id→path mapping over `{path}` or `{path*}` for raw filesystem exposure. The Python MCP SDK ships `secure_filename`-style helpers; many other SDKs do not.',
        docsUrl: 'https://patchbay-mcp.dev/docs/uritemplate-001',
      })
    }
    if (mediumHits.length > 0) {
      const sample = mediumHits.slice(0, 5).map((h) => (h.name ? h.name + ' — ' : '') + h.tpl).join('; ')
      findings.push({
        id: 'URITEMPLATE-001',
        severity: 'medium',
        confidence: 'low',
        title: 'Resource URI template with ungated path parameter',
        evidence: mediumHits.length + ' resource template(s) place a simple string parameter directly inside a filesystem-shaped scheme: ' + sample + '. The parameter is bounded to a single path segment by RFC 6570, but without server-side sanitisation an attacker can still smuggle path separators via URL-encoding.',
        fix: 'Even a single-segment parameter (`{name}`) needs `..`, `%2F`, `%5C`, absolute-path and null-byte checks at the resolve boundary. Prefer indirection (`{id}` → server-side lookup) over raw filesystem-shaped exposure.',
        docsUrl: 'https://patchbay-mcp.dev/docs/uritemplate-001',
      })
    }

    return findings
  },
}

function classify(tpl: string, r: ResourceDescriptor): 'high' | 'medium' | 'info' | null {
  // Only consider filesystem-shaped schemes — https:// templates are
  // overwhelmingly intentional parameterisation of a REST API, not file
  // retrieval. file://, no-scheme, s3://, gs://, azure:// all count.
  const scheme = tpl.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase()
  const fsLike = !scheme
    || scheme === 'file'
    || scheme === 's3' || scheme === 'gs' || scheme === 'azure' || scheme === 'b2'
    || scheme === 'ftp' || scheme === 'sftp' || scheme === 'smb'
  if (!fsLike) return 'info'

  const hasPathExplode = /\{[^}]*\*[^}]*\}/.test(tpl)  // {path*} or similar
  const hasSimpleParam = /\{[^*}]+\}/.test(tpl)

  if (hasPathExplode) return 'high'
  if (hasSimpleParam) {
    // Medium only when the parameter is inside a path segment that looks
    // like a file retrieval (last segment is the parameter and preceding
    // segments don't look like API endpoints).
    const segments = tpl.split('/').filter(Boolean)
    const last = segments[segments.length - 1] ?? ''
    if (/^\{[^*}]+\}$/.test(last) || last.includes('{') && last.endsWith('}')) return 'medium'
  }
  void r
  return null
}

import type { Check, CheckOutput } from '../types'

/**
 * AUTHORITY-ATTESTATION-001 (info): server advertises an off-chain
 * authority attestation.
 *
 * Fires as info-level when the MCP endpoint's response headers include
 * any of:
 *   - X-MCP-Authority: did:web:<domain>  (or another DID)
 *   - Link: rel="authority-attestation" pointing at a signed document
 *   - Link: rel="mcp-manifest" pointing at a /.well-known/mcp-manifest
 *
 * These are not in the MCP spec yet. First observed in the wild on
 * jasswiki.ch (Swiss Jass Federation attestation via did:web:jassverband.ch).
 * In high-stakes domains (medical, legal, financial, regulatory) clients
 * need to distinguish an authoritative domain source from a scraper
 * repackaging the same data; DID-based attestation closes that gap.
 *
 * Info severity: this is a POSITIVE pattern worth surfacing, not a
 * defect. Reports and the leaderboard entry page can style info-level
 * positive findings differently from info-level deficiencies.
 */
/**
 * Methodology metadata — read by scripts/generate-methodology-matrix.mjs
 * at build time to regenerate the check-to-source table on /methodology.
 * Keep in sync with any change to this check or its severity rationale.
 */
export const METADATA = {
  id: 'AUTHORITY-ATTESTATION-001',
  category: 'MCP',
  primarySource: 'patchbay-original: positive pattern — server advertises an MCP authority-attestation header',
  confidence: 'MEDIUM',
  published: true,
} as const

export const authorityAttestation001: Check = {
  id: 'AUTHORITY-ATTESTATION-001',
  severity: 'info',
  title: 'Server advertises off-chain authority attestation',
  run: (snapshot): CheckOutput[] => {
    const r = snapshot.remote
    if (!r || !r.responseHeaders) return []
    const headers = r.responseHeaders

    const didHeader = headers['x-mcp-authority']
    const linkHeader = headers['link'] || ''
    const hasAttestationLink = /rel="authority-attestation"/i.test(linkHeader)
    const hasManifestLink = /rel="mcp-manifest"/i.test(linkHeader)

    if (!didHeader && !hasAttestationLink && !hasManifestLink) return []

    const signals: string[] = []
    if (didHeader) signals.push(`X-MCP-Authority: ${didHeader}`)
    if (hasAttestationLink) {
      const m = /<([^>]+)>;\s*rel="authority-attestation"/i.exec(linkHeader)
      signals.push(m ? `Link rel=authority-attestation → ${m[1]}` : 'Link rel=authority-attestation')
    }
    if (hasManifestLink) {
      const m = /<([^>]+)>;\s*rel="mcp-manifest"/i.exec(linkHeader)
      signals.push(m ? `Link rel=mcp-manifest → ${m[1]}` : 'Link rel=mcp-manifest')
    }

    return [
      {
        id: 'AUTHORITY-ATTESTATION-001',
        severity: 'info',
        confidence: 'high',
        title: 'Server advertises off-chain authority attestation',
        evidence: `${r.url} advertises authority-attestation signals in its response headers: ${signals.join('; ')}. The MCP specification does not define authority attestation yet; this is a forward-looking pattern that anchors the server's domain-authority to a verifiable off-chain identity.`,
        fix: 'No action required. This is a positive signal reported as info-level for operators who may want to surface it in client UIs.',
        docsUrl: 'https://patchbay-mcp.dev/docs/authority-attestation-001',
      },
    ]
  },
}

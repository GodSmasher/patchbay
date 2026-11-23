import type { Check, CheckOutput } from '../types'

/**
 * DUAL-RESOURCE-001 (high): server advertises TWO Protected Resource
 * Metadata sources that disagree on which authorization server issues
 * tokens for this resource.
 *
 * The "Angelcam pattern": a server exposes one authorization_servers
 * set via the WWW-Authenticate challenge's `resource_metadata=` link,
 * and a different set via the conventional
 * `/.well-known/oauth-protected-resource` document. A client that
 * discovers via the challenge obtains a token from AS-A; the server's
 * token validator trusts AS-B. The two accept different audiences,
 * scopes or token lifetimes, and an attacker who can obtain a token
 * from the weaker AS can present it to a resource whose stronger AS
 * believed it was the only issuer.
 *
 * The MCP spec revision 2025-06-18 says a server MUST advertise its
 * PRM, and clients MAY follow either discovery path. The spec does not
 * forbid advertising both, but it does require them to be consistent;
 * RFC 9728 §3.3 reiterates this (a `resource_metadata=` link in the
 * challenge is a pointer, not a shortcut around the well-known doc).
 *
 * Fires at high severity because a skew between the two documents is a
 * token-confusion surface: it is a defect even without an attacker.
 */
export const dualResource001: Check = {
  id: 'DUAL-RESOURCE-001',
  severity: 'high',
  title: 'Divergent Protected Resource Metadata sources',
  run: (snapshot): CheckOutput[] => {
    const r = snapshot.remote
    if (!r) return []

    const challenge = r.invalidTokenWwwAuthenticate || ''
    if (!challenge) return []

    const metaUrl = extractResourceMetadata(challenge)
    if (!metaUrl) return []

    const wellKnown = r.oauthProtectedResource
    if (!wellKnown || typeof wellKnown !== 'object') return []

    const wellKnownAs = normalizeAsList((wellKnown as Record<string, unknown>).authorization_servers)
    if (!wellKnownAs) return []

    const challengeAs = extractScope(challenge, 'authorization_uri')
      || extractScope(challenge, 'as_uri')

    const resourceField = typeof (wellKnown as Record<string, unknown>).resource === 'string'
      ? ((wellKnown as Record<string, unknown>).resource as string)
      : undefined

    const skews: string[] = []

    if (metaUrl && resourceField && !sameHost(metaUrl, resourceField)) {
      skews.push(
        `WWW-Authenticate resource_metadata points to ${metaUrl} but the well-known PRM declares resource=${resourceField}`,
      )
    }

    if (challengeAs && !wellKnownAs.some((as) => sameHost(as, challengeAs))) {
      skews.push(
        `WWW-Authenticate authorization_uri=${challengeAs} is not in the well-known PRM's authorization_servers (${wellKnownAs.join(', ')})`,
      )
    }

    if (metaUrl && !sameHost(metaUrl, r.url)) {
      skews.push(
        `WWW-Authenticate resource_metadata=${metaUrl} sits on a different host than this resource (${r.url})`,
      )
    }

    if (skews.length === 0) return []

    return [
      {
        id: 'DUAL-RESOURCE-001',
        severity: 'high',
        confidence: 'high',
        title: 'Divergent Protected Resource Metadata sources',
        evidence:
          `${r.url} advertises Protected Resource Metadata through two sources that disagree: `
          + skews.join('; ')
          + `. A client that discovers the resource server via the WWW-Authenticate challenge will get a different authorization server than one that discovers via /.well-known/oauth-protected-resource. If either authorization server is weaker than the other on audience, scope or token-lifetime enforcement, a token issued by the weaker AS can be accepted here. This is a token-confusion surface even without an attacker: it reflects an incomplete migration between auth providers.`,
        fix:
          'Pick one authorization-server set and make both discovery paths return it. Either (a) remove the `resource_metadata=` parameter from the WWW-Authenticate challenge and keep only /.well-known/oauth-protected-resource, or (b) point `resource_metadata=` at the exact same URL as the well-known document. Verify that the `authorization_servers` arrays are byte-identical and that the `resource` field matches this endpoint. If this server recently migrated between auth providers, remove the stale PRM artefacts from the previous provider.',
        docsUrl: 'https://patchbay-mcp.dev/docs/dual-resource-001',
      },
    ]
  },
}

/**
 * Extract the `resource_metadata` parameter from a WWW-Authenticate
 * challenge. The header is a comma-separated set of Bearer
 * `key="value"` pairs per RFC 6750 §3.
 */
function extractResourceMetadata(challenge: string): string | undefined {
  const m = /resource_metadata\s*=\s*"([^"]+)"/i.exec(challenge)
    || /resource_metadata\s*=\s*([^\s,]+)/i.exec(challenge)
  return m?.[1]
}

function extractScope(challenge: string, key: string): string | undefined {
  const quoted = new RegExp(`${key}\\s*=\\s*"([^"]+)"`, 'i')
  const bare = new RegExp(`${key}\\s*=\\s*([^\\s,]+)`, 'i')
  return quoted.exec(challenge)?.[1] || bare.exec(challenge)?.[1]
}

function normalizeAsList(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out = v.filter((s): s is string => typeof s === 'string' && s.length > 0)
  return out.length > 0 ? out : undefined
}

function sameHost(a: string, b: string): boolean {
  try {
    return new URL(a).host.toLowerCase() === new URL(b).host.toLowerCase()
  } catch {
    return a === b
  }
}

import type { Check, CheckOutput } from '../types'

/**
 * Methodology metadata — read by scripts/generate-methodology-matrix.mjs
 * at build time to regenerate the check-to-source table on /methodology.
 * Keep in sync with any change to this check or its severity rationale.
 */
export const METADATA = {
  id: 'SECRET-002',
  category: 'Config',
  primarySource: 'Env-variable leakage pattern; patchbay-original',
  confidence: 'CONTEXTUAL',
  published: true,
} as const

export const secret002: Check = {
  id: 'SECRET-002',
  severity: 'medium',
  title: 'Secret from env with no refresh path',
  run: (snapshot): CheckOutput[] => {
    const d = snapshot.directory
    if (!d) return []
    if (d.secretEnvVarsUsed.length === 0) return []
    if (d.hasRefreshTokenPath) return []
    return [
      {
        id: 'SECRET-002',
        severity: 'medium',
        confidence: 'medium',
        title: 'Long-lived credential in env, no refresh flow found',
        evidence: `Env vars read as credentials: ${d.secretEnvVarsUsed.join(', ')}. No refresh_token request found in source.`,
        fix: 'Switch to OAuth 2.1 refresh tokens. Rotate at least every 24h; never store long-lived API keys as the only credential.',
        docsUrl: 'https://patchbay-mcp.dev/docs/secret-002',
        autofixTemplate: 'oauth21',
      },
    ]
  },
}

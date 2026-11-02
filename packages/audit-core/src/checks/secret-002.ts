import type { Check, Finding } from '../types'

export const secret002: Check = {
  id: 'SECRET-002',
  severity: 'medium',
  title: 'Secret from env with no refresh path',
  run: (snapshot): Finding[] => {
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
        docsUrl: 'https://patchbay.dev/docs/secret-002',
        autofixTemplate: 'oauth21',
      },
    ]
  },
}

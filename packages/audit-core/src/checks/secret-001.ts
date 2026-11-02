import type { Check, Finding } from '../types'

export const secret001: Check = {
  id: 'SECRET-001',
  severity: 'critical',
  title: 'Hardcoded secret in source',
  run: (snapshot): Finding[] => {
    const d = snapshot.directory
    if (!d || d.secretHits.length === 0) return []
    return d.secretHits.map((hit) => ({
      id: 'SECRET-001',
      severity: 'critical' as const,
      confidence: 'high' as const,
      title: `Hardcoded secret in ${hit.path}:${hit.line}`,
      evidence: `Pattern "${hit.pattern}" matched: ${redact(hit.match)}`,
      fix: 'Move the secret into an environment variable or secret manager. Rotate the leaked value immediately; assume it is public.',
      docsUrl: 'https://patchbay-mcp.dev/docs/secret-001',
    }))
  },
}

function redact(s: string): string {
  if (s.length <= 8) return '***'
  return `${s.slice(0, 4)}…${s.slice(-2)}`
}

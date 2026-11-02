import type { Check, Finding } from '../types'

import { isRead, isWrite } from './tool-shapes'

export const scope002: Check = {
  id: 'SCOPE-002',
  severity: 'medium',
  title: 'Write and read tools share scope',
  run: (snapshot): Finding[] => {
    const manifest = scopeManifest(snapshot)
    if (!manifest) return []
    const findings: Finding[] = []
    const seen = new Set<string>()
    for (const [tool, scopes] of Object.entries(manifest)) {
      if (!isWrite(tool)) continue
      for (const scope of scopes) {
        if (seen.has(scope)) continue
        seen.add(scope)
        const shared = Object.entries(manifest).filter(([other, oscopes]) => other !== tool && oscopes.includes(scope) && isRead(other)).map(([other]) => other)
        if (shared.length > 0) {
          findings.push({
            id: 'SCOPE-002',
            severity: 'medium',
            confidence: 'medium',
            title: `Scope ${scope} covers both write (${tool}) and read (${shared.join(', ')})`,
            evidence: `Tool ${tool} is a write/destructive operation but shares scope ${scope} with read tools: ${shared.join(', ')}.`,
            fix: 'Split write and read into separate scopes so revoking write access does not revoke reads (and vice versa).',
            docsUrl: 'https://patchbay-mcp.dev/docs/scope-002',
            autofixTemplate: 'scopes',
          })
        }
      }
    }
    return findings
  },
}

function scopeManifest(snapshot: Parameters<Check['run']>[0]): Record<string, string[]> | undefined {
  if (snapshot.directory?.scopeManifest) return snapshot.directory.scopeManifest
  const r = snapshot.remote
  if (!r || r.tools.length === 0) return undefined
  const map: Record<string, string[]> = {}
  for (const t of r.tools) if (Array.isArray(t.scopes)) map[t.name] = t.scopes
  return Object.keys(map).length > 0 ? map : undefined
}

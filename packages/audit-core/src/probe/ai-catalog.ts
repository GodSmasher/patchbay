/**
 * AI-catalog detection: when a server publishes /.well-known/ai-catalog.json
 * (or a similar doc) that explicitly declares a no-auth posture, we treat its
 * MCP endpoint as public-by-design instead of flagging missing auth as critical.
 *
 * The format is not yet standardised. The MCP community uses several shapes:
 *
 *   { "authentication": "none" }
 *   { "auth_required": false }
 *   { "public": true }
 *   { "mcp": { "authentication": "none" } }
 *   { "servers": [ { "url": "...", "authentication": "none" } ] }
 *
 * We also recognise an explicit text field like
 *   { "notes": "No API key required ..." }
 *
 * Any match sets publicByDesign=true with a short human-readable evidence
 * string pointing at the key/value that triggered the decision.
 */

export interface PublicByDesignDetection {
  publicByDesign: true
  evidence: string
}

export function detectPublicByDesign(doc: unknown): PublicByDesignDetection | null {
  if (!doc || typeof doc !== 'object') return null
  return walk(doc as Record<string, unknown>, [])
}

const NO_AUTH_VALUES = new Set(['none', 'public', 'optional', 'no-auth', 'noauth'])
const TEXT_PATTERNS = [
  /no (api )?key (is )?required/i,
  /no auth(entication)? (is )?required/i,
  /public(ly)? accessible/i,
  /no credentials? (needed|required)/i,
]

function walk(node: Record<string, unknown>, path: string[]): PublicByDesignDetection | null {
  for (const [key, value] of Object.entries(node)) {
    const here = [...path, key]

    if (key === 'authentication' || key === 'auth') {
      if (typeof value === 'string' && NO_AUTH_VALUES.has(value.toLowerCase())) {
        return { publicByDesign: true, evidence: `${here.join('.')}: "${value}"` }
      }
    }
    if (key === 'auth_required' || key === 'authRequired' || key === 'requires_auth') {
      if (value === false) {
        return { publicByDesign: true, evidence: `${here.join('.')}: false` }
      }
    }
    if (key === 'public') {
      if (value === true) {
        return { publicByDesign: true, evidence: `${here.join('.')}: true` }
      }
    }

    if (typeof value === 'string') {
      for (const re of TEXT_PATTERNS) {
        if (re.test(value)) {
          const snippet = value.length > 80 ? value.slice(0, 80) + '…' : value
          return { publicByDesign: true, evidence: `${here.join('.')}: "${snippet}"` }
        }
      }
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const inner = walk(value as Record<string, unknown>, here)
      if (inner) return inner
    }
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i]
        if (item && typeof item === 'object') {
          const inner = walk(item as Record<string, unknown>, [...here, String(i)])
          if (inner) return inner
        }
      }
    }
  }
  return null
}

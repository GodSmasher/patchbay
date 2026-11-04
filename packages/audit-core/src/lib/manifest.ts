import { createHash } from 'node:crypto'
import type { ManifestDelta, ManifestDeltaItem, ManifestEntry, ToolDescriptor } from '../types'

/**
 * Canonical JSON for hashing: sort object keys, sort tool array by name,
 * drop null / undefined values. JCS-style (RFC 8785-adjacent) so a server
 * that just reorders fields between runs does not produce false alarms.
 */
export function canonicalise(value: unknown): unknown {
  if (value === null || value === undefined) return undefined
  if (Array.isArray(value)) {
    const items = value.map(canonicalise).filter((v) => v !== undefined)
    return items
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).sort()
    const out: Record<string, unknown> = {}
    for (const k of keys) {
      const v = canonicalise(obj[k])
      if (v !== undefined) out[k] = v
    }
    return out
  }
  return value
}

/**
 * Sort the tool list by name and canonicalise each tool's fields so the
 * hash is stable across arbitrary server-side field reordering.
 */
export function canonicaliseTools(tools: ToolDescriptor[]): ToolDescriptor[] {
  const sorted = [...tools].sort((a, b) => a.name.localeCompare(b.name))
  return sorted.map((t) => canonicalise(t) as ToolDescriptor)
}

export function hashManifest(tools: ToolDescriptor[]): string {
  const canonical = canonicaliseTools(tools)
  const json = JSON.stringify(canonical)
  return 'sha256:' + createHash('sha256').update(json).digest('hex')
}

/**
 * Deterministic server id for state file naming.
 *   HTTP: sha256 of the URL
 *   stdio (future): sha256 of binary path + args
 */
export function serverIdFromUrl(url: string): string {
  return 'http:' + createHash('sha256').update(url).digest('hex').slice(0, 16)
}

export function serverIdFromStdio(binary: string, args: string[]): string {
  const payload = JSON.stringify([binary, args])
  return 'stdio:' + createHash('sha256').update(payload).digest('hex').slice(0, 16)
}

/**
 * Compare pinned manifest against the current tool list and emit a delta.
 * Returns an empty delta (no changes) when the manifests are equivalent.
 */
export function diffManifest(pinned: ManifestEntry, currentTools: ToolDescriptor[]): ManifestDelta {
  const currentHash = hashManifest(currentTools)
  const changes: ManifestDeltaItem[] = []

  if (pinned.pinnedHash === currentHash) {
    return {
      serverId: pinned.serverId,
      pinnedHash: pinned.pinnedHash,
      currentHash,
      changes: [],
      firstSeen: pinned.firstSeen,
    }
  }

  const pinnedByName = new Map(pinned.tools.map((t) => [t.name, t]))
  const currentByName = new Map(currentTools.map((t) => [t.name, t]))

  for (const name of currentByName.keys()) {
    if (!pinnedByName.has(name)) {
      changes.push({ kind: 'tool-added', toolName: name })
    }
  }
  for (const name of pinnedByName.keys()) {
    if (!currentByName.has(name)) {
      changes.push({ kind: 'tool-removed', toolName: name })
    }
  }

  for (const [name, cur] of currentByName.entries()) {
    const prev = pinnedByName.get(name)
    if (!prev) continue

    const prevDesc = (prev.description ?? '').trim()
    const curDesc = (cur.description ?? '').trim()
    if (prevDesc !== curDesc) {
      changes.push({
        kind: 'description-changed',
        toolName: name,
        detail: `${prevDesc.length} chars -> ${curDesc.length} chars`,
      })
    }

    const prevSchema = JSON.stringify(canonicalise(prev.inputSchema ?? null))
    const curSchema = JSON.stringify(canonicalise(cur.inputSchema ?? null))
    if (prevSchema !== curSchema) {
      const newKeys = detectNewSchemaKeys(prev.inputSchema, cur.inputSchema)
      changes.push({
        kind: 'input-schema-changed',
        toolName: name,
        detail: newKeys.length ? `new params: ${newKeys.join(', ')}` : 'schema structure changed',
      })
    }
  }

  return {
    serverId: pinned.serverId,
    pinnedHash: pinned.pinnedHash,
    currentHash,
    changes,
    firstSeen: pinned.firstSeen,
  }
}

/**
 * Pull out the names of properties that appear in `current` but not in
 * `pinned`. Handles the common JSON Schema shape `{properties: {...}}`.
 * Used by diffManifest to produce a human-readable detail string.
 */
function detectNewSchemaKeys(pinned: unknown, current: unknown): string[] {
  const prevProps = extractProperties(pinned)
  const curProps = extractProperties(current)
  if (!prevProps || !curProps) return []
  const added: string[] = []
  for (const k of Object.keys(curProps)) {
    if (!(k in prevProps)) added.push(k)
  }
  return added
}

function extractProperties(schema: unknown): Record<string, unknown> | null {
  if (!schema || typeof schema !== 'object') return null
  const obj = schema as Record<string, unknown>
  const props = obj.properties
  if (!props || typeof props !== 'object') return null
  return props as Record<string, unknown>
}

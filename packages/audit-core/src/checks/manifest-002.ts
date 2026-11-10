import type { Check, Finding, ManifestDelta, ManifestDeltaItem, Severity } from '../types'

/**
 * MANIFEST-002: classifies a manifest delta into breaking, additive and
 * semantic-drift buckets, one finding per non-empty bucket.
 *
 * MANIFEST-001 fires one summary finding at the worst severity across any
 * change ("something changed, here is the highest-tier severity"). That is
 * useful as a single pin-check gate. MANIFEST-002 is the complement: for
 * teams that want actionable alerting it says WHAT kind of change
 * happened, so a reviewer can tell at a glance whether the change needs
 * code changes on the client side.
 *
 * Buckets:
 *   breaking (critical): change forces existing clients to break.
 *     - tool-removed
 *     - param-removed on an existing tool
 *     - param-made-required
 *     - param-type-changed (e.g. string -> integer, any -> number)
 *     - param-enum-shrunk (removed values a client may still be sending)
 *   additive (low): change can only be observed by new client code.
 *     - tool-added
 *     - param-added
 *     - input-schema-changed with no fine-grained flag below it (rare)
 *   semantic-drift (medium): the shape is identical but the meaning the
 *     model will read drifts.
 *     - description-changed (tool-level)
 *
 * Both MANIFEST-001 and MANIFEST-002 fire on the same delta. 001 is the
 * single-line alert; 002 is the breakdown.
 */
export const manifest002: Check = {
  id: 'MANIFEST-002',
  severity: 'medium',
  title: 'Manifest change classified',
  run: (snapshot): Finding[] => {
    const source = snapshot.remote?.manifestDelta
      ? { delta: snapshot.remote.manifestDelta, surface: `at ${snapshot.remote.url}` }
      : snapshot.stdio?.manifestDelta
        ? { delta: snapshot.stdio.manifestDelta, surface: `from stdio: ${snapshot.stdio.command}` }
        : null
    if (!source || source.delta.changes.length === 0) return []

    const { delta, surface } = source
    const buckets = bucketChanges(delta)

    const out: Finding[] = []
    if (buckets.breaking.length) {
      out.push({
        id: 'MANIFEST-002',
        severity: 'critical',
        confidence: 'high',
        title: `Breaking manifest change(s): ${buckets.breaking.length} item(s)`,
        evidence: renderBucket('Breaking (will break existing clients)', buckets.breaking, delta, surface),
        fix: 'Treat this like a major-version bump of the server. Notify clients before deploying, or hold back until clients upgrade. If the change was unintended, roll back the server.',
        docsUrl: 'https://patchbay-mcp.dev/docs/manifest-002',
      })
    }
    if (buckets.semantic.length) {
      out.push({
        id: 'MANIFEST-002',
        severity: 'medium',
        confidence: 'medium',
        title: `Semantic drift in tool description(s): ${buckets.semantic.length} item(s)`,
        evidence: renderBucket('Semantic drift (shape unchanged, meaning changed)', buckets.semantic, delta, surface),
        fix: 'Review the description diff. A rewritten tool description changes how the LLM uses the tool and can introduce new behaviours without any schema change. Confirm the new text matches the tool\'s actual behaviour. If accepted, re-pin with `--trust`.',
        docsUrl: 'https://patchbay-mcp.dev/docs/manifest-002',
      })
    }
    if (buckets.additive.length) {
      out.push({
        id: 'MANIFEST-002',
        severity: 'low',
        confidence: 'high',
        title: `Additive manifest change(s): ${buckets.additive.length} item(s)`,
        evidence: renderBucket('Additive (existing clients keep working)', buckets.additive, delta, surface),
        fix: 'No action required for existing clients. If you want to use the new surface, update your client. Re-pin with `--trust` once reviewed.',
        docsUrl: 'https://patchbay-mcp.dev/docs/manifest-002',
      })
    }

    return out
  },
}

interface Buckets {
  breaking: ManifestDeltaItem[]
  additive: ManifestDeltaItem[]
  semantic: ManifestDeltaItem[]
}

function bucketChanges(delta: ManifestDelta): Buckets {
  const breaking: ManifestDeltaItem[] = []
  const additive: ManifestDeltaItem[] = []
  const semantic: ManifestDeltaItem[] = []

  for (const c of delta.changes) {
    switch (c.kind) {
      case 'tool-removed':
      case 'param-removed':
      case 'param-made-required':
      case 'param-type-changed':
      case 'param-enum-shrunk':
        breaking.push(c)
        break
      case 'tool-added':
      case 'param-added':
        additive.push(c)
        break
      case 'description-changed':
        semantic.push(c)
        break
      case 'input-schema-changed':
        // The coarse kind is accompanied by fine-grained param-* items
        // elsewhere in the same delta. Suppress it here to avoid double
        // counting; if no fine-grained item followed it, treat as additive
        // (safest default: shape changed but not in a way we detected).
        break
    }
  }

  // If there was an input-schema-changed but no fine-grained kids for it,
  // record one additive item per affected tool so the report is not silent.
  const toolsWithSchemaChange = new Set(
    delta.changes.filter((c) => c.kind === 'input-schema-changed').map((c) => c.toolName),
  )
  const toolsWithFineGrained = new Set(
    delta.changes
      .filter((c) =>
        c.kind === 'param-added' || c.kind === 'param-removed'
        || c.kind === 'param-made-required' || c.kind === 'param-type-changed'
        || c.kind === 'param-enum-shrunk',
      )
      .map((c) => c.toolName),
  )
  for (const name of toolsWithSchemaChange) {
    if (!toolsWithFineGrained.has(name)) {
      additive.push({ kind: 'input-schema-changed', toolName: name, detail: 'schema structure changed (no fine-grained diff available)' })
    }
  }

  return { breaking, additive, semantic }
}

function renderBucket(
  title: string,
  items: ManifestDeltaItem[],
  delta: ManifestDelta,
  surface: string,
): string {
  const lines: string[] = []
  lines.push(`${title} ${surface}.`)
  lines.push(`Pinned on ${delta.firstSeen}, re-scanned now.`)
  lines.push('')
  for (const c of items) {
    const detail = c.detail ? ` (${c.detail})` : ''
    lines.push(`  - ${c.kind}: ${c.toolName}${detail}`)
  }
  return lines.join('\n')
}

// Silence unused param warning for Severity in some lint setups.
void (null as unknown as Severity)

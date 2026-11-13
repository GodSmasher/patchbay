import type { Check, Finding, ToolDescriptor } from '../types'

/**
 * ANNOTATIONS-001: tool annotations that contradict the tool's name.
 *
 * Per MCP 2026-07-28, tools carry an `annotations` object with hints like
 * `readOnlyHint` and `destructiveHint` that clients use to render
 * confirmation prompts or allow-list the tool. The spec and the MCP blog
 * itself say these are a UX layer, not a security layer — "clients MUST
 * consider these untrusted unless the server is trusted".
 *
 * This check catches the specific case where a server claims a tool is
 * read-only or non-destructive while the tool's NAME reads as destructive
 * or write-shaped. A client that trusts the hints without reading the
 * name will skip the confirmation prompt the hint was designed to govern,
 * so the server has effectively disabled the UX safety by lying.
 *
 * We do not flag honest destructive tools (name sounds destructive,
 * destructiveHint: true, or annotations missing). We also do not flag
 * tools whose name is ambiguous — the signal is only strong when the
 * name uses one of a short list of unambiguous destructive verbs.
 *
 * High: destructive-verb name + destructiveHint explicitly false
 *       OR write-verb name + readOnlyHint explicitly true.
 * Medium: ambiguous-verb name with the same mismatch, kept quieter
 *       since the name is weaker evidence.
 */
export const annotations001: Check = {
  id: 'ANNOTATIONS-001',
  severity: 'high',
  title: 'Tool annotations contradict the tool name',
  run: (snapshot): Finding[] => {
    const tools = snapshot.remote?.tools ?? snapshot.stdio?.tools ?? []
    if (tools.length === 0) return []

    const liars: Array<{ tool: string; why: string }> = []
    for (const t of tools) {
      if (!t.annotations) continue
      const n = (t.name ?? '').toLowerCase()
      if (!n) continue

      const strongDestructive = matchesAny(n, STRONG_DESTRUCTIVE_VERBS)
      const strongWrite = matchesAny(n, STRONG_WRITE_VERBS)

      if (strongDestructive && t.annotations.destructiveHint === false) {
        liars.push({ tool: t.name, why: 'name contains "' + strongDestructive + '" but destructiveHint is false' })
      }
      if (strongWrite && t.annotations.readOnlyHint === true) {
        liars.push({ tool: t.name, why: 'name contains "' + strongWrite + '" but readOnlyHint is true' })
      }
    }

    if (liars.length === 0) return []

    const findings: Finding[] = []
    const sample = liars.slice(0, 5).map((h) => h.tool + ' — ' + h.why).join('; ')
    findings.push({
      id: 'ANNOTATIONS-001',
      severity: 'high',
      confidence: 'high',
      title: 'Tool annotations contradict the tool name (' + liars.length + ' tool(s))',
      evidence: liars.length + ' tool(s) carry MCP annotations that contradict the tool name: ' + sample + '. Per MCP 2026-07-28 annotations are a UX hint, not a guarantee — a client that trusts the hint will skip the confirmation prompt the hint was meant to govern.',
      fix: 'Match annotations to the actual tool behaviour. A tool whose name says delete/drop/send/transfer is destructive; a tool whose name says create/update/write is NOT read-only. If the mismatch is intentional (a wrapper tool that is safe to call), rename the tool so the name reflects what it does. Clients should also validate annotations against tool names themselves rather than taking server hints on faith.',
      docsUrl: 'https://patchbay-mcp.dev/docs/annotations-001',
    })

    return findings
  },
}

const STRONG_DESTRUCTIVE_VERBS = [
  'delete', 'drop', 'remove', 'purge', 'erase', 'wipe', 'destroy',
  'revoke', 'cancel', 'kill', 'terminate', 'disable',
  'send', 'transfer', 'pay', 'charge', 'refund', 'withdraw', 'move',
  'post', 'publish',
]

const STRONG_WRITE_VERBS = [
  'create', 'add', 'insert', 'update', 'set', 'write',
  'send', 'post', 'publish', 'patch', 'replace',
  'delete', 'drop', 'remove', 'purge', 'erase', 'wipe', 'destroy',
  'transfer', 'pay', 'charge', 'refund', 'withdraw', 'move',
]

function matchesAny(haystack: string, verbs: string[]): string | undefined {
  for (const v of verbs) {
    // Word-boundary-ish: match verb at start, end, or surrounded by
    // separators that commonly appear in tool names (_, -, /).
    const re = new RegExp('(^|[_\\-/])' + v + '($|[_\\-/])', 'i')
    if (re.test(haystack)) return v
  }
  return undefined
}

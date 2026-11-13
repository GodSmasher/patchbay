import type { Check, Finding } from '../types'

/**
 * POISONING-003: tool CALL RESULT content contains prompt-injection
 * patterns.
 *
 * This is the attack class the arXiv paper 2603.24203 calls "tool-
 * injection poisoning" (TIP). POISONING-001 scans tool metadata,
 * POISONING-002 scans resources/read and prompts/get — but neither
 * sees the content returned by tools/call, which is also pasted into
 * the model's context. A compromised server can ship a "safe-looking"
 * tool (read-only hint on, no required args, benign name) whose RESULT
 * carries the payload. The user never sees the poisoned content
 * because it is not in the catalog.
 *
 * Fires only when the probe was allowed to invoke tools/call
 * (--probe-tool-calls / opts.probeToolCalls). Third-party crawls skip
 * this. Against our demo and operator-authorised audits it fires
 * normally.
 *
 * Two bands, same as POISONING-001/002:
 *   high: hidden characters in the returned content.
 *   medium: imperative or role-marker patterns in the returned content.
 */
export const poisoning003: Check = {
  id: 'POISONING-003',
  severity: 'high',
  title: 'Tool call result contains prompt-injection patterns',
  run: (snapshot): Finding[] => {
    const tools = snapshot.remote?.tools ?? []
    const calls = tools.filter((t) => t.callProbe?.outcome === 'ok')
    if (calls.length === 0) return []

    const hiddenHits: Array<{ tool: string; where: string; marker: string }> = []
    const instructionHits: Array<{ tool: string; where: string; snippet: string }> = []

    for (const t of calls) {
      const contents = t.callProbe?.content ?? []
      for (let i = 0; i < contents.length; i++) {
        const text = contents[i]!.text
        if (!text) continue
        const where = 'content[' + i + '].text'
        for (const h of scanHidden(text)) hiddenHits.push({ tool: t.name, where, marker: h })
        for (const s of scanInstructions(text)) instructionHits.push({ tool: t.name, where, snippet: s })
      }
    }

    const findings: Finding[] = []
    if (hiddenHits.length > 0) {
      const sample = hiddenHits.slice(0, 5).map((h) => h.tool + ' ' + h.where + ': ' + h.marker).join('; ')
      findings.push({
        id: 'POISONING-003',
        severity: 'high',
        confidence: 'high',
        title: 'Hidden Unicode in tool call result',
        evidence: hiddenHits.length + ' hidden-character occurrence(s) across ' +
          new Set(hiddenHits.map((h) => h.tool)).size + ' tool(s): ' + sample +
          '. The tool itself looked read-only and benign, but the result it returned carries hidden characters that get pasted into the model as context.',
        fix: 'Strip zero-width characters, bidi overrides, soft hyphens and tag characters from the output of every tool before returning it. If the tool returns upstream data you do not control (search results, scraped content), normalise with NFC + ASCII-print-filter server-side. Do not rely on the client to sanitise.',
        docsUrl: 'https://patchbay-mcp.dev/docs/poisoning-003',
      })
    }
    if (instructionHits.length > 0) {
      const sample = instructionHits.slice(0, 5).map((h) => h.tool + ' ' + h.where + ': "' + h.snippet + '"').join('; ')
      findings.push({
        id: 'POISONING-003',
        severity: 'medium',
        confidence: 'medium',
        title: 'Imperative or role-marker patterns in tool call result',
        evidence: instructionHits.length + ' pattern match(es) across ' +
          new Set(instructionHits.map((h) => h.tool)).size + ' tool(s): ' + sample +
          '. The tool result is read by the model as instruction context; patterns that look like system prompts or role switches steer it directly.',
        fix: 'Rewrite the tool\'s output so it describes the data for the human reader instead of addressing the model. Review any tool whose output embeds <system> tags, role prefixes (System:, Assistant:) or imperative directives ("You must ...", "Ignore previous ..."). If the data is pulled from upstream, treat that upstream as untrusted and sanitise server-side.',
        docsUrl: 'https://patchbay-mcp.dev/docs/poisoning-003',
      })
    }

    return findings
  },
}

// Scanners are the same patterns POISONING-001/-002 use. Duplicated here
// so the three checks stay independent and we don't take a cross-file
// import for a 100-byte literal list.

const HIDDEN_CHAR_NAMES: Array<{ re: RegExp; name: string }> = [
  { re: /​/g, name: 'U+200B zero-width space' },
  { re: /‌/g, name: 'U+200C zero-width non-joiner' },
  { re: /‍/g, name: 'U+200D zero-width joiner' },
  { re: /﻿/g, name: 'U+FEFF BOM' },
  { re: /[‪-‮]/g, name: 'bidi override U+202A..E' },
  { re: /[⁦-⁩]/g, name: 'bidi isolate U+2066..9' },
  { re: /­/g, name: 'U+00AD soft hyphen' },
  { re: /[\u{E0000}-\u{E007F}]/gu, name: 'Tag characters U+E0000..7F' },
]

function scanHidden(text: string): string[] {
  const found: string[] = []
  for (const { re, name } of HIDDEN_CHAR_NAMES) {
    if (re.test(text)) found.push(name)
    re.lastIndex = 0
  }
  return found
}

const INSTRUCTION_PATTERNS: Array<{ re: RegExp }> = [
  { re: /<\s*(system|important|instructions?|assistant|user|hidden)[\s>]/i },
  { re: /\b(ignore|disregard|forget)\s+(the\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/i },
  { re: /\b(you|the\s+(assistant|model))\s+(must|should|shall|will)\s+(not\s+)?(call|invoke|use|run|execute|skip|ignore)\b/i },
  { re: /^\s*(system|assistant|user)\s*:/im },
  { re: /^\s*###\s+(system|instructions?|rules?)/im },
  { re: /\[\[\s*(instructions?|hidden|system)\s*\]\]/i },
]

function scanInstructions(text: string): string[] {
  const hits: string[] = []
  for (const { re } of INSTRUCTION_PATTERNS) {
    const m = text.match(re)
    if (m) hits.push(m[0].slice(0, 60))
  }
  return hits
}

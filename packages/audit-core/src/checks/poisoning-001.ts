import type { Check, Finding, ToolDescriptor } from '../types'

/**
 * POISONING-001: tool metadata contains hidden Unicode or instruction
 * patterns that read as prompt-injection payloads.
 *
 * MCP clients feed tool descriptions and input-schema descriptions to the
 * LLM as part of the planning context. A description that embeds invisible
 * characters or imperative markup aimed at the model (not at the human
 * reader of a catalog page) is a direct injection vector: the server
 * operator (or anyone with push rights to the server) can steer the agent
 * without the user noticing.
 *
 * Two bands:
 *   high: zero-width characters, BOM, bidi overrides, or opaque tags that
 *         a human reading the description in a UI would not see at all.
 *   medium: visible imperative markup aimed at the model ("You MUST ...",
 *         "<SYSTEM>...", "Ignore previous instructions", role prefixes).
 *         False-positive risk is real (a legitimate description can say
 *         "you must pass an auth token"), so this stays medium with
 *         medium confidence.
 *
 * Runs only against tools we can see. If tools/list is auth-walled the
 * check stays silent.
 */
export const poisoning001: Check = {
  id: 'POISONING-001',
  severity: 'high',
  title: 'Tool metadata contains prompt-injection patterns',
  run: (snapshot): Finding[] => {
    const tools = snapshot.remote?.tools ?? snapshot.stdio?.tools ?? []
    if (tools.length === 0) return []

    const hiddenHits: Array<{ tool: string; where: string; marker: string }> = []
    const instructionHits: Array<{ tool: string; where: string; snippet: string }> = []

    for (const t of tools) {
      const slots = collectTextSlots(t)
      for (const { where, text } of slots) {
        const hidden = scanHidden(text)
        for (const h of hidden) hiddenHits.push({ tool: t.name, where, marker: h })
        const instr = scanInstructions(text)
        for (const s of instr) instructionHits.push({ tool: t.name, where, snippet: s })
      }
    }

    const findings: Finding[] = []

    if (hiddenHits.length > 0) {
      const sample = hiddenHits.slice(0, 5).map((h) => `${h.tool} ${h.where}: ${h.marker}`).join('; ')
      findings.push({
        id: 'POISONING-001',
        severity: 'high',
        confidence: 'high',
        title: 'Hidden Unicode in tool metadata',
        evidence: `${hiddenHits.length} hidden-character occurrence(s) across ${new Set(hiddenHits.map((h) => h.tool)).size} tool(s). Examples: ${sample}. These characters do not render in a catalog UI but are fed verbatim to the model.`,
        fix: 'Strip zero-width characters (U+200B U+200C U+200D U+FEFF), bidi overrides (U+202A..U+202E, U+2066..U+2069) and any opaque tag markers from every tool description and input-schema description before publishing. Normalise with NFC and ASCII-print-filter in CI.',
        docsUrl: 'https://patchbay-mcp.dev/docs/poisoning-001',
      })
    }

    if (instructionHits.length > 0) {
      const sample = instructionHits.slice(0, 5).map((h) => `${h.tool} ${h.where}: "${h.snippet}"`).join('; ')
      findings.push({
        id: 'POISONING-001',
        severity: 'medium',
        confidence: 'medium',
        title: 'Imperative or role-marker patterns in tool metadata',
        evidence: `${instructionHits.length} pattern match(es) across ${new Set(instructionHits.map((h) => h.tool)).size} tool(s): ${sample}. Tool descriptions and input-schema descriptions are read by the model as instruction context; patterns that look like system prompts or role switches steer it directly.`,
        fix: 'Rewrite the flagged descriptions to describe what the tool does for the human reader, not what the model should do. Review any description that uses tags, role prefixes (System:, Assistant:) or imperative directives ("You must ...", "Ignore previous ...").',
        docsUrl: 'https://patchbay-mcp.dev/docs/poisoning-001',
      })
    }

    return findings
  },
}

function collectTextSlots(tool: ToolDescriptor): Array<{ where: string; text: string }> {
  const slots: Array<{ where: string; text: string }> = []
  if (typeof tool.description === 'string') slots.push({ where: 'description', text: tool.description })
  if (tool.inputSchema && typeof tool.inputSchema === 'object') {
    walkSchema(tool.inputSchema, 'inputSchema', slots)
  }
  return slots
}

function walkSchema(node: unknown, path: string, out: Array<{ where: string; text: string }>): void {
  if (!node || typeof node !== 'object') return
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    const childPath = `${path}.${k}`
    if (k === 'description' && typeof v === 'string') {
      out.push({ where: childPath, text: v })
    } else if (typeof v === 'object' && v !== null) {
      walkSchema(v, childPath, out)
    }
  }
}

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

const INSTRUCTION_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /<\s*(system|important|instructions?|assistant|user|hidden)[\s>]/i, label: '<system>-style tag' },
  { re: /\b(ignore|disregard|forget)\s+(the\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/i, label: 'ignore-previous directive' },
  { re: /\b(you|the\s+(assistant|model))\s+(must|should|shall|will)\s+(not\s+)?(call|invoke|use|run|execute|skip|ignore)\b/i, label: 'imperative to model' },
  { re: /^\s*(system|assistant|user)\s*:/im, label: 'role prefix' },
  { re: /^\s*###\s+(system|instructions?|rules?)/im, label: 'markdown system header' },
  { re: /\[\[\s*(instructions?|hidden|system)\s*\]\]/i, label: '[[instruction]] marker' },
]

function scanInstructions(text: string): string[] {
  const hits: string[] = []
  for (const { re } of INSTRUCTION_PATTERNS) {
    const m = text.match(re)
    if (m) hits.push(m[0].slice(0, 60))
  }
  return hits
}

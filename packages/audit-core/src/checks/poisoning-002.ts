import type { Check, Finding, PromptDescriptor, ResourceDescriptor } from '../types'

/**
 * POISONING-002: resource content and prompt-template content contain
 * hidden Unicode or instruction patterns that read as prompt-injection
 * payloads.
 *
 * MCP servers do not just expose tools. The spec defines two more surfaces
 * that get fed to the model as context:
 *   - resources/read returns resource bodies (documents, files, snippets)
 *     that clients paste into the LLM's context.
 *   - prompts/get returns rendered prompt templates (role + content pairs)
 *     that clients use verbatim.
 * Both surfaces are invisible to anyone reading a tool catalog, which is
 * why POISONING-001 (tool-metadata only) misses them. A compromised server
 * can hide zero-width Unicode or role markers in a resource and the user
 * never sees the payload before it steers their agent.
 *
 * Same severity bands as POISONING-001:
 *   high: hidden characters (zero-width, BOM, bidi overrides, soft hyphen,
 *         tag characters) anywhere in a resource or prompt body.
 *   medium: imperative markup aimed at the model ("<SYSTEM>...", "Ignore
 *         previous ...", role prefixes).
 *
 * Only runs when the probe collected resource/prompt bodies — i.e. the
 * crawler was in a mode permitted to call resources/read + prompts/get,
 * which third-party crawls skip.
 */
export const poisoning002: Check = {
  id: 'POISONING-002',
  severity: 'high',
  title: 'Resource or prompt-template content contains prompt-injection patterns',
  run: (snapshot): Finding[] => {
    const resources = snapshot.remote?.resources ?? []
    const prompts = snapshot.remote?.prompts ?? []
    if (resources.length === 0 && prompts.length === 0) return []

    const hiddenHits: Array<{ surface: string; where: string; marker: string }> = []
    const instructionHits: Array<{ surface: string; where: string; snippet: string }> = []

    for (const r of resources) {
      const slots = collectResourceSlots(r)
      for (const { where, text } of slots) {
        for (const h of scanHidden(text)) hiddenHits.push({ surface: 'resource ' + (r.name ?? r.uri), where, marker: h })
        for (const s of scanInstructions(text)) instructionHits.push({ surface: 'resource ' + (r.name ?? r.uri), where, snippet: s })
      }
    }
    for (const p of prompts) {
      const slots = collectPromptSlots(p)
      for (const { where, text } of slots) {
        for (const h of scanHidden(text)) hiddenHits.push({ surface: 'prompt ' + p.name, where, marker: h })
        for (const s of scanInstructions(text)) instructionHits.push({ surface: 'prompt ' + p.name, where, snippet: s })
      }
    }

    const findings: Finding[] = []

    if (hiddenHits.length > 0) {
      const sample = hiddenHits.slice(0, 5).map((h) => h.surface + ' ' + h.where + ': ' + h.marker).join('; ')
      findings.push({
        id: 'POISONING-002',
        severity: 'high',
        confidence: 'high',
        title: 'Hidden Unicode in resource or prompt content',
        evidence: hiddenHits.length + ' hidden-character occurrence(s) across ' +
          new Set(hiddenHits.map((h) => h.surface)).size + ' resource/prompt surface(s). Examples: ' + sample +
          '. These characters do not render in the content preview but are fed verbatim to the model when a client loads the resource or renders the prompt.',
        fix: 'Strip zero-width characters (U+200B U+200C U+200D U+FEFF), bidi overrides (U+202A..U+202E, U+2066..U+2069) and any opaque tag markers from every resource body and prompt message before publishing. Normalise with NFC and ASCII-print-filter when generating the payload.',
        docsUrl: 'https://patchbay-mcp.dev/docs/poisoning-002',
      })
    }

    if (instructionHits.length > 0) {
      const sample = instructionHits.slice(0, 5).map((h) => h.surface + ' ' + h.where + ': "' + h.snippet + '"').join('; ')
      findings.push({
        id: 'POISONING-002',
        severity: 'medium',
        confidence: 'medium',
        title: 'Imperative or role-marker patterns in resource or prompt content',
        evidence: instructionHits.length + ' pattern match(es) across ' +
          new Set(instructionHits.map((h) => h.surface)).size + ' surface(s): ' + sample +
          '. Resource bodies and prompt messages are read by the model as instruction context; patterns that look like system prompts or role switches steer it directly.',
        fix: 'Rewrite the flagged resource / prompt content to describe the data for the human reader, not what the model should do. Any resource or prompt body that uses tags, role prefixes (System:, Assistant:) or imperative directives ("You must ...", "Ignore previous ...") needs a second look.',
        docsUrl: 'https://patchbay-mcp.dev/docs/poisoning-002',
      })
    }

    return findings
  },
}

function collectResourceSlots(r: ResourceDescriptor): Array<{ where: string; text: string }> {
  const out: Array<{ where: string; text: string }> = []
  if (r.name) out.push({ where: 'name', text: r.name })
  if (r.description) out.push({ where: 'description', text: r.description })
  for (let i = 0; i < (r.contents ?? []).length; i++) {
    const c = r.contents![i]!
    if (c.text) out.push({ where: 'contents[' + i + '].text', text: c.text })
  }
  return out
}

function collectPromptSlots(p: PromptDescriptor): Array<{ where: string; text: string }> {
  const out: Array<{ where: string; text: string }> = []
  if (p.description) out.push({ where: 'description', text: p.description })
  for (let i = 0; i < (p.arguments ?? []).length; i++) {
    const a = p.arguments![i]!
    if (a.description) out.push({ where: 'arguments[' + i + '].description', text: a.description })
  }
  for (let i = 0; i < (p.messages ?? []).length; i++) {
    const m = p.messages![i]!
    if (m.content?.text) out.push({ where: 'messages[' + i + '].content.text', text: m.content.text })
  }
  return out
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

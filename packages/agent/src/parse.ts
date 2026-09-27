import type { GeneratedFile } from './types'

/** Reasoning models may prepend a `<think>` block; it never belongs in the answer. */
export function stripReasoning(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*?<\/think>/i, '').trim()
}

/** Pulls the first JSON object out of a model answer, tolerating code fences and prose around it. */
export function extractJson<T>(text: string): T {
  const clean = stripReasoning(text)
  const fenced = clean.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced?.[1] ?? clean
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('model answer contained no JSON object')
  return JSON.parse(candidate.slice(start, end + 1)) as T
}

/**
 * Code is exchanged as `<file path="...">...</file>` blocks instead of JSON, so the
 * model never has to escape source code inside a JSON string.
 */
export function parseFileBlocks(text: string): GeneratedFile[] {
  const clean = stripReasoning(text)
  const files: GeneratedFile[] = []
  const pattern = /<file\s+path="([^"]+)">\s*\n?([\s\S]*?)\n?<\/file>/g
  for (const match of clean.matchAll(pattern)) {
    const path = normalizePath(match[1] ?? '')
    const content = stripFence(match[2] ?? '')
    if (path) files.push({ path, content: content.endsWith('\n') ? content : `${content}\n` })
  }
  return files
}

export function renderFileBlocks(files: GeneratedFile[]): string {
  return files.map((f) => `<file path="${f.path}">\n${f.content.trimEnd()}\n</file>`).join('\n\n')
}

function stripFence(content: string): string {
  const fenced = content.match(/^\s*```[a-zA-Z]*\n([\s\S]*?)\n```\s*$/)
  return fenced?.[1] ?? content
}

function normalizePath(path: string): string {
  const slashed = path.trim().replace(/\\/g, '/')
  if (slashed.startsWith('/') || /^[a-zA-Z]:/.test(slashed)) return ''
  const clean = slashed.replace(/^\.\//, '')
  if (clean.split('/').includes('..')) return ''
  return clean
}

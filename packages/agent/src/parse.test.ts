import { describe, expect, it } from 'vitest'
import { extractJson, parseFileBlocks, renderFileBlocks, stripReasoning } from './parse'

describe('stripReasoning', () => {
  it('removes think blocks, including an unclosed prefix', () => {
    expect(stripReasoning('<think>plan it</think>\n{"a":1}')).toBe('{"a":1}')
    expect(stripReasoning('scratch work</think>answer')).toBe('answer')
    expect(stripReasoning('plain')).toBe('plain')
  })
})

describe('extractJson', () => {
  it('reads fenced and unfenced JSON with surrounding prose', () => {
    expect(extractJson<{ ok: boolean }>('Here you go:\n```json\n{"ok": true}\n```')).toEqual({ ok: true })
    expect(extractJson<{ n: number }>('<think>x</think> result: {"n": 2} done')).toEqual({ n: 2 })
  })

  it('fails loudly without an object', () => {
    expect(() => extractJson('no json here')).toThrow(/no JSON object/)
  })
})

describe('file blocks', () => {
  it('parses paths and content and round-trips', () => {
    const text = `<think>...</think>
<file path="src/connector.ts">
export const a = 1
</file>

<file path="./README.md">
\`\`\`md
# Title
\`\`\`
</file>`
    const files = parseFileBlocks(text)
    expect(files).toEqual([
      { path: 'src/connector.ts', content: 'export const a = 1\n' },
      { path: 'README.md', content: '# Title\n' },
    ])
    expect(parseFileBlocks(renderFileBlocks(files))).toEqual(files)
  })

  it('drops paths that escape the work directory', () => {
    const files = parseFileBlocks('<file path="../etc/passwd">x</file><file path="/abs.ts">y</file>')
    expect(files).toEqual([])
  })
})

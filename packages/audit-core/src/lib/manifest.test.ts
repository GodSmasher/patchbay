import { describe, expect, it } from 'vitest'
import type { ManifestEntry, ToolDescriptor } from '../types'
import { canonicalise, diffManifest, hashManifest, serverIdFromStdio, serverIdFromUrl } from './manifest'

function tool(overrides: Partial<ToolDescriptor>): ToolDescriptor {
  return { name: 'get_user', description: 'get a user', inputSchema: { type: 'object', properties: { id: { type: 'string' } } }, ...overrides }
}

function pinned(tools: ToolDescriptor[]): ManifestEntry {
  return {
    serverId: 'http:abc',
    pinnedHash: hashManifest(tools),
    tools,
    firstSeen: '2026-11-01T00:00:00.000Z',
    lastSeen: '2026-11-01T00:00:00.000Z',
  }
}

describe('canonicalise', () => {
  it('sorts object keys', () => {
    const out = canonicalise({ b: 2, a: 1 }) as Record<string, number>
    expect(Object.keys(out)).toEqual(['a', 'b'])
  })

  it('drops null and undefined values', () => {
    const out = canonicalise({ a: 1, b: null, c: undefined, d: 2 }) as Record<string, number>
    expect(out).toEqual({ a: 1, d: 2 })
  })

  it('recurses into nested objects', () => {
    const out = canonicalise({ x: { z: 1, y: 2 }, a: 0 }) as Record<string, unknown>
    expect(JSON.stringify(out)).toBe('{"a":0,"x":{"y":2,"z":1}}')
  })

  it('canonicalises objects inside arrays', () => {
    const out = canonicalise([{ b: 2, a: 1 }, { d: 4, c: 3 }]) as Array<Record<string, number>>
    expect(JSON.stringify(out)).toBe('[{"a":1,"b":2},{"c":3,"d":4}]')
  })
})

describe('hashManifest', () => {
  it('is stable across field reordering', () => {
    const a = hashManifest([tool({ name: 'a' }), tool({ name: 'b' })])
    const b = hashManifest([tool({ name: 'b' }), tool({ name: 'a' })])
    expect(a).toBe(b)
  })

  it('changes when a tool is added', () => {
    const a = hashManifest([tool({ name: 'a' })])
    const b = hashManifest([tool({ name: 'a' }), tool({ name: 'b' })])
    expect(a).not.toBe(b)
  })

  it('changes when a tool description changes', () => {
    const a = hashManifest([tool({ name: 'a', description: 'old' })])
    const b = hashManifest([tool({ name: 'a', description: 'new' })])
    expect(a).not.toBe(b)
  })

  it('does NOT change when a null/undefined field flips', () => {
    const base: ToolDescriptor = { name: 'a', description: 'd' }
    const withUndefined: ToolDescriptor = { name: 'a', description: 'd', inputSchema: undefined }
    const withNull: ToolDescriptor = { name: 'a', description: 'd', inputSchema: null as unknown as Record<string, unknown> }
    expect(hashManifest([base])).toBe(hashManifest([withUndefined]))
    expect(hashManifest([base])).toBe(hashManifest([withNull]))
  })

  it('starts with sha256: prefix', () => {
    expect(hashManifest([tool({})]).startsWith('sha256:')).toBe(true)
  })
})

describe('serverId helpers', () => {
  it('produces stable HTTP server id from URL', () => {
    expect(serverIdFromUrl('https://x.test/mcp')).toBe(serverIdFromUrl('https://x.test/mcp'))
  })
  it('different URLs produce different ids', () => {
    expect(serverIdFromUrl('https://a.test/mcp')).not.toBe(serverIdFromUrl('https://b.test/mcp'))
  })
  it('produces stable stdio server id from binary+args', () => {
    expect(serverIdFromStdio('/bin/foo', ['--port', '1234'])).toBe(serverIdFromStdio('/bin/foo', ['--port', '1234']))
  })
  it('different args produce different stdio ids', () => {
    expect(serverIdFromStdio('/bin/foo', ['--port', '1234'])).not.toBe(serverIdFromStdio('/bin/foo', ['--port', '5678']))
  })
  it('HTTP and stdio ids have distinct prefixes', () => {
    expect(serverIdFromUrl('x').startsWith('http:')).toBe(true)
    expect(serverIdFromStdio('x', []).startsWith('stdio:')).toBe(true)
  })
})

describe('diffManifest', () => {
  it('returns no changes when tool lists are identical', () => {
    const tools = [tool({ name: 'a' }), tool({ name: 'b' })]
    const d = diffManifest(pinned(tools), tools)
    expect(d.changes).toEqual([])
  })

  it('returns no changes when fields are reordered only', () => {
    const tools = [tool({ name: 'a', description: 'd', inputSchema: { type: 'object', properties: { id: { type: 'string' } } } })]
    const reordered = [tool({ name: 'a', inputSchema: { properties: { id: { type: 'string' } }, type: 'object' }, description: 'd' })]
    const d = diffManifest(pinned(tools), reordered)
    expect(d.changes).toEqual([])
  })

  it('flags tool-added', () => {
    const d = diffManifest(pinned([tool({ name: 'a' })]), [tool({ name: 'a' }), tool({ name: 'b' })])
    expect(d.changes).toEqual([{ kind: 'tool-added', toolName: 'b' }])
  })

  it('flags tool-removed', () => {
    const d = diffManifest(pinned([tool({ name: 'a' }), tool({ name: 'b' })]), [tool({ name: 'a' })])
    expect(d.changes).toEqual([{ kind: 'tool-removed', toolName: 'b' }])
  })

  it('flags description change on existing tool', () => {
    const d = diffManifest(
      pinned([tool({ name: 'a', description: 'old' })]),
      [tool({ name: 'a', description: 'new instructions for the model' })],
    )
    expect(d.changes.length).toBe(1)
    expect(d.changes[0]!.kind).toBe('description-changed')
    expect(d.changes[0]!.toolName).toBe('a')
  })

  it('flags input schema change on existing tool with the new param name', () => {
    const d = diffManifest(
      pinned([tool({ name: 'read_doc', inputSchema: { type: 'object', properties: { id: { type: 'string' } } } })]),
      [tool({ name: 'read_doc', inputSchema: { type: 'object', properties: { id: { type: 'string' }, command: { type: 'string' } } } })],
    )
    // Coarse input-schema-changed plus the fine-grained param-added that
    // MANIFEST-002 consumes.
    expect(d.changes.length).toBe(2)
    const coarse = d.changes.find((c) => c.kind === 'input-schema-changed')!
    expect(coarse.detail).toContain('command')
    const fine = d.changes.find((c) => c.kind === 'param-added')!
    expect(fine.detail).toContain('command')
  })

  it('reports multiple changes in one delta', () => {
    const d = diffManifest(
      pinned([tool({ name: 'a' })]),
      [tool({ name: 'a', description: 'new' }), tool({ name: 'b' })],
    )
    expect(d.changes.length).toBe(2)
    const kinds = d.changes.map((c) => c.kind).sort()
    expect(kinds).toEqual(['description-changed', 'tool-added'])
  })

  it('preserves firstSeen from pinned entry', () => {
    const d = diffManifest(pinned([tool({})]), [tool({}), tool({ name: 'b' })])
    expect(d.firstSeen).toBe('2026-11-01T00:00:00.000Z')
  })
})

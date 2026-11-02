import { describe, expect, it } from 'vitest'
import { pathCandidates } from './remote'

describe('pathCandidates', () => {
  it('tries the given path first, then common MCP variants', () => {
    const r = pathCandidates('https://mcp.example.com/mcp')
    expect(r[0]).toBe('https://mcp.example.com/mcp')
    expect(r).toContain('https://mcp.example.com/mcp/sse')
    expect(r).toContain('https://mcp.example.com/mcp/messages')
    expect(r).toContain('https://mcp.example.com/sse')
    expect(r).toContain('https://mcp.example.com/')
  })

  it('deduplicates when given path is already a known variant', () => {
    const r = pathCandidates('https://mcp.example.com/sse')
    expect(r.filter((p) => p === 'https://mcp.example.com/sse')).toHaveLength(1)
  })

  it('handles root path', () => {
    const r = pathCandidates('https://mcp.example.com/')
    expect(r[0]).toBe('https://mcp.example.com/')
    expect(r).toContain('https://mcp.example.com/mcp')
  })
})

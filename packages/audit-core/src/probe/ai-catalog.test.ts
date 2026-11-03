import { describe, expect, it } from 'vitest'
import { detectPublicByDesign } from './ai-catalog'

describe('detectPublicByDesign', () => {
  it('returns null for empty / non-object input', () => {
    expect(detectPublicByDesign(null)).toBeNull()
    expect(detectPublicByDesign(undefined)).toBeNull()
    expect(detectPublicByDesign('string')).toBeNull()
    expect(detectPublicByDesign({})).toBeNull()
  })

  it('detects authentication: "none" at top level', () => {
    const d = detectPublicByDesign({ authentication: 'none' })
    expect(d?.publicByDesign).toBe(true)
    expect(d?.evidence).toContain('authentication')
    expect(d?.evidence).toContain('none')
  })

  it('detects authentication: "public"', () => {
    expect(detectPublicByDesign({ authentication: 'public' })?.publicByDesign).toBe(true)
  })

  it('detects authentication: "optional"', () => {
    expect(detectPublicByDesign({ authentication: 'optional' })?.publicByDesign).toBe(true)
  })

  it('detects auth_required: false', () => {
    const d = detectPublicByDesign({ auth_required: false })
    expect(d?.publicByDesign).toBe(true)
    expect(d?.evidence).toContain('auth_required')
  })

  it('detects authRequired: false (camelCase variant)', () => {
    expect(detectPublicByDesign({ authRequired: false })?.publicByDesign).toBe(true)
  })

  it('detects public: true', () => {
    expect(detectPublicByDesign({ public: true })?.publicByDesign).toBe(true)
  })

  it('detects nested mcp.authentication: "none"', () => {
    const d = detectPublicByDesign({ mcp: { authentication: 'none' } })
    expect(d?.publicByDesign).toBe(true)
    expect(d?.evidence).toContain('mcp.authentication')
  })

  it('detects authentication: "none" inside a servers array', () => {
    const d = detectPublicByDesign({
      servers: [
        { url: 'https://example.com/mcp', authentication: 'none' },
      ],
    })
    expect(d?.publicByDesign).toBe(true)
    expect(d?.evidence).toContain('servers.0.authentication')
  })

  it('detects text patterns in notes/description fields', () => {
    const d = detectPublicByDesign({ notes: 'No API key is required to use these tools.' })
    expect(d?.publicByDesign).toBe(true)
    expect(d?.evidence).toContain('notes')
  })

  it('does not match servers that require auth', () => {
    expect(detectPublicByDesign({ authentication: 'bearer' })).toBeNull()
    expect(detectPublicByDesign({ authentication: 'oauth2' })).toBeNull()
    expect(detectPublicByDesign({ auth_required: true })).toBeNull()
    expect(detectPublicByDesign({ public: false })).toBeNull()
  })

  it('does not match on unrelated true values', () => {
    expect(detectPublicByDesign({ enabled: true, discoverable: true })).toBeNull()
  })

  it('does not false-positive on docs about auth', () => {
    expect(detectPublicByDesign({ docs_url: 'https://example.com/auth-guide' })).toBeNull()
  })

  it('handles deeply nested Chainflip-shaped doc', () => {
    const doc = {
      name: 'Broker as a Service',
      version: '1.0',
      mcp: {
        endpoints: {
          production: 'https://chainflip-broker.io/mcp',
          testing: 'https://perseverance.chainflip-broker.io/mcp',
        },
        authentication: 'none',
      },
    }
    const d = detectPublicByDesign(doc)
    expect(d?.publicByDesign).toBe(true)
    expect(d?.evidence).toContain('mcp.authentication')
  })

  it('handles DeepWiki-shaped (just "public: true")', () => {
    const d = detectPublicByDesign({ name: 'DeepWiki', public: true })
    expect(d?.publicByDesign).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { authorityAttestation001 } from './authority-attestation-001'
import { remoteSnap } from './test-helpers'

describe('AUTHORITY-ATTESTATION-001', () => {
  it('fires on X-MCP-Authority header with did:web value', () => {
    const findings = authorityAttestation001.run(remoteSnap({
      responseHeaders: { 'x-mcp-authority': 'did:web:jassverband.ch' },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('info')
    expect(findings[0]?.evidence).toContain('did:web:jassverband.ch')
  })

  it('fires on Link rel=authority-attestation', () => {
    const findings = authorityAttestation001.run(remoteSnap({
      responseHeaders: {
        link: '<https://jassverband.ch/.well-known/mcp-authority.json>; rel="authority-attestation"; type="application/json"',
      },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.evidence).toContain('jassverband.ch/.well-known/mcp-authority.json')
  })

  it('fires on Link rel=mcp-manifest', () => {
    const findings = authorityAttestation001.run(remoteSnap({
      responseHeaders: {
        link: '<https://example.com/.well-known/mcp-manifest.json>; rel="mcp-manifest"; type="application/json"',
      },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.evidence).toContain('mcp-manifest.json')
  })

  it('combines all three signals in a single finding', () => {
    const findings = authorityAttestation001.run(remoteSnap({
      responseHeaders: {
        'x-mcp-authority': 'did:web:example.com',
        link: '<https://example.com/a.json>; rel="authority-attestation", <https://example.com/m.json>; rel="mcp-manifest"',
      },
    }))
    expect(findings).toHaveLength(1)
    const ev = findings[0]?.evidence || ''
    expect(ev).toContain('did:web:example.com')
    expect(ev).toContain('a.json')
    expect(ev).toContain('m.json')
  })

  it('does not fire on an unrelated Link header', () => {
    const findings = authorityAttestation001.run(remoteSnap({
      responseHeaders: { link: '<https://example.com/>; rel="canonical"' },
    }))
    expect(findings).toEqual([])
  })

  it('does not fire without any response headers', () => {
    expect(authorityAttestation001.run(remoteSnap({}))).toEqual([])
  })
})

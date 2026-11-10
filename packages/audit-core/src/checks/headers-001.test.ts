import { describe, expect, it } from 'vitest'
import { headers001 } from './headers-001'
import { remoteSnap } from './test-helpers'

describe('HEADERS-001', () => {
  it('fires on wildcard CORS with credentials', () => {
    const findings = headers001.run(remoteSnap({
      reachable: true,
      responseHeaders: {
        'access-control-allow-origin': '*',
        'access-control-allow-credentials': 'true',
        'strict-transport-security': 'max-age=31536000',
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
      },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.evidence).toMatch(/anti-pattern/)
  })

  it('fires on missing HSTS on HTTPS', () => {
    const findings = headers001.run(remoteSnap({
      url: 'https://x',
      reachable: true,
      usesTls: true,
      responseHeaders: {
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
      },
    }))
    expect(findings[0]?.evidence).toMatch(/Strict-Transport-Security/)
  })

  it('does not fire on missing HSTS when target is plain HTTP', () => {
    const findings = headers001.run(remoteSnap({
      url: 'http://x',
      reachable: true,
      usesTls: false,
      responseHeaders: {
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
      },
    }))
    expect(findings).toEqual([])
  })

  it('fires on missing X-Frame-Options AND no CSP frame-ancestors', () => {
    const findings = headers001.run(remoteSnap({
      reachable: true,
      usesTls: true,
      responseHeaders: {
        'strict-transport-security': 'max-age=31536000',
        'x-content-type-options': 'nosniff',
      },
    }))
    expect(findings[0]?.evidence).toMatch(/X-Frame-Options/)
  })

  it('passes when CSP frame-ancestors is set even without X-Frame-Options', () => {
    const findings = headers001.run(remoteSnap({
      reachable: true,
      usesTls: true,
      responseHeaders: {
        'strict-transport-security': 'max-age=31536000',
        'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
        'x-content-type-options': 'nosniff',
      },
    }))
    expect(findings).toEqual([])
  })

  it('fires on missing nosniff', () => {
    const findings = headers001.run(remoteSnap({
      reachable: true,
      usesTls: true,
      responseHeaders: {
        'strict-transport-security': 'max-age=31536000',
        'x-frame-options': 'DENY',
      },
    }))
    expect(findings[0]?.evidence).toMatch(/nosniff/)
  })

  it('aggregates multiple gaps into one finding', () => {
    const findings = headers001.run(remoteSnap({
      reachable: true,
      usesTls: true,
      responseHeaders: {},
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.title).toMatch(/3 transport-security header gap/)
  })

  it('passes when all four posture headers are present', () => {
    const findings = headers001.run(remoteSnap({
      reachable: true,
      usesTls: true,
      responseHeaders: {
        'strict-transport-security': 'max-age=31536000',
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
      },
    }))
    expect(findings).toEqual([])
  })

  it('does not fire when server is not reachable', () => {
    expect(headers001.run(remoteSnap({ reachable: false, responseHeaders: {} }))).toEqual([])
  })

  it('does not fire when no responseHeaders were captured', () => {
    expect(headers001.run(remoteSnap({ reachable: true }))).toEqual([])
  })
})

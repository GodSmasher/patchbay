import { describe, expect, it } from 'vitest'
import { headers001 } from './headers-001'
import { remoteSnap } from './test-helpers'

const BASELINE_HTTPS = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
}

function run(headers: Record<string, string>, opts: { tls?: boolean; url?: string } = {}) {
  return headers001.run(remoteSnap({
    url: opts.url ?? 'https://x',
    reachable: true,
    usesTls: opts.tls ?? true,
    responseHeaders: headers,
  }))
}

function ids(findings: Array<{ id: string }>): string[] {
  return findings.map((f) => f.id).sort()
}

describe('HEADERS-001 depth: X-Frame-Options (.1 / .2)', () => {
  it.each(['DENY', 'SAMEORIGIN'])('passes on valid X-Frame-Options "%s"', (xfo) => {
    const f = run({ ...BASELINE_HTTPS, 'x-frame-options': xfo })
    expect(ids(f)).not.toContain('HEADERS-001.1')
    expect(ids(f)).not.toContain('HEADERS-001.2')
  })

  it.each(['ALLOWALL', 'ALLOW-FROM https://example.com', 'ALLOW-FROM *', 'deny', 'sameorigin', 'Deny', 'allowall'])('fires .2 on invalid X-Frame-Options "%s"', (xfo) => {
    const f = run({ ...BASELINE_HTTPS, 'x-frame-options': xfo })
    expect(ids(f)).toContain('HEADERS-001.2')
  })

  it('.1 fires when X-Frame-Options is missing', () => {
    const { 'x-frame-options': _, ...rest } = BASELINE_HTTPS
    void _
    const f = run(rest)
    expect(ids(f)).toContain('HEADERS-001.1')
  })

  it('.1 does NOT fire when CSP frame-ancestors is restrictive', () => {
    const { 'x-frame-options': _, ...rest } = BASELINE_HTTPS
    void _
    const f = run({ ...rest, 'content-security-policy': "default-src 'self'; frame-ancestors 'self'" })
    expect(ids(f)).not.toContain('HEADERS-001.1')
  })

  it('.1 still fires when CSP frame-ancestors is wildcard', () => {
    const { 'x-frame-options': _, ...rest } = BASELINE_HTTPS
    void _
    const f = run({ ...rest, 'content-security-policy': "default-src 'self'; frame-ancestors *" })
    const one = f.find((x) => x.id === 'HEADERS-001.1')
    expect(one?.evidence).toMatch(/wildcard/)
  })
})

describe('HEADERS-001 depth: X-Content-Type-Options (.3 / .4)', () => {
  it('passes on exact "nosniff"', () => {
    const f = run({ ...BASELINE_HTTPS, 'x-content-type-options': 'nosniff' })
    expect(ids(f)).not.toContain('HEADERS-001.3')
    expect(ids(f)).not.toContain('HEADERS-001.4')
  })

  it('passes on case-insensitive "NOSNIFF" (common ingress rewrite)', () => {
    const f = run({ ...BASELINE_HTTPS, 'x-content-type-options': 'NOSNIFF' })
    expect(ids(f)).not.toContain('HEADERS-001.3')
    expect(ids(f)).not.toContain('HEADERS-001.4')
  })

  it('.3 fires when header is missing entirely', () => {
    const { 'x-content-type-options': _, ...rest } = BASELINE_HTTPS
    void _
    expect(ids(run(rest))).toContain('HEADERS-001.3')
  })

  it.each(['sniff', 'none', 'nosnif'])('.4 fires on invalid value "%s"', (v) => {
    expect(ids(run({ ...BASELINE_HTTPS, 'x-content-type-options': v }))).toContain('HEADERS-001.4')
  })
})

describe('HEADERS-001 depth: Strict-Transport-Security (.5 / .6 / .7)', () => {
  it('.5 fires when HSTS is missing on HTTPS', () => {
    const { 'strict-transport-security': _, ...rest } = BASELINE_HTTPS
    void _
    expect(ids(run(rest))).toContain('HEADERS-001.5')
  })

  it('.5 does NOT fire on plain HTTP (TRANSPORT-001 reports those)', () => {
    const { 'strict-transport-security': _, ...rest } = BASELINE_HTTPS
    void _
    const f = run(rest, { tls: false, url: 'http://x' })
    expect(ids(f)).not.toContain('HEADERS-001.5')
    expect(ids(f)).not.toContain('HEADERS-001.6')
    expect(ids(f)).not.toContain('HEADERS-001.7')
  })

  it.each([
    ['max-age=10368000', false],  // exact OWASP threshold passes
    ['max-age=31536000', false],  // 1 year passes
    ['max-age=15552000', false],  // 6 months passes
    ['max-age=86400', true],      // 1 day too short
    ['max-age=0', true],           // explicit disable
    ['max-age=10000', true],       // tiny
    ['max-age=invalid', true],     // unparseable
  ])('.6 max-age handling: %s → fire=%s', (header, shouldFire) => {
    const f = run({ ...BASELINE_HTTPS, 'strict-transport-security': `${header}; includeSubDomains` })
    expect(ids(f).includes('HEADERS-001.6')).toBe(shouldFire)
  })

  it('.7 fires when includeSubDomains is missing', () => {
    const f = run({ ...BASELINE_HTTPS, 'strict-transport-security': 'max-age=31536000' })
    expect(ids(f)).toContain('HEADERS-001.7')
  })

  it('.7 does NOT fire when includeSubDomains is present', () => {
    const f = run({ ...BASELINE_HTTPS, 'strict-transport-security': 'max-age=31536000; includeSubDomains' })
    expect(ids(f)).not.toContain('HEADERS-001.7')
  })

  it('.7 does NOT fire when includeSubDomains is present but with different casing / ordering', () => {
    const f = run({ ...BASELINE_HTTPS, 'strict-transport-security': 'includeSubdomains; max-age=31536000; preload' })
    expect(ids(f)).not.toContain('HEADERS-001.7')
  })
})

describe('HEADERS-001 depth: Content-Security-Policy (.8 / .9)', () => {
  it('.8 fires on unsafe-inline without nonce', () => {
    const f = run({ ...BASELINE_HTTPS, 'content-security-policy': "script-src 'self' 'unsafe-inline'" })
    expect(ids(f)).toContain('HEADERS-001.8')
  })

  it('.8 does NOT fire when unsafe-inline is paired with a nonce source', () => {
    const f = run({ ...BASELINE_HTTPS, 'content-security-policy': "script-src 'self' 'unsafe-inline' 'nonce-abc123'" })
    expect(ids(f)).not.toContain('HEADERS-001.8')
  })

  it('.8 does NOT fire when unsafe-inline is paired with a hash source', () => {
    const f = run({ ...BASELINE_HTTPS, 'content-security-policy': "script-src 'self' 'unsafe-inline' 'sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa='" })
    expect(ids(f)).not.toContain('HEADERS-001.8')
  })

  it('.8 does NOT fire when unsafe-inline is paired with strict-dynamic', () => {
    const f = run({ ...BASELINE_HTTPS, 'content-security-policy': "script-src 'self' 'unsafe-inline' 'strict-dynamic'" })
    expect(ids(f)).not.toContain('HEADERS-001.8')
  })

  it('.8 fires when unsafe-inline is in a different directive without its own nonce', () => {
    const f = run({ ...BASELINE_HTTPS, 'content-security-policy': "script-src 'self' 'nonce-abc'; style-src 'unsafe-inline'" })
    expect(ids(f)).toContain('HEADERS-001.8')
  })

  it('.9 fires on unsafe-eval', () => {
    const f = run({ ...BASELINE_HTTPS, 'content-security-policy': "script-src 'self' 'unsafe-eval'" })
    expect(ids(f)).toContain('HEADERS-001.9')
  })

  it('.9 does NOT fire when CSP is absent (nothing to inspect)', () => {
    const f = run({ ...BASELINE_HTTPS })
    expect(ids(f)).not.toContain('HEADERS-001.9')
  })
})

describe('HEADERS-001 depth: Referrer-Policy (.10)', () => {
  it.each(['no-referrer', 'same-origin', 'strict-origin', 'strict-origin-when-cross-origin'])('passes on strict value "%s"', (v) => {
    expect(ids(run({ ...BASELINE_HTTPS, 'referrer-policy': v }))).not.toContain('HEADERS-001.10')
  })

  it.each(['unsafe-url', 'no-referrer-when-downgrade', 'origin-when-cross-origin'])('.10 fires on weak value "%s"', (v) => {
    expect(ids(run({ ...BASELINE_HTTPS, 'referrer-policy': v }))).toContain('HEADERS-001.10')
  })

  it('.10 does NOT fire when header is absent (browser default is strict-origin-when-cross-origin)', () => {
    expect(ids(run({ ...BASELINE_HTTPS }))).not.toContain('HEADERS-001.10')
  })
})

describe('HEADERS-001 depth: CORS (.11)', () => {
  it('.11 fires on ACAO=* + ACAC=true', () => {
    const f = run({
      ...BASELINE_HTTPS,
      'access-control-allow-origin': '*',
      'access-control-allow-credentials': 'true',
    })
    const one = f.find((x) => x.id === 'HEADERS-001.11')
    expect(one?.severity).toBe('critical')
    expect(one?.evidence).toMatch(/\*/)
    expect(one?.evidence).toMatch(/credentials/i)
  })

  it('.11 does NOT fire on ACAO=* without credentials (public-read is fine)', () => {
    const f = run({ ...BASELINE_HTTPS, 'access-control-allow-origin': '*' })
    expect(ids(f)).not.toContain('HEADERS-001.11')
  })

  it('.11 does NOT fire on ACAO=specific-origin + credentials (normal)', () => {
    const f = run({
      ...BASELINE_HTTPS,
      'access-control-allow-origin': 'https://trusted.example.com',
      'access-control-allow-credentials': 'true',
    })
    expect(ids(f)).not.toContain('HEADERS-001.11')
  })
})

describe('HEADERS-001 depth: integration', () => {
  it('passes cleanly when everything is set correctly', () => {
    expect(run({
      ...BASELINE_HTTPS,
      'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
      'content-security-policy': "default-src 'self'; frame-ancestors 'none'; script-src 'self' 'nonce-abc123'",
      'referrer-policy': 'strict-origin-when-cross-origin',
    })).toEqual([])
  })

  it('emits one finding per sub-check, not one aggregated finding', () => {
    const f = run({
      'x-frame-options': 'ALLOWALL',
      'x-content-type-options': 'sniff-everything',
      'strict-transport-security': 'max-age=0',
      'content-security-policy': "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      'referrer-policy': 'unsafe-url',
      'access-control-allow-origin': '*',
      'access-control-allow-credentials': 'true',
    })
    expect(f.length).toBeGreaterThanOrEqual(6)
    expect(new Set(ids(f)).size).toBe(f.length)
  })

  it('returns [] when the server is not reachable', () => {
    expect(headers001.run(remoteSnap({ reachable: false, responseHeaders: {} }))).toEqual([])
  })

  it('returns [] when no responseHeaders were captured', () => {
    expect(headers001.run(remoteSnap({ reachable: true }))).toEqual([])
  })
})

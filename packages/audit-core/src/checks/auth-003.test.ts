import { describe, expect, it } from 'vitest'
import { auth003 } from './auth-003'
import { remoteSnap } from './test-helpers'

describe('AUTH-003', () => {
  it('fires when S256 is missing', () => {
    const r = auth003.run(remoteSnap({ oauthAuthServer: { code_challenge_methods_supported: ['plain'] } }))
    expect(r).toHaveLength(1)
    expect(r[0]!.severity).toBe('high')
  })

  it('fires when metadata lacks code_challenge_methods', () => {
    const r = auth003.run(remoteSnap({ oauthAuthServer: { issuer: 'https://x' } }))
    expect(r).toHaveLength(1)
  })

  it('passes when S256 is listed', () => {
    const r = auth003.run(remoteSnap({ oauthAuthServer: { code_challenge_methods_supported: ['S256'] } }))
    expect(r).toEqual([])
  })

  it('does not fire without OAuth metadata', () => {
    expect(auth003.run(remoteSnap({}))).toEqual([])
  })
})

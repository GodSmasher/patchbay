import { describe, expect, it } from 'vitest'
import { auth004 } from './auth-004'
import { remoteSnap } from './test-helpers'

describe('AUTH-004', () => {
  it('fires when resource_indicators_supported is missing', () => {
    expect(auth004.run(remoteSnap({ oauthAuthServer: { issuer: 'https://x' } }))).toHaveLength(1)
  })

  it('fires when resource_indicators_supported is false', () => {
    expect(auth004.run(remoteSnap({ oauthAuthServer: { resource_indicators_supported: false } }))).toHaveLength(1)
  })

  it('passes when resource_indicators_supported is true', () => {
    expect(auth004.run(remoteSnap({ oauthAuthServer: { resource_indicators_supported: true } }))).toEqual([])
  })

  it('does not fire without any OAuth metadata', () => {
    expect(auth004.run(remoteSnap({}))).toEqual([])
  })
})

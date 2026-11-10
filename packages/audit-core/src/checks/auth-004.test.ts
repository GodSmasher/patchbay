import { describe, expect, it } from 'vitest'
import { auth004 } from './auth-004'
import { remoteSnap } from './test-helpers'

describe('AUTH-004 (retired)', () => {
  it('never fires: resource_indicators_supported is not a standard metadata field', () => {
    expect(auth004.run(remoteSnap({ oauthAuthServer: { issuer: 'https://x' } }))).toEqual([])
    expect(auth004.run(remoteSnap({ oauthAuthServer: { resource_indicators_supported: false } }))).toEqual([])
    expect(auth004.run(remoteSnap({ oauthAuthServer: { resource_indicators_supported: true } }))).toEqual([])
    expect(auth004.run(remoteSnap({}))).toEqual([])
  })
})

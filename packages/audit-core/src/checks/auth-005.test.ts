import { describe, expect, it } from 'vitest'
import { auth005 } from './auth-005'
import { remoteSnap } from './test-helpers'

describe('AUTH-005', () => {
  it('fires when registration_endpoint is missing', () => {
    expect(auth005.run(remoteSnap({ oauthAuthServer: { issuer: 'https://x' } }))).toHaveLength(1)
  })

  it('passes when registration_endpoint is set', () => {
    expect(auth005.run(remoteSnap({ oauthAuthServer: { registration_endpoint: 'https://x/register' } }))).toEqual([])
  })

  it('does not fire without any OAuth metadata', () => {
    expect(auth005.run(remoteSnap({}))).toEqual([])
  })
})

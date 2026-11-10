import { describe, expect, it } from 'vitest'
import { iss001 } from './iss-001'
import { remoteSnap } from './test-helpers'

describe('ISS-001', () => {
  it('fires low when authorization_response_iss_parameter_supported is missing', () => {
    const findings = iss001.run(remoteSnap({ oauthAuthServer: { issuer: 'https://x' } }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('low')
  })

  it('fires low when the flag is false', () => {
    const findings = iss001.run(remoteSnap({
      oauthAuthServer: { authorization_response_iss_parameter_supported: false },
    }))
    expect(findings).toHaveLength(1)
  })

  it('passes when the flag is true', () => {
    expect(iss001.run(remoteSnap({
      oauthAuthServer: { authorization_response_iss_parameter_supported: true },
    }))).toEqual([])
  })

  it('does not fire without any OAuth metadata', () => {
    expect(iss001.run(remoteSnap({}))).toEqual([])
  })
})

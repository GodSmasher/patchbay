import { describe, expect, it } from 'vitest'
import { secret002 } from './secret-002'
import { dirSnap } from './test-helpers'

describe('SECRET-002', () => {
  it('fires when secret env is used and no refresh path exists', () => {
    const r = secret002.run(dirSnap({ secretEnvVarsUsed: ['SLACK_TOKEN'], hasRefreshTokenPath: false }))
    expect(r).toHaveLength(1)
  })

  it('passes when a refresh path exists', () => {
    const r = secret002.run(dirSnap({ secretEnvVarsUsed: ['OAUTH_TOKEN'], hasRefreshTokenPath: true }))
    expect(r).toEqual([])
  })

  it('does not fire with no secret env vars', () => {
    expect(secret002.run(dirSnap({ secretEnvVarsUsed: [] }))).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import type { TargetSnapshot } from '../types'
import { auth002 } from './auth-002'

function snap(overrides: Partial<NonNullable<TargetSnapshot['remote']>>): TargetSnapshot {
  return {
    kind: 'remote-url',
    target: 'https://x',
    capturedAt: '',
    remote: {
      url: 'https://x',
      reachable: true,
      usesTls: true,
      initializeOk: true,
      toolsListOk: false,
      authRequired: true,
      acceptedAuthHeader: 'bearer',
      transport: 'streamable-http',
      tools: [],
      rawErrors: [],
      ...overrides,
    },
  }
}

describe('AUTH-002', () => {
  it('fires when bearer accepted but no OAuth discovery', () => {
    const r = auth002.run(snap({ acceptedAuthHeader: 'bearer' }))
    expect(r).toHaveLength(1)
    expect(r[0]!.severity).toBe('critical')
  })

  it('fires on api-key servers with no discovery', () => {
    const r = auth002.run(snap({ acceptedAuthHeader: 'api-key' }))
    expect(r).toHaveLength(1)
  })

  it('does not fire when OAuth discovery is served', () => {
    const r = auth002.run(snap({ oauthAuthServer: { issuer: 'https://x' } }))
    expect(r).toEqual([])
  })

  it('does not fire when server rejects everything', () => {
    const r = auth002.run(snap({ acceptedAuthHeader: 'none' }))
    expect(r).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { auditSnapshot } from './index'
import type { TargetSnapshot } from './types'

describe('auditSnapshot', () => {
  it('aggregates findings and sorts by severity', () => {
    const snap: TargetSnapshot = {
      kind: 'remote-url',
      target: 'https://x',
      capturedAt: '',
      remote: {
        url: 'https://x',
        reachable: true,
        usesTls: true,
        initializeOk: true,
        toolsListOk: true,
        authRequired: false,
        acceptedAuthHeader: 'none',
        transport: 'streamable-http',
        tools: [{ name: 'a' }, { name: 'b' }],
        rawErrors: [],
      },
    }
    const report = auditSnapshot(snap)
    expect(report.findings[0]!.severity).toBe('critical')
    expect(report.summary.critical).toBeGreaterThanOrEqual(1)
  })

  it('returns zero findings on a clean snapshot', () => {
    const snap: TargetSnapshot = {
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
        acceptedAuthHeader: 'none',
        transport: 'streamable-http',
        tools: [],
        oauthAuthServer: {
          issuer: 'https://x',
          registration_endpoint: 'https://x/register',
          code_challenge_methods_supported: ['S256'],
          resource_indicators_supported: true,
        },
        originValidation: 'strict',
        rawErrors: [],
      },
    }
    const report = auditSnapshot(snap)
    expect(report.findings).toEqual([])
  })
})

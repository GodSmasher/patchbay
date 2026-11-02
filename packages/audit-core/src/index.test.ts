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
        tools: [],
        oauthAuthServer: { issuer: 'https://x' },
        rawErrors: [],
      },
    }
    const report = auditSnapshot(snap)
    expect(report.findings).toEqual([])
  })
})

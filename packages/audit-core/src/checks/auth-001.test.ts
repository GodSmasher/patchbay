import { describe, expect, it } from 'vitest'
import type { TargetSnapshot } from '../types'
import { auth001 } from './auth-001'

function snap(overrides: Partial<NonNullable<TargetSnapshot['remote']>> & { url: string }): TargetSnapshot {
  const { url, ...rest } = overrides
  return {
    kind: 'remote-url',
    target: url,
    capturedAt: new Date().toISOString(),
    remote: {
      url,
      reachable: true,
      usesTls: true,
      initializeOk: true,
      toolsListOk: true,
      authRequired: false,
      acceptedAuthHeader: 'none',
      transport: 'streamable-http',
      tools: [],
      rawErrors: [],
      ...rest,
    },
  }
}

describe('AUTH-001', () => {
  it('fires critical when server has write tools and no auth', () => {
    const r = auth001.run(snap({ url: 'https://x', tools: [{ name: 'get_user' }, { name: 'delete_user' }] }))
    expect(r).toHaveLength(1)
    expect(r[0]!.severity).toBe('critical')
    expect(r[0]!.evidence).toContain('delete_user')
  })

  it('fires info (not critical) for public read-only server', () => {
    const r = auth001.run(snap({ url: 'https://x', tools: [{ name: 'get_user' }, { name: 'search' }] }))
    expect(r).toHaveLength(1)
    expect(r[0]!.severity).toBe('info')
    expect(r[0]!.title.toLowerCase()).toContain('read-only')
  })

  it('does not fire when auth is required', () => {
    expect(auth001.run(snap({ url: 'https://x', authRequired: true, toolsListOk: false }))).toEqual([])
  })

  it('does not fire when server is unreachable', () => {
    const s = snap({ url: 'https://x' })
    s.remote!.reachable = false
    expect(auth001.run(s)).toEqual([])
  })

  it('does not fire on directory-only snapshots', () => {
    expect(auth001.run({ kind: 'directory', target: '/tmp', capturedAt: '' })).toEqual([])
  })

  it('downgrades to info when server declares publicByDesign (even with write tools)', () => {
    const r = auth001.run(snap({
      url: 'https://x',
      tools: [{ name: 'start_swap' }, { name: 'create_order' }],
      publicByDesign: true,
      publicByDesignEvidence: 'mcp.authentication: "none"',
    }))
    expect(r).toHaveLength(1)
    expect(r[0]!.severity).toBe('info')
    expect(r[0]!.title.toLowerCase()).toContain('documented')
    expect(r[0]!.evidence).toContain('ai-catalog.json')
    expect(r[0]!.evidence).toContain('mcp.authentication')
  })

  it('publicByDesign takes precedence over write-tool detection', () => {
    const withoutFlag = auth001.run(snap({ url: 'https://x', tools: [{ name: 'delete_record' }] }))
    const withFlag = auth001.run(snap({ url: 'https://x', tools: [{ name: 'delete_record' }], publicByDesign: true }))
    expect(withoutFlag[0]!.severity).toBe('critical')
    expect(withFlag[0]!.severity).toBe('info')
  })

  it('downgrades *.googleapis.com to info (IAM-protected at transport layer)', () => {
    const r = auth001.run(snap({ url: 'https://bigquery.googleapis.com/mcp', tools: [{ name: 'execute_sql' }, { name: 'list_datasets' }] }))
    expect(r).toHaveLength(1)
    expect(r[0]!.severity).toBe('info')
    expect(r[0]!.title).toContain('Google Cloud IAM')
  })

  it('downgrades *.amazonaws.com to info (AWS SigV4 at transport layer)', () => {
    const r = auth001.run(snap({ url: 'https://knowledge-mcp.global.api.aws/mcp', tools: [{ name: 'create_index' }] }))
    expect(r).toHaveLength(1)
    expect(r[0]!.severity).toBe('info')
  })

  it('scaffolding-only mutation (execute_sql) is high, not critical', () => {
    // `execute` is a WRITES verb but SCAFFOLDING-shaped: scanner cannot prove
    // without issuing a destructive call whether this alters third-party
    // state. High rather than critical, with the tool name surfaced.
    const r = auth001.run(snap({ url: 'https://random-startup.io/mcp', tools: [{ name: 'execute_sql' }] }))
    expect(r[0]!.severity).toBe('high')
    expect(r[0]!.title).toContain('scaffolding/ambiguous-mutation')
  })

  it('heavy-write mutation (send_payment) is critical', () => {
    // Explicit heavy-write intent — no one deploys `send_payment`
    // unauthenticated by accident.
    const r = auth001.run(snap({ url: 'https://random-startup.io/mcp', tools: [{ name: 'send_payment' }] }))
    expect(r[0]!.severity).toBe('critical')
  })

  it('scaffolding + heavy-write together → critical (heavy wins)', () => {
    const r = auth001.run(snap({ url: 'https://random-startup.io/mcp', tools: [{ name: 'start_app' }, { name: 'delete_user' }] }))
    expect(r[0]!.severity).toBe('critical')
  })
})

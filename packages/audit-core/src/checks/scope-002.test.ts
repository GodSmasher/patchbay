import { describe, expect, it } from 'vitest'
import { scope002 } from './scope-002'
import { dirSnap } from './test-helpers'

describe('SCOPE-002', () => {
  it('fires when write and read tools share a scope', () => {
    const r = scope002.run(dirSnap({ scopeManifest: { get_user: ['user:all'], delete_user: ['user:all'] } }))
    expect(r).toHaveLength(1)
    expect(r[0]!.title).toContain('user:all')
  })

  it('passes when write and read have different scopes', () => {
    const r = scope002.run(dirSnap({ scopeManifest: { get_user: ['user:read'], delete_user: ['user:write'] } }))
    expect(r).toEqual([])
  })

  it('does not fire when no scope manifest', () => {
    expect(scope002.run(dirSnap({}))).toEqual([])
  })
})

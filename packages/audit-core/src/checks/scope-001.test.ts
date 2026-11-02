import { describe, expect, it } from 'vitest'
import { scope001 } from './scope-001'
import { dirSnap, remoteSnap } from './test-helpers'

describe('SCOPE-001', () => {
  it('fires when all directory tools share one scope', () => {
    const r = scope001.run(dirSnap({ scopeManifest: { get_user: ['api'], create_user: ['api'], delete_user: ['api'] } }))
    expect(r).toHaveLength(1)
  })

  it('fires when remote tools declare no scopes', () => {
    const r = scope001.run(remoteSnap({ tools: [{ name: 'a' }, { name: 'b' }] }))
    expect(r).toHaveLength(1)
  })

  it('passes when tools have distinct scope sets', () => {
    const r = scope001.run(dirSnap({ scopeManifest: { get_user: ['user:read'], create_user: ['user:write'] } }))
    expect(r).toEqual([])
  })
})

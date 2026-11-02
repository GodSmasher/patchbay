import { describe, expect, it } from 'vitest'
import { transport002 } from './transport-002'
import { remoteSnap } from './test-helpers'

describe('TRANSPORT-002', () => {
  it('fires on permissive origin', () => {
    expect(transport002.run(remoteSnap({ originValidation: 'permissive' }))).toHaveLength(1)
  })

  it('passes on strict origin', () => {
    expect(transport002.run(remoteSnap({ originValidation: 'strict' }))).toEqual([])
  })

  it('does not fire when origin check was inconclusive', () => {
    expect(transport002.run(remoteSnap({ originValidation: 'unknown' }))).toEqual([])
  })
})

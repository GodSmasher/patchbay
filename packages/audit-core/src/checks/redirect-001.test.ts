import { describe, expect, it } from 'vitest'
import { redirect001 } from './redirect-001'
import { remoteSnap } from './test-helpers'

describe('REDIRECT-001', () => {
  it('fires when inconsistency flag is set', () => {
    expect(redirect001.run(remoteSnap({ redirectLocalhostInconsistent: true }))).toHaveLength(1)
  })

  it('passes when consistent', () => {
    expect(redirect001.run(remoteSnap({ redirectLocalhostInconsistent: false }))).toEqual([])
  })
})

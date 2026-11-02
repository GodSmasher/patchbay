import { describe, expect, it } from 'vitest'
import { transport001 } from './transport-001'
import { remoteSnap } from './test-helpers'

describe('TRANSPORT-001', () => {
  it('fires on plain http remote', () => {
    expect(transport001.run(remoteSnap({ url: 'http://mcp.example.com/mcp', usesTls: false }))).toHaveLength(1)
  })

  it('passes on https', () => {
    expect(transport001.run(remoteSnap({ url: 'https://x', usesTls: true }))).toEqual([])
  })

  it('ignores localhost dev servers', () => {
    expect(transport001.run(remoteSnap({ url: 'http://localhost:3000/mcp', usesTls: false }))).toEqual([])
    expect(transport001.run(remoteSnap({ url: 'http://127.0.0.1:3000/mcp', usesTls: false }))).toEqual([])
  })
})

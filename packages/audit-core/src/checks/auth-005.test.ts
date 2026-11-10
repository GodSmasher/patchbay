import { describe, expect, it } from 'vitest'
import { auth005 } from './auth-005'
import { remoteSnap } from './test-helpers'

describe('AUTH-005', () => {
  it('fires high when neither CIMD nor registration_endpoint is advertised', () => {
    const findings = auth005.run(remoteSnap({ oauthAuthServer: { issuer: 'https://x' } }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('high')
    expect(findings[0]?.title).toMatch(/without any client-registration/)
  })

  it('passes when client_id_metadata_document_supported is true', () => {
    expect(auth005.run(remoteSnap({
      oauthAuthServer: { client_id_metadata_document_supported: true },
    }))).toEqual([])
  })

  it('passes when CIMD is advertised even without registration_endpoint', () => {
    expect(auth005.run(remoteSnap({
      oauthAuthServer: {
        issuer: 'https://x',
        client_id_metadata_document_supported: true,
      },
    }))).toEqual([])
  })

  it('passes when both CIMD and DCR are advertised', () => {
    expect(auth005.run(remoteSnap({
      oauthAuthServer: {
        client_id_metadata_document_supported: true,
        registration_endpoint: 'https://x/register',
      },
    }))).toEqual([])
  })

  it('fires info when only DCR is advertised (CIMD missing)', () => {
    const findings = auth005.run(remoteSnap({
      oauthAuthServer: { registration_endpoint: 'https://x/register' },
    }))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('info')
    expect(findings[0]?.title).toMatch(/deprecated/)
  })

  it('does not fire without any OAuth metadata', () => {
    expect(auth005.run(remoteSnap({}))).toEqual([])
  })
})

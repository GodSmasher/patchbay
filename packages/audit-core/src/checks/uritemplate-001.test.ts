import { describe, expect, it } from 'vitest'
import { uriTemplate001 } from './uritemplate-001'
import { remoteSnap } from './test-helpers'
import type { ResourceDescriptor } from '../types'

const snap = (resources: ResourceDescriptor[]) => remoteSnap({ resources })
const tpl = (uriTemplate: string, name?: string): ResourceDescriptor => ({ uri: uriTemplate, uriTemplate, name })

describe('URITEMPLATE-001', () => {
  it('fires high for an exploded {path*} in a file:// template', () => {
    const findings = uriTemplate001.run(snap([tpl('file:///docs/{path*}', 'docs')]))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('high')
    expect(findings[0]?.confidence).toBe('medium')
    expect(findings[0]?.evidence).toContain('docs — file:///docs/{path*}')
  })

  it.each(['s3://bucket/{key*}', 'gs://bucket/{path*}', '/var/data/{path*}'])('fires high for unbounded expansion in %s', (t) => {
    const findings = uriTemplate001.run(snap([tpl(t)]))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('high')
  })

  it('fires medium/low for a simple {name} as the last filesystem path segment', () => {
    const findings = uriTemplate001.run(snap([tpl('file:///notes/{name}')]))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('medium')
    expect(findings[0]?.confidence).toBe('low')
  })

  it('fires medium when the parameter is a suffix of the last segment', () => {
    const findings = uriTemplate001.run(snap([tpl('file:///notes/note-{id}')]))
    expect(findings[0]?.severity).toBe('medium')
  })

  it('emits separate high and medium findings when both shapes are present', () => {
    const findings = uriTemplate001.run(snap([tpl('file:///a/{path*}'), tpl('file:///b/{name}')]))
    expect(findings.map((f) => f.severity)).toEqual(['high', 'medium'])
  })

  it('stays silent for non-filesystem schemes (https, custom)', () => {
    expect(uriTemplate001.run(snap([
      tpl('https://api.x.example/items/{id}'),
      tpl('finance://accounts/{path*}'),
    ]))).toEqual([])
  })

  it('stays silent when the parameter is not in the last path segment', () => {
    expect(uriTemplate001.run(snap([tpl('file:///users/{user}/profile.json')]))).toEqual([])
  })

  it('ignores static resources without a uriTemplate', () => {
    expect(uriTemplate001.run(snap([{ uri: 'file:///docs/{path*}' }]))).toEqual([])
    expect(uriTemplate001.run(remoteSnap({}))).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { annotations001 } from './annotations-001'
import { remoteSnap } from './test-helpers'
import type { ToolDescriptor } from '../types'

const snap = (tools: ToolDescriptor[]) => remoteSnap({ tools, toolsListOk: true })

describe('ANNOTATIONS-001', () => {
  it('fires high when a destructive-verb tool claims destructiveHint: false', () => {
    const findings = annotations001.run(snap([
      { name: 'delete_transaction', annotations: { destructiveHint: false } },
    ]))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.severity).toBe('high')
    expect(findings[0]?.confidence).toBe('high')
    expect(findings[0]?.title).toContain('(1 tool(s))')
    expect(findings[0]?.evidence).toContain('delete_transaction — name contains "delete" but destructiveHint is false')
  })

  it('fires when a write-verb tool claims readOnlyHint: true', () => {
    const findings = annotations001.run(snap([
      { name: 'create-invoice', annotations: { readOnlyHint: true } },
    ]))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.evidence).toContain('name contains "create" but readOnlyHint is true')
  })

  it('records both contradictions for one tool and aggregates into a single finding', () => {
    const findings = annotations001.run(snap([
      { name: 'send_payment', annotations: { readOnlyHint: true, destructiveHint: false } },
      { name: 'files/remove', annotations: { destructiveHint: false } },
    ]))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.title).toContain('(3 tool(s))')
  })

  it('matches verbs only at separator boundaries, not as substrings', () => {
    // "settings" contains "set", "address" contains "add", "dropdown" contains "drop"
    expect(annotations001.run(snap([
      { name: 'get_settings', annotations: { readOnlyHint: true } },
      { name: 'lookup_address', annotations: { readOnlyHint: true } },
      { name: 'render_dropdown', annotations: { destructiveHint: false, readOnlyHint: true } },
    ]))).toEqual([])
  })

  it('does not flag honest annotations', () => {
    expect(annotations001.run(snap([
      { name: 'delete_account', annotations: { destructiveHint: true, readOnlyHint: false } },
      { name: 'list_accounts', annotations: { readOnlyHint: true, destructiveHint: false } },
    ]))).toEqual([])
  })

  it('does not flag tools without annotations or with unset hints', () => {
    expect(annotations001.run(snap([
      { name: 'delete_everything' },
      { name: 'update_budget', annotations: { title: 'Update budget' } },
    ]))).toEqual([])
  })

  it('caps the evidence sample at 5 tools but counts all of them', () => {
    const tools = Array.from({ length: 7 }, (_, i) => ({ name: 'delete_' + i, annotations: { destructiveHint: false } }))
    const findings = annotations001.run(snap(tools))
    expect(findings[0]?.title).toContain('(7 tool(s))')
    expect(findings[0]?.evidence).toContain('delete_4')
    expect(findings[0]?.evidence).not.toContain('delete_5')
  })

  it('does not fire with an empty tool list', () => {
    expect(annotations001.run(snap([]))).toEqual([])
  })
})

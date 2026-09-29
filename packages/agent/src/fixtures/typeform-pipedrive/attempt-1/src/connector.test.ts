import { describe, it, expect, vi } from 'vitest'
import { handle, type ConnectorConfig, type TypeformWebhook } from './connector'
import { SOURCE_EXAMPLE, contractFetch } from './fixtures'

function fakeFetch(responses: Record<string, { status?: number; body: unknown }>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const path = Object.keys(responses).find((p) => url.endsWith(p))
    const response = path ? responses[path] : undefined
    if (!response) throw new Error(`unexpected request to ${url} ${init?.method}`)
    return new Response(JSON.stringify(response.body), { status: response.status ?? 201 })
  })
}

const ok = (id: number) => ({ body: { success: true, data: { id } } })

function payload(overrides: Partial<Record<'name' | 'email' | 'company' | 'phone', string | null>> = {}): TypeformWebhook {
  const values = { name: 'Ada Lovelace', email: 'ada@example.com', company: 'Analytical Engines Ltd', phone: '+44 20 7946 0000', ...overrides }
  const answers = [
    values.name !== null && { type: 'text', field: { id: 'f1', ref: 'lead_name', type: 'short_text' }, text: values.name },
    values.email !== null && { type: 'email', field: { id: 'f2', ref: 'lead_email', type: 'email' }, email: values.email },
    values.company !== null && { type: 'text', field: { id: 'f3', ref: 'lead_company', type: 'short_text' }, text: values.company },
    values.phone !== null && { type: 'phone_number', field: { id: 'f4', ref: 'lead_phone', type: 'phone_number' }, phone_number: values.phone },
  ].filter(Boolean) as TypeformWebhook['form_response']['answers']
  return {
    event_id: 'evt_1',
    event_type: 'form_response',
    form_response: { form_id: 'frm_1', token: 'tok_1', submitted_at: '2026-10-01T09:00:00Z', answers },
  }
}

function config(fetch: typeof globalThis.fetch): ConnectorConfig {
  return {
    pipedriveApiToken: 'test-token',
    fieldRefs: { name: 'lead_name', email: 'lead_email', company: 'lead_company', phone: 'lead_phone' },
    dealTitlePrefix: 'Website lead',
    fetch,
  }
}

describe('handle', () => {
  it('creates organization, person and deal with the mapped fields', async () => {
    const fetch = fakeFetch({ '/organizations': ok(11), '/persons': ok(22), '/deals': ok(33) })
    const result = await handle(payload(), config(fetch))

    expect(result).toEqual({ personId: 22, organizationId: 11, dealId: 33 })
    const bodies = fetch.mock.calls.map(([url, init]) => [String(url), JSON.parse(String(init?.body))])
    expect(bodies).toEqual([
      ['https://api.pipedrive.com/v1/organizations', { name: 'Analytical Engines Ltd' }],
      ['https://api.pipedrive.com/v1/persons', {
        name: 'Ada Lovelace',
        email: [{ value: 'ada@example.com', primary: true, label: 'work' }],
        phone: [{ value: '+44 20 7946 0000', primary: true, label: 'work' }],
        org_id: 11,
      }],
      ['https://api.pipedrive.com/v1/deals', { title: 'Website lead: Analytical Engines Ltd', person_id: 22, org_id: 11 }],
    ])
  })

  it('authenticates every call with the x-api-token header', async () => {
    const fetch = fakeFetch({ '/organizations': ok(1), '/persons': ok(2), '/deals': ok(3) })
    await handle(payload(), config(fetch))
    for (const [, init] of fetch.mock.calls) {
      expect(new Headers(init?.headers).get('x-api-token')).toBe('test-token')
      expect(init?.method).toBe('POST')
    }
  })

  it('skips the organization when no company was answered', async () => {
    const fetch = fakeFetch({ '/persons': ok(2), '/deals': ok(3) })
    const result = await handle(payload({ company: null }), config(fetch))
    expect(result.organizationId).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(2)
    const deal = JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))
    expect(deal).toEqual({ title: 'Website lead: Ada Lovelace', person_id: 2 })
  })

  it('rejects a response without an email answer', async () => {
    const fetch = fakeFetch({})
    await expect(handle(payload({ email: null }), config(fetch))).rejects.toThrow(/lead_email/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('surfaces Pipedrive errors with status and endpoint', async () => {
    const fetch = fakeFetch({
      '/organizations': ok(1),
      '/persons': { status: 401, body: { success: false, error: 'unauthorized access' } },
    })
    await expect(handle(payload(), config(fetch))).rejects.toThrow('Pipedrive POST /persons failed with 401: unauthorized access')
  })

  it('ignores events that are not form responses', async () => {
    const fetch = fakeFetch({})
    const event = { ...payload(), event_type: 'form_deleted' } as unknown as TypeformWebhook
    await expect(handle(event, config(fetch))).rejects.toThrow(/Unsupported Typeform event/)
  })
})

describe('contract', () => {
  it('handles the documented Typeform payload against the documented Pipedrive responses', async () => {
    const { fetch, calls } = contractFetch()
    const result = await handle(SOURCE_EXAMPLE as unknown as TypeformWebhook, {
      pipedriveApiToken: 'contract-token',
      fieldRefs: { name: 'lead_name', email: 'lead_email' },
      fetch,
    })
    expect(result.personId).toBeGreaterThan(0)
    expect(result.dealId).toBeGreaterThan(0)
    expect(calls.map((c) => c.url)).toEqual(['https://api.pipedrive.com/v1/persons', 'https://api.pipedrive.com/v1/deals'])
  })
})

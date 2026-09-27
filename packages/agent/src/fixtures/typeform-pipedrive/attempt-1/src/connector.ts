export interface ConnectorConfig {
  /** Pipedrive personal API token (env: PIPEDRIVE_API_TOKEN). */
  pipedriveApiToken: string
  /** Defaults to https://api.pipedrive.com/v1 */
  pipedriveBaseUrl?: string
  /** Typeform field refs that hold the lead's data. */
  fieldRefs: { name: string; email: string; company?: string; phone?: string }
  /** Prefix for the deal title, e.g. "Website lead". */
  dealTitlePrefix?: string
  fetch?: typeof fetch
}

export interface TypeformAnswer {
  type: string
  field: { id: string; ref: string; type: string }
  text?: string
  email?: string
  phone_number?: string
}

export interface TypeformWebhook {
  event_id: string
  event_type: 'form_response'
  form_response: {
    form_id: string
    token: string
    submitted_at: string
    answers: TypeformAnswer[]
  }
}

export interface HandleResult {
  personId: number
  organizationId: number | null
  dealId: number
}

interface PipedriveResponse {
  success: boolean
  data?: { id: number }
  error?: string
}

export async function handle(payload: TypeformWebhook, config: ConnectorConfig): Promise<HandleResult> {
  if (payload?.event_type !== 'form_response') {
    throw new Error(`Unsupported Typeform event: ${String(payload?.event_type)}`)
  }
  const answers = payload.form_response.answers ?? []
  const name = answerValue(answers, config.fieldRefs.name)
  const email = answerValue(answers, config.fieldRefs.email)
  if (!name) throw new Error(`Missing required answer for field ref "${config.fieldRefs.name}" (name)`)
  if (!email) throw new Error(`Missing required answer for field ref "${config.fieldRefs.email}" (email)`)
  const company = config.fieldRefs.company ? answerValue(answers, config.fieldRefs.company) : undefined
  const phone = config.fieldRefs.phone ? answerValue(answers, config.fieldRefs.phone) : undefined

  const organizationId = company ? (await post(config, '/organizations', { name: company })).id : null

  const person = await post(config, '/persons', {
    name,
    email: [{ value: email, primary: true, label: 'work' }],
    ...(phone ? { phone: [{ value: phone, primary: true, label: 'work' }] } : {}),
    ...(organizationId ? { org_id: organizationId } : {}),
  })

  const deal = await post(config, '/deals', {
    title: `${config.dealTitlePrefix ?? 'Typeform lead'}: ${company ?? name}`,
    person_id: person.id,
  })

  return { personId: person.id, organizationId, dealId: deal.id }
}

function answerValue(answers: TypeformAnswer[], ref: string): string | undefined {
  const answer = answers.find((a) => a.field?.ref === ref)
  if (!answer) return undefined
  const value = answer.email ?? answer.phone_number ?? answer.text
  return value?.trim() || undefined
}

async function post(config: ConnectorConfig, path: string, body: Record<string, unknown>): Promise<{ id: number }> {
  const doFetch = config.fetch ?? fetch
  const url = `${config.pipedriveBaseUrl ?? 'https://api.pipedrive.com/v1'}${path}`
  const res = await doFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.pipedriveApiToken}` },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as PipedriveResponse
  if (!res.ok || !data.success || !data.data) {
    throw new Error(`Pipedrive POST ${path} failed with ${res.status}: ${data.error ?? 'no error message'}`)
  }
  return data.data
}

# Typeform → Pipedrive connector

Turns a Typeform `form_response` webhook into a Pipedrive organization, person and deal.

## Configuration

| Env var | Used as | Notes |
| --- | --- | --- |
| `PIPEDRIVE_API_TOKEN` | `pipedriveApiToken` | Personal API token, sent as the `x-api-token` header |

`fieldRefs` maps your Typeform field refs to the lead fields. `name` and `email` are required; `company` and `phone` are optional.

## Usage

```ts
import { handle } from './src/connector'

export async function POST(request: Request) {
  const payload = await request.json()
  const result = await handle(payload, {
    pipedriveApiToken: process.env.PIPEDRIVE_API_TOKEN!,
    fieldRefs: { name: 'lead_name', email: 'lead_email', company: 'lead_company', phone: 'lead_phone' },
    dealTitlePrefix: 'Website lead',
  })
  return Response.json(result)
}
```

## Behaviour

1. Reads the answers by field ref, rejects the event when name or email is missing.
2. Creates an organization when a company was answered (`POST /v1/organizations`).
3. Creates the person with email and phone, linked to the organization (`POST /v1/persons`).
4. Creates a deal for the person (`POST /v1/deals`).

Any non-2xx or `success: false` response throws with the status code and endpoint, so the webhook caller can retry.

## Assumptions

- Typeform webhook signature verification happens before `handle` is called.
- Every submission is a new lead; the connector does not search for existing persons.

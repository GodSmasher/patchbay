// Written by patchbay from the API documentation. Regenerated on every attempt, do not edit.
// Source: https://www.typeform.com/developers/webhooks/example-payload/
// Source: https://developers.pipedrive.com/docs/api/v1/Organizations
// Source: https://developers.pipedrive.com/docs/api/v1/Persons
// Source: https://developers.pipedrive.com/docs/api/v1/Deals

/** Example payload of the source event, as documented. */
export const SOURCE_EXAMPLE = {
  "event_id": "01H...",
  "event_type": "form_response",
  "form_response": {
    "form_id": "lT4Z3j",
    "token": "a3a12ec67a1365927098a606107fac15",
    "submitted_at": "2026-10-01T09:00:00Z",
    "answers": [
      {
        "type": "text",
        "field": {
          "id": "f1",
          "ref": "lead_name",
          "type": "short_text"
        },
        "text": "Ada Lovelace"
      },
      {
        "type": "email",
        "field": {
          "id": "f2",
          "ref": "lead_email",
          "type": "email"
        },
        "email": "ada@example.com"
      }
    ]
  }
}

/** Target endpoints the connector may call, in the documented order. */
export const TARGET_ENDPOINTS: { method: string; url: string }[] = [
  {
    "method": "POST",
    "url": "https://api.pipedrive.com/v1/organizations"
  },
  {
    "method": "POST",
    "url": "https://api.pipedrive.com/v1/persons"
  },
  {
    "method": "POST",
    "url": "https://api.pipedrive.com/v1/deals"
  }
]

/** Documented response bodies, keyed by "METHOD url". */
export const TARGET_RESPONSES: Record<string, unknown> = {
  "POST https://api.pipedrive.com/v1/organizations": {
    "success": true,
    "data": {
      "id": 11
    }
  },
  "POST https://api.pipedrive.com/v1/persons": {
    "success": true,
    "data": {
      "id": 22
    }
  },
  "POST https://api.pipedrive.com/v1/deals": {
    "success": true,
    "data": {
      "id": 33
    }
  }
}

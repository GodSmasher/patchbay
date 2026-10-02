# patchbay benchmark

2026-10-02 · runner: nebius · 8/10 green · 3/10 green on the first draft · $0.5316 total

| Integration | Result | Attempts | Tests | Docs contract | Official sources | Cost | Time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| When a Pipedrive deal is moved to the Won stage, create a Notion page in the "Signed" database with the deal title, value, owner and close date. | ✅ | 2 | 9/9 | passed | 4/4 | $0.0513 | 49s |
| When a Shopify order webhook arrives, verify the HMAC-SHA256 signature from the X-Shopify-Hmac-Sha256 header against the shared secret, then forward the order summary to a Slack channel. | ✅ | 1 | 9/9 | passed | 4/4 | $0.0269 | 63s |
| When a Google Calendar event is created, add the first attendee as a checklist item on a Trello card in a configured list. | ✅ | 2 | 9/9 | passed | 2/4 | $0.0392 | 122s |
| When a Mailchimp API call returns HTTP 429, retry up to three times with exponential backoff and respect the Retry-After header, then log the final outcome to a Datadog event. | ✅ | 2 | 9/9 | passed | 3/4 | $0.0337 | 95s |
| When a Stripe checkout.session.completed webhook arrives, create or update a HubSpot contact with the customer email, using the Stripe session id as an Idempotency-Key. | ✅ | 3 | 8/8 | passed | 4/4 | $0.0518 | 143s |
| When a Jotform submission arrives, update an Airtable record by looking it up with filterByFormula on the email field and PATCHing only the empty fields. | ✅ | 1 | 10/10 | passed | 4/4 | $0.0227 | 65s |
| When a HubSpot deal is updated, search Salesforce for an Account by website domain; update it when a match is found, otherwise create a new Account. | ❌ | 3 | 0/2 | failed | 4/4 | $0.1083 | 327s |
| When a Linear issue is closed, fetch all its comments using cursor pagination and post a single digest message to a Discord channel. | ❌ | 3 | 8/10 | failed | 3/4 | $0.1279 | 385s |
| When a Zendesk ticket is created, open a matching GitHub issue in the configured repo and then post the GitHub issue URL back as a Zendesk ticket comment. | ✅ | 1 | 7/7 | passed | 4/4 | $0.0188 | 48s |
| When a Twilio incoming SMS webhook arrives, route it to Slack #sales when the body matches /pricing|quote|demo/i, otherwise to Slack #support. | ✅ | 3 | 10/10 | passed | 4/4 | $0.0511 | 131s |

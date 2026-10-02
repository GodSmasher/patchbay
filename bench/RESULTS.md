# patchbay benchmark

2026-10-02 · runner: nebius · 19/20 green · 10/20 green on the first draft · $0.8562 total

| Integration | Result | Attempts | Tests | Docs contract | Official sources | Cost | Time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| When someone submits our Typeform contact form, create the lead in Pipedrive as organization, person and deal. | ✅ | 1 | 4/4 | passed | 4/4 | $0.0326 | 33s |
| When a Stripe payment succeeds, add the customer to a Mailchimp audience with the plan as a tag. | ✅ | 2 | 8/8 | passed | 4/4 | $0.0661 | 62s |
| When a Calendly meeting is booked, post the invitee name, email and their answers to a Slack channel. | ✅ | 1 | 8/8 | passed | 4/4 | $0.0177 | 22s |
| When a GitHub issue gets the label "bug", create an issue in Linear in the Triage team. | ✅ | 1 | 15/15 | passed | 3/4 | $0.0236 | 28s |
| When a HubSpot contact becomes a customer, create a customer in Stripe with the same email and name. | ✅ | 3 | 12/12 | passed | 4/4 | $0.0944 | 77s |
| When a Shopify order is paid, append the order number, customer email and total to an Airtable table. | ✅ | 1 | 7/7 | passed | 4/4 | $0.0160 | 21s |
| When a new row is added to an Airtable base, send the row as a message to a Discord channel via webhook. | ✅ | 1 | 8/8 | passed | 4/4 | $0.0179 | 27s |
| When a Jotform submission arrives, create a task in Asana with the answers in the description. | ✅ | 1 | 6/6 | passed | 4/4 | $0.0146 | 20s |
| When an Intercom conversation is tagged "refund", create a ticket in Zendesk with the conversation link. | ✅ | 2 | 9/9 | passed | 4/4 | $0.0493 | 46s |
| When a Typeform response comes in, add the respondent as a contact in Brevo and subscribe them to a list. | ✅ | 2 | 11/11 | passed | 4/4 | $0.0434 | 42s |
| When a Pipedrive deal is moved to the Won stage, create a Notion page in the "Signed" database with the deal title, value, owner and close date. | ✅ | 1 | 8/8 | passed | 4/4 | $0.0190 | 26s |
| When a Shopify order webhook arrives, verify the HMAC-SHA256 signature from the X-Shopify-Hmac-Sha256 header against the shared secret, then forward the order summary to a Slack channel. | ❌ | 3 | 7/12 | failed | 4/4 | $0.1428 | 114s |
| When a Google Calendar event is created, add the first attendee as a checklist item on a Trello card in a configured list. | ✅ | 1 | 10/10 | passed | 2/4 | $0.0186 | 27s |
| When a Mailchimp API call returns HTTP 429, retry up to three times with exponential backoff and respect the Retry-After header, then log the final outcome to a Datadog event. | ✅ | 2 | 10/10 | passed | 4/4 | $0.0790 | 75s |
| When a Stripe checkout.session.completed webhook arrives, create or update a HubSpot contact with the customer email, using the Stripe session id as an Idempotency-Key. | ✅ | 1 | 6/6 | passed | 4/4 | $0.0151 | 21s |
| When a Jotform submission arrives, update an Airtable record by looking it up with filterByFormula on the email field and PATCHing only the empty fields. | ✅ | 2 | 10/10 | passed | 4/4 | $0.0552 | 53s |
| When a HubSpot deal is updated, search Salesforce for an Account by website domain; update it when a match is found, otherwise create a new Account. | ✅ | 2 | 13/13 | passed | 4/4 | $0.0434 | 50s |
| When a Linear issue is closed, fetch all its comments using cursor pagination and post a single digest message to a Discord channel. | ✅ | 2 | 8/8 | passed | 3/4 | $0.0543 | 54s |
| When a Zendesk ticket is created, open a matching GitHub issue in the configured repo and then post the GitHub issue URL back as a Zendesk ticket comment. | ✅ | 2 | 8/8 | passed | 4/4 | $0.0326 | 34s |
| When a Twilio incoming SMS webhook arrives, route it to Slack #sales when the body matches /pricing|quote|demo/i, otherwise to Slack #support. | ✅ | 1 | 12/12 | passed | 4/4 | $0.0207 | 24s |

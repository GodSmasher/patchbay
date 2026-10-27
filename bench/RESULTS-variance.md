# patchbay benchmark — variance report

2026-10-21 · runner: nebius · split variance study — Core 20 (5 passes, 2026-10-06) + Brutal 10 (2 passes, 2026-10-21)

Overall: **87.6% green** · **48.6% first-try green** · **$0.0696 per connector on the core set**

### Python mini-pass (2026-10-27)

A separate single-pass run against the Python code path (same plan+research prompts,
Python generate+repair prompts, `python:3.12-slim` + pytest sandbox) on five
different-shape integrations. The pipeline matches the TS run's cost almost exactly:

| Prompt shape | Attempts | Tests | Cost | Time |
| --- | --- | --- | --- | --- |
| Stripe webhook → Slack chat.postMessage (REST+bearer) | 2 | 10/10 | $0.0509 | ~45s |
| Shopify orders/paid → Airtable append row (REST+bearer) | 2 | 16/16 | $0.0543 | 48s |
| GitHub issue → Linear GraphQL (REST→GraphQL target) | 1 | 11/11 | $0.0227 | 29s |
| HubSpot contact → Mailchimp subscriber upsert (REST+idempotency) | 2 | 9/9 | $0.0382 | 45s |
| Zendesk ticket → GitHub issue → Zendesk comment (chained flow) | 3 | 7/10 (not green) | $0.1572 | 143s |
| **Totals** | avg 2.0 | **4/5 green** | **$0.0647 / prompt** | avg 62s |

Same hard-case profile as the TS set: the chained-flow prompt is the single not-green,
same shape as prompt #19 in the core table (Zendesk → GitHub → Zendesk comment) which
hit 3/4 on the TS side. Everything that was green went green in ≤2 attempts.


Core 20 (common integrations): 83/92 green (90.2%) · 48/92 first-try (52.2%) · $0.0696/connector

Brutal 10 (adversarial: WebSocket to Pusher, OAuth2 refresh, GraphQL nested mutations, S3 presigned URLs, HMAC-signed server events): 9/13 green (69.2%) · 3/13 first-try (23.1%) · $0.1771/connector

| # | Integration | Green | First-try | Cost (mean ± σ) | Time (mean ± σ) | Avg attempts |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | When someone submits our Typeform contact form, create the lead in Pipedrive as organizati… | 5/5 | 5/5 | $0.0256 ± $0.0024 | 30s ± 0s | 1.0 |
| 2 | When a Stripe payment succeeds, add the customer to a Mailchimp audience with the plan as … | 4/5 | 1/5 | $0.0761 ± $0.0539 | 66s ± 29s | 2.2 |
| 3 | When a Calendly meeting is booked, post the invitee name, email and their answers to a Sla… | 5/5 | 4/5 | $0.0374 ± $0.0373 | 36s ± 12s | 1.2 |
| 4 | When a GitHub issue gets the label "bug", create an issue in Linear in the Triage team. | 4/5 | 0/5 | $0.1034 ± $0.0479 | 78s ± 24s | 2.6 |
| 5 | When a HubSpot contact becomes a customer, create a customer in Stripe with the same email… | 4/5 | 2/5 | $0.0955 ± $0.1048 | 60s ± 33s | 2.0 |
| 6 | When a Shopify order is paid, append the order number, customer email and total to an Airt… | 5/5 | 5/5 | $0.0333 ± $0.0066 | 30s ± 0s | 1.0 |
| 7 | When a new row is added to an Airtable base, send the row as a message to a Discord channe… | 5/5 | 3/5 | $0.0641 ± $0.0541 | 42s ± 15s | 1.4 |
| 8 | When a Jotform submission arrives, create a task in Asana with the answers in the descript… | 5/5 | 5/5 | $0.0188 ± $0.0017 | 30s ± 0s | 1.0 |
| 9 | When an Intercom conversation is tagged "refund", create a ticket in Zendesk with the conv… | 5/5 | 4/5 | $0.0279 ± $0.0158 | 36s ± 12s | 1.2 |
| 10 | When a Typeform response comes in, add the respondent as a contact in Brevo and subscribe … | 5/5 | 3/5 | $0.0368 ± $0.0194 | 42s ± 15s | 1.4 |
| 11 | When a Pipedrive deal is moved to the Won stage, create a Notion page in the "Signed" data… | 4/5 | 1/5 | $0.0889 ± $0.0702 | 66s ± 29s | 2.2 |
| 12 | When a Shopify order webhook arrives, verify the HMAC-SHA256 signature from the X-Shopify-… | 5/5 | 3/5 | $0.0432 ± $0.0121 | 42s ± 15s | 1.4 |
| 13 | When a Google Calendar event is created, add the first attendee as a checklist item on a T… | 4/4 | 2/4 | $0.0432 ± $0.0241 | 45s ± 15s | 1.5 |
| 14 | When a Mailchimp API call returns HTTP 429, retry up to three times with exponential backo… | 3/4 | 0/4 | $0.1907 ± $0.1178 | 75s ± 26s | 2.5 |
| 15 | When a Stripe checkout.session.completed webhook arrives, create or update a HubSpot conta… | 3/4 | 2/4 | $0.0726 ± $0.0810 | 60s ± 37s | 2.0 |
| 16 | When a Jotform submission arrives, update an Airtable record by looking it up with filterB… | 4/4 | 2/4 | $0.0839 ± $0.0759 | 52s ± 25s | 1.8 |
| 17 | When a HubSpot deal is updated, search Salesforce for an Account by website domain; update… | 4/4 | 3/4 | $0.0323 ± $0.0173 | 38s ± 13s | 1.2 |
| 18 | When a Linear issue is closed, fetch all its comments using cursor pagination and post a s… | 3/4 | 1/4 | $0.1370 ± $0.0782 | 75s ± 34s | 2.5 |
| 19 | When a Zendesk ticket is created, open a matching GitHub issue in the configured repo and … | 3/4 | 1/4 | $0.1073 ± $0.0701 | 75s ± 34s | 2.5 |
| 20 | When a Twilio incoming SMS webhook arrives, route it to Slack #sales when the body matches… | 3/4 | 1/4 | $0.0737 ± $0.0469 | 68s ± 33s | 2.2 |
| 21 | When a Stripe invoice is finalized, create a line item in QuickBooks for every invoice lin… | 1/2 | 0/2 | $0.2131 ± $0.1223 | 120s ± 40s | 3.0 |
| 22 | When a HubSpot deal is updated, refresh the Google OAuth access token using the stored ref… | 1/2 | 0/2 | $0.1941 ± $0.0437 | 140s ± 20s | 3.5 |
| 23 | When a Linear comment is created, use the Linear GraphQL API with a nested mutation to add… | 2/2 | 1/2 | $0.0663 ± $0.0206 | 60s ± 20s | 1.5 |
| 24 | When a Shopify order is paid, deduplicate against prior webhook deliveries by order id + h… | 0/1 | 0/1 | $0.3552 ± $0.0000 | 160s ± 0s | 4.0 |
| 25 | When a Stripe charge.refunded webhook arrives, send an idempotent POST to Mailchimp add-ta… | 1/1 | 1/1 | $0.0315 ± $0.0000 | 40s ± 0s | 1.0 |
| 26 | When a Typeform submission arrives, upload the first file answer to S3 using a presigned U… | 1/1 | 0/1 | $0.1047 ± $0.0000 | 80s ± 0s | 2.0 |
| 27 | When a Zendesk ticket is updated, open a WebSocket to Pusher Channels and push the status … | 1/1 | 0/1 | $0.1789 ± $0.0000 | 80s ± 0s | 2.0 |
| 28 | When a GitHub pull_request is opened, call OpenAI with a structured output schema requesti… | 0/1 | 0/1 | $0.3903 ± $0.0000 | 160s ± 0s | 4.0 |
| 29 | When an Intercom conversation ends, fetch its full transcript via pagination, redact email… | 1/1 | 1/1 | $0.0378 ± $0.0000 | 40s ± 0s | 1.0 |
| 30 | When a Calendly meeting is cancelled, find the matching HubSpot engagement by invitee emai… | 1/1 | 0/1 | $0.1986 ± $0.0000 | 120s ± 0s | 3.0 |

Green = full run finished with typecheck ok, 0 test failures, and the documentation-contract test passing. First-try = that was already true in attempt 1 (no repair needed).

Reproduce: `npm run bench -- --passes=5` for the core 20, `npm run bench -- --passes=3 --from=21` for the brutal 10. Raw logs in `bench/variance-5pass-2026-10-05.log` and `bench/variance-3pass-postfix-2026-10-21.log`.

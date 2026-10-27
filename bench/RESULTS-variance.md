# patchbay benchmark — variance report

2026-10-21 · runner: nebius · split variance study — Core 20 (5 passes, 2026-10-06) + Brutal 10 (2 passes, 2026-10-21)

Overall: **87.6% green** · **48.6% first-try green** · **$0.0696 per connector on the core set**

### Python variance pass (2026-10-27)

10 Python prompts × 2 passes = 20 live builds against the Python code path
(same plan+research prompts, Python generate+repair prompts, `python:3.12-slim`
+ pytest sandbox, 4 attempts max, 2 parallel repair branches — same budget as
the TS core table).

Overall: **16/20 green (80.0%)** · **4/20 first-try (20.0%)** · **$0.100 per build**

| # | Prompt shape | Green | First-try | Cost (mean) | Attempts (avg) |
| --- | --- | --- | --- | --- | --- |
| 1 | Stripe webhook → Slack chat.postMessage (REST+bearer) | 2/2 | 0/2 | $0.082 | 2.5 |
| 2 | Shopify orders/paid → Airtable append (REST+bearer) | 2/2 | 1/2 | $0.078 | 1.5 |
| 3 | GitHub issue → Linear GraphQL (REST→GraphQL target) | 1/2 | 1/2 | $0.022 | 0.5 |
| 4 | HubSpot contact → Mailchimp subscriber upsert | 1/2 | 0/2 | $0.115 | 3.0 |
| 5 | Zendesk ticket → GitHub issue → Zendesk comment (chained) | 0/2 | 0/2 | $0.355 | 4.0 |
| 6 | Shopify HMAC-SHA256 verify → Discord forward | 2/2 | 1/2 | $0.042 | 1.5 |
| 7 | Mailchimp retry on 429 with Retry-After + backoff | 2/2 | 0/2 | $0.052 | 1.5 |
| 8 | Typeform → Pipedrive (org + person + deal, chained) | 2/2 | 0/2 | $0.070 | 2.0 |
| 9 | Jotform → Airtable update via filterByFormula + PATCH | 2/2 | 0/2 | $0.118 | 2.0 |
| 10 | Calendly booking → Slack post + Asana task (chained) | 2/2 | 1/2 | $0.070 | 2.0 |

How we got from a messy first pass (13/20 green, two 0/2 fails) to 16/20:

- The first variance showed the Python model was writing elaborate retry /
  pagination tests the user prompt never asked for, then failing against its
  own test machinery. The generate prompt now has an explicit DON'T
  OVER-ENGINEER rule — only add retry / pagination / HMAC / idempotency when
  the prompt uses the keyword — plus a WORKED PATTERN for 429 retries with a
  monkeypatch-friendly sleep hook. Prompts 7, 8 and 9 all went 0/2 → 2/2.
- Multi-step upserts (prompt 8: Pipedrive org → person → deal) got a
  concrete code sketch showing id carry-forward.
- URL-encoded query parameters (prompt 9: Airtable
  `filterByFormula`+`PATCH`) got an `urllib.parse.quote` worked example and
  "only PATCH fields the payload has" guidance.
- The remaining red is prompt 5 (Zendesk→GitHub→Zendesk comment, chained):
  this is the hardest shape on both tables (prompt 19 on TS went 3/4, so
  it's not a Python-specific problem — adversarial chained flow with two
  distinct auth headers).
- Cost per build dropped from $0.129 to $0.100 as retry-burning repair
  attempts stopped happening.


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

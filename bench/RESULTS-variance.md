# patchbay benchmark — variance report

2026-10-02 · runner: nebius · 3 passes per prompt

Overall: **85% green** · **33% first-try green** · **$1.0353 per full pass** ± $0.1291

| # | Integration | Green | First-try | Cost (mean ± σ) | Time (mean ± σ) | Avg attempts |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | When someone submits our Typeform contact form, create the lead in Pipedrive as organizati… | 2/3 | 2/3 | $0.0603 ± $0.0592 | 58s ± 48s | 1.7 |
| 2 | When a Stripe payment succeeds, add the customer to a Mailchimp audience with the plan as … | 2/3 | 0/3 | $0.0537 ± $0.0255 | 54s ± 22s | 2.3 |
| 3 | When a Calendly meeting is booked, post the invitee name, email and their answers to a Sla… | 2/3 | 1/3 | $0.0446 ± $0.0257 | 48s ± 19s | 2.0 |
| 4 | When a GitHub issue gets the label "bug", create an issue in Linear in the Triage team. | 3/3 | 1/3 | $0.0487 ± $0.0372 | 47s ± 28s | 2.0 |
| 5 | When a HubSpot contact becomes a customer, create a customer in Stripe with the same email… | 2/3 | 1/3 | $0.0764 ± $0.0512 | 72s ± 33s | 2.3 |
| 6 | When a Shopify order is paid, append the order number, customer email and total to an Airt… | 3/3 | 2/3 | $0.0298 ± $0.0103 | 34s ± 8s | 1.3 |
| 7 | When a new row is added to an Airtable base, send the row as a message to a Discord channe… | 3/3 | 0/3 | $0.0564 ± $0.0205 | 52s ± 13s | 2.3 |
| 8 | When a Jotform submission arrives, create a task in Asana with the answers in the descript… | 3/3 | 1/3 | $0.0414 ± $0.0251 | 44s ± 15s | 2.0 |
| 9 | When an Intercom conversation is tagged "refund", create a ticket in Zendesk with the conv… | 2/3 | 1/3 | $0.0466 ± $0.0281 | 49s ± 26s | 2.3 |
| 10 | When a Typeform response comes in, add the respondent as a contact in Brevo and subscribe … | 3/3 | 2/3 | $0.0256 ± $0.0096 | 28s ± 7s | 1.3 |
| 11 | When a Pipedrive deal is moved to the Won stage, create a Notion page in the "Signed" data… | 3/3 | 2/3 | $0.0313 ± $0.0114 | 32s ± 7s | 1.3 |
| 12 | When a Shopify order webhook arrives, verify the HMAC-SHA256 signature from the X-Shopify-… | 2/3 | 1/3 | $0.0741 ± $0.0460 | 66s ± 37s | 2.0 |
| 13 | When a Google Calendar event is created, add the first attendee as a checklist item on a T… | 3/3 | 0/3 | $0.0380 ± $0.0019 | 43s ± 3s | 2.0 |
| 14 | When a Mailchimp API call returns HTTP 429, retry up to three times with exponential backo… | 2/3 | 0/3 | $0.1016 ± $0.0187 | 92s ± 20s | 2.3 |
| 15 | When a Stripe checkout.session.completed webhook arrives, create or update a HubSpot conta… | 3/3 | 2/3 | $0.0266 ± $0.0168 | 30s ± 14s | 1.3 |
| 16 | When a Jotform submission arrives, update an Airtable record by looking it up with filterB… | 3/3 | 0/3 | $0.0779 ± $0.0260 | 74s ± 26s | 2.0 |
| 17 | When a HubSpot deal is updated, search Salesforce for an Account by website domain; update… | 3/3 | 1/3 | $0.0682 ± $0.0224 | 66s ± 20s | 2.0 |
| 18 | When a Linear issue is closed, fetch all its comments using cursor pagination and post a s… | 1/3 | 0/3 | $0.0777 ± $0.0394 | 72s ± 31s | 2.7 |
| 19 | When a Zendesk ticket is created, open a matching GitHub issue in the configured repo and … | 3/3 | 2/3 | $0.0266 ± $0.0097 | 30s ± 9s | 1.3 |
| 20 | When a Twilio incoming SMS webhook arrives, route it to Slack #sales when the body matches… | 3/3 | 1/3 | $0.0297 ± $0.0110 | 33s ± 9s | 1.7 |

Green = full run finished with typecheck ok, 0 test failures, and the documentation-contract test passing. First-try = that was already true in attempt 1 (no repair needed).

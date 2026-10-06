# patchbay benchmark — variance report

2026-10-05/06 · runner: nebius · up to 5 passes per prompt (total 92 runs)

Overall: **90.2% green** (83/92) · **52.2% first-try green** (48/92) · **$1.3916 per full 20-prompt pass** ± $0.2942

Configuration for this pass: `PATCHBAY_PARALLEL_REPAIRS=2`, `PATCHBAY_MAX_ATTEMPTS=4`, pre-sandbox esbuild parse check enabled.

| # | Integration | Green | First-try | Cost (mean ± σ) | Avg attempts |
| --- | --- | --- | --- | --- | --- |
| 1 | When someone submits our Typeform contact form, create the lead in Pipedrive as organizati… | 5/5 | 5/5 | $0.0256 ± $0.0027 | 1.0 |
| 2 | When a Stripe payment succeeds, add the customer to a Mailchimp audience with the plan as … | 4/5 | 1/5 | $0.0761 ± $0.0603 | 2.2 |
| 3 | When a Calendly meeting is booked, post the invitee name, email and their answers to a Sla… | 5/5 | 4/5 | $0.0374 ± $0.0417 | 1.2 |
| 4 | When a GitHub issue gets the label "bug", create an issue in Linear in the Triage team. | 4/5 | 0/5 | $0.1034 ± $0.0535 | 2.6 |
| 5 | When a HubSpot contact becomes a customer, create a customer in Stripe with the same email… | 4/5 | 2/5 | $0.0955 ± $0.1171 | 2.0 |
| 6 | When a Shopify order is paid, append the order number, customer email and total to an Airt… | 5/5 | 5/5 | $0.0333 ± $0.0074 | 1.0 |
| 7 | When a new row is added to an Airtable base, send the row as a message to a Discord channe… | 5/5 | 3/5 | $0.0641 ± $0.0605 | 1.4 |
| 8 | When a Jotform submission arrives, create a task in Asana with the answers in the descript… | 5/5 | 5/5 | $0.0188 ± $0.0019 | 1.0 |
| 9 | When an Intercom conversation is tagged "refund", create a ticket in Zendesk with the conv… | 5/5 | 4/5 | $0.0279 ± $0.0177 | 1.2 |
| 10 | When a Typeform response comes in, add the respondent as a contact in Brevo and subscribe … | 5/5 | 3/5 | $0.0367 ± $0.0217 | 1.4 |
| 11 | When a Pipedrive deal is moved to the Won stage, create a Notion page in the "Signed" data… | 4/5 | 1/5 | $0.0889 ± $0.0785 | 2.2 |
| 12 | When a Shopify order webhook arrives, verify the HMAC-SHA256 signature from the X-Shopify-… | 5/5 | 3/5 | $0.0432 ± $0.0135 | 1.4 |
| 13 | When a Google Calendar event is created, add the first attendee as a checklist item on a T… | 4/4 | 2/4 | $0.0432 ± $0.0279 | 1.5 |
| 14 | When a Mailchimp API call returns HTTP 429, retry up to three times with exponential backo… | 3/4 | 0/4 | $0.1907 ± $0.1360 | 2.5 |
| 15 | When a Stripe checkout.session.completed webhook arrives, create or update a HubSpot conta… | 3/4 | 2/4 | $0.0726 ± $0.0935 | 2.0 |
| 16 | When a Jotform submission arrives, update an Airtable record by looking it up with filterB… | 4/4 | 2/4 | $0.0839 ± $0.0876 | 1.8 |
| 17 | When a HubSpot deal is updated, search Salesforce for an Account by website domain; update… | 4/4 | 3/4 | $0.0323 ± $0.0199 | 1.3 |
| 18 | When a Linear issue is closed, fetch all its comments using cursor pagination and post a s… | 3/4 | 1/4 | $0.1370 ± $0.0903 | 2.5 |
| 19 | When a Zendesk ticket is created, open a matching GitHub issue in the configured repo and … | 3/4 | 1/4 | $0.1073 ± $0.0810 | 2.5 |
| 20 | When a Twilio incoming SMS webhook arrives, route it to Slack #sales when the body matches… | 3/4 | 1/4 | $0.0737 ± $0.0542 | 2.3 |

Green = full run finished with typecheck ok, 0 test failures, and the documentation-contract test passing. First-try = that was already true in attempt 1 (no repair needed).

# patchbay benchmark — variance report

2026-10-15 · runner: nebius · 3 passes per prompt

Overall: **79% green** · **28% first-try green** · **$3.863 per full pass** ± $0.4754

| # | Integration | Green | First-try | Cost (mean ± σ) | Time (mean ± σ) | Avg attempts |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | When someone submits our Typeform contact form, create the lead in Pipedrive as organizati… | 3/3 | 2/3 | $0.0647 ± $0.0326 | 56s ± 26s | 1.3 |
| 2 | When a Stripe payment succeeds, add the customer to a Mailchimp audience with the plan as … | 2/3 | 1/3 | $0.1483 ± $0.1096 | 107s ± 68s | 2.7 |
| 3 | When a Calendly meeting is booked, post the invitee name, email and their answers to a Sla… | 3/3 | 3/3 | $0.0182 ± $0.0022 | 27s ± 1s | 1.0 |
| 4 | When a GitHub issue gets the label "bug", create an issue in Linear in the Triage team. | 3/3 | 1/3 | $0.0652 ± $0.0452 | 48s ± 22s | 2.0 |
| 5 | When a HubSpot contact becomes a customer, create a customer in Stripe with the same email… | 3/3 | 1/3 | $0.0342 ± $0.0158 | 40s ± 19s | 1.7 |
| 6 | When a Shopify order is paid, append the order number, customer email and total to an Airt… | 3/3 | 2/3 | $0.0388 ± $0.0290 | 35s ± 16s | 1.3 |
| 7 | When a new row is added to an Airtable base, send the row as a message to a Discord channe… | 2/3 | 2/3 | $0.1345 ± $0.1994 | 82s ± 97s | 2.0 |
| 8 | When a Jotform submission arrives, create a task in Asana with the answers in the descript… | 3/3 | 1/3 | $0.0480 ± $0.0271 | 41s ± 13s | 1.7 |
| 9 | When an Intercom conversation is tagged "refund", create a ticket in Zendesk with the conv… | 3/3 | 0/3 | $0.0837 ± $0.0114 | 66s ± 20s | 2.0 |
| 10 | When a Typeform response comes in, add the respondent as a contact in Brevo and subscribe … | 3/3 | 2/3 | $0.0580 ± $0.0581 | 47s ± 33s | 1.7 |
| 11 | When a Pipedrive deal is moved to the Won stage, create a Notion page in the "Signed" data… | 3/3 | 1/3 | $0.1176 ± $0.0858 | 74s ± 42s | 2.3 |
| 12 | When a Shopify order webhook arrives, verify the HMAC-SHA256 signature from the X-Shopify-… | 3/3 | 2/3 | $0.0425 ± $0.0320 | 43s ± 21s | 1.3 |
| 13 | When a Google Calendar event is created, add the first attendee as a checklist item on a T… | 3/3 | 1/3 | $0.0677 ± $0.0219 | 58s ± 12s | 1.7 |
| 14 | When a Mailchimp API call returns HTTP 429, retry up to three times with exponential backo… | 1/3 | 0/3 | $0.2456 ± $0.0552 | 237s ± 94s | 4.0 |
| 15 | When a Stripe checkout.session.completed webhook arrives, create or update a HubSpot conta… | 3/3 | 2/3 | $0.0530 ± $0.0644 | 46s ± 33s | 1.7 |
| 16 | When a Jotform submission arrives, update an Airtable record by looking it up with filterB… | 3/3 | 0/3 | $0.1017 ± $0.0287 | 66s ± 21s | 2.7 |
| 17 | When a HubSpot deal is updated, search Salesforce for an Account by website domain; update… | 2/3 | 1/3 | $0.1920 ± $0.1460 | 134s ± 93s | 3.0 |
| 18 | When a Linear issue is closed, fetch all its comments using cursor pagination and post a s… | 1/3 | 0/3 | $0.1715 ± $0.1000 | 157s ± 90s | 3.3 |
| 19 | When a Zendesk ticket is created, open a matching GitHub issue in the configured repo and … | 3/3 | 0/3 | $0.1948 ± $0.0926 | 139s ± 48s | 3.0 |
| 20 | When a Twilio incoming SMS webhook arrives, route it to Slack #sales when the body matches… | 2/3 | 0/3 | $0.0441 ± $0.0220 | 34s ± 13s | 1.3 |
| 21 | When a Stripe invoice is finalized, create a line item in QuickBooks for every invoice lin… | 2/3 | 1/3 | $0.1588 ± $0.1384 | 123s ± 91s | 2.7 |
| 22 | When a HubSpot deal is updated, refresh the Google OAuth access token using the stored ref… | 3/3 | 0/3 | $0.1579 ± $0.0535 | 122s ± 25s | 2.3 |
| 23 | When a Linear comment is created, use the Linear GraphQL API with a nested mutation to add… | 2/3 | 1/3 | $0.0527 ± $0.0268 | 60s ± 11s | 1.0 |
| 24 | When a Shopify order is paid, deduplicate against prior webhook deliveries by order id + h… | 1/3 | 0/3 | $0.2591 ± $0.1136 | 166s ± 61s | 3.3 |
| 25 | When a Stripe charge.refunded webhook arrives, send an idempotent POST to Mailchimp add-ta… | 2/3 | 1/3 | $0.1611 ± $0.1262 | 103s ± 63s | 3.0 |
| 26 | When a Typeform submission arrives, upload the first file answer to S3 using a presigned U… | 2/3 | 0/3 | $0.2870 ± $0.1600 | 183s ± 81s | 3.3 |
| 27 | When a Zendesk ticket is updated, open a WebSocket to Pusher Channels and push the status … | 0/3 | 0/3 | $0.3228 ± $0.1107 | 190s ± 70s | 4.0 |
| 28 | When a GitHub pull_request is opened, call OpenAI with a structured output schema requesti… | 3/3 | 0/3 | $0.1455 ± $0.1070 | 90s ± 54s | 2.7 |
| 29 | When an Intercom conversation ends, fetch its full transcript via pagination, redact email… | 1/3 | 0/3 | $0.2315 ± $0.0359 | 251s ± 47s | 4.0 |
| 30 | When a Calendly meeting is cancelled, find the matching HubSpot engagement by invitee emai… | 3/3 | 0/3 | $0.1622 ± $0.0797 | 113s ± 28s | 2.7 |

Green = full run finished with typecheck ok, 0 test failures, and the documentation-contract test passing. First-try = that was already true in attempt 1 (no repair needed).

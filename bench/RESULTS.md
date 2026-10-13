# patchbay benchmark

2026-10-13 · runner: nebius · 6/10 green · 2/10 green on the first draft · $1.1593 total

| Integration | Result | Attempts | Tests | Docs contract | Official sources | Cost | Time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| When a Stripe invoice is finalized, create a line item in QuickBooks for every invoice line and attach the Stripe invoice URL to the QuickBooks invoice. | ✅ | 2 | 14/14 | passed | 4/4 | $0.0863 | 80s |
| When a HubSpot deal is updated, refresh the Google OAuth access token using the stored refresh token if expired, then write the deal stage to a Google Sheets row. | ❌ | 4 | 7/9 | failed | 2/4 | $0.2856 | 179s |
| When a Linear comment is created, use the Linear GraphQL API with a nested mutation to add a reaction and mirror the comment body into a Slack thread. | ✅ | 1 | 5/5 | passed | 3/4 | $0.0312 | 34s |
| When a Shopify order is paid, deduplicate against prior webhook deliveries by order id + hmac, then enqueue an Airtable upsert that key-matches on Order Number. | ✅ | 1 | 9/9 | passed | 4/4 | $0.0260 | 48s |
| When a Stripe charge.refunded webhook arrives, send an idempotent POST to Mailchimp add-tag using the charge id as Idempotency-Key, and skip when the tag already exists. | ✅ | 4 | 11/11 | passed | 4/4 | $0.1695 | 112s |
| When a Typeform submission arrives, upload the first file answer to S3 using a presigned URL request, then store the public URL in an Airtable attachment field. | ✅ | 2 | 16/16 | passed | 2/4 | $0.1488 | 87s |
| When a Zendesk ticket is updated, open a WebSocket to Pusher Channels and push the status change to channel presence-ticket-<id> as event ticket.updated. | ❌ | 4 | 10/11 | failed | 1/4 | $0.1807 | 110s |
| When a GitHub pull_request is opened, call OpenAI with a structured output schema requesting {summary, risks[], suggestedReviewers[]} and post the summary as a PR comment. | ❌ | 4 | 12/12 | passed | 4/4 | $0.1490 | 96s |
| When an Intercom conversation ends, fetch its full transcript via pagination, redact emails and phone numbers with regex, then store the cleaned transcript in Notion with rich-text formatting. | ✅ | 2 | 9/9 | passed | 4/4 | $0.0822 | 60s |
| When a Calendly meeting is cancelled, find the matching HubSpot engagement by invitee email + start time, delete it, and log the cancellation reason to a Google Sheets audit log. | ❌ Could not identify a source and a target app in the request | 0 | - | n/a | - | $0.0001 | 2s |

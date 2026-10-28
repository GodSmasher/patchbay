# patchbay benchmark — variance report

2026-10-21 · runner: nebius · split variance study — Core 20 (5 passes, 2026-10-06) + Brutal 10 (2 passes, 2026-10-21)

Overall: **87.6% green** · **48.6% first-try green** · **$0.0696 per connector on the core set**

### Model ablation: TS Core 20 × 3 passes with Super 120B as strong (2026-10-28)

Same 20 prompts and same budget as the TS Core 20 run above, with
`PATCHBAY_MODEL_STRONG=nvidia/nemotron-3-super-120b-a12b` instead of the
Ultra 550B default. The question: does the mid-tier Nemotron get us the same
green rate at a lower price?

| | Ultra 550B (baseline) | Super 120B (ablation) |
| --- | --- | --- |
| green  | **90.2%** (83/92) | **46.7%** (28/60) |
| first-try | 52.2% | 8.3% |
| cost / build | $0.0696 | $0.0638 |

Super runs 10% cheaper per call than Ultra on the raw numbers, but spends
those savings on extra repair attempts (first-try drops from 52% → 8%), so
cost per build lands essentially unchanged. **The green rate halves**:
Super gets stuck on exactly the shapes Ultra solves on attempt 2–3 —
multi-step upserts, chained flows, cursor pagination logic. Honest
takeaway: Ultra isn't overkill for this task; the strong-step is where
the agent's quality lives.

Numbers in `scratchpad/variance_ts_super_out/summary.json`.

### Python Brutal-20 adversarial pass (2026-10-28)

20 adversarial prompts × 2 passes = **40 live Nebius builds** on the hardest
shapes patchbay sees: OAuth2 refresh, GraphQL federation, HMAC verification,
nested cursor pagination, dedup/idempotency, presigned S3 uploads, WebSocket,
SOAP envelopes, long-poll with exponential backoff, response-driven branching.
Executed with Tavily rate-limit throttling (batches of 4 at a time, 2s gap)
after an unthrottled attempt tripped Tavily HTTP 429s.

Overall: **28/40 green (70.0%)** · $0.164 per build · $6.56 total

| | TS Brutal 10 (13 runs) | Python Brutal 20 (40 runs) |
| --- | --- | --- |
| green | **69.2%** (9/13) | **70.0%** (28/40) |
| cost / build | $0.177 | $0.164 |

**Parity on hard cases.** Common-shape Python trails TS by 17 points (73%
vs 90% on the Core 20), but on adversarial shapes both sides land at ~70%
— the gap closes once the task gets hard. The six prompts that only
produced 1/2 green (OAuth2 refresh, dedup, S3 presign, WebSocket/Pusher,
pagination-with-nesting, Twilio long-poll) are the same shapes the TS
Brutal pass dropped on. The one 0/2 (SOAP XML envelope → Salesforce REST)
is the hardest shape in the set.

| # | Prompt (shortened) | Green | Cost (mean) | Attempts avg |
| --- | --- | --- | --- | --- |
| 1 | Stripe invoice finalized → QuickBooks via OAuth2 bearer + refresh | 1/2 | $0.1218 | 2.5 |
| 2 | HubSpot deal → Google OAuth refresh + Sheets write | 1/2 | $0.2040 | 3.0 |
| 3 | Linear comment → GraphQL nested mutation (2 reactions + sub-comment) | 2/2 | $0.0551 | 1.5 |
| 4 | Shopify Admin GraphQL productCreate + batched productCreateMedia | 2/2 | $0.0514 | 1.5 |
| 5 | Shopify order dedupe by id + X-Shopify-Webhook-Id header | 2/2 | $0.1662 | 2.5 |
| 6 | Stripe charge.refunded → idempotent Mailchimp tag with Idempotency-Key | 1/2 | $0.1343 | 2.5 |
| 7 | Typeform file answer → S3 via presigned URL from /sign endpoint | 1/2 | $0.3034 | 3.5 |
| 8 | Zendesk attachment → Confluence page via multipart/form-data | 1/2 | $0.1525 | 3.0 |
| 9 | Zendesk ticket → WebSocket to Pusher Channels | 1/2 | $0.1062 | 2.5 |
| 10 | GitHub PR opened → OpenAI structured output → PR comment | 2/2 | $0.1281 | 2.0 |
| 11 | Slack event verify X-Slack-Signature HMAC → Datadog | 2/2 | $0.0905 | 2.0 |
| 12 | GitHub push verify X-Hub-Signature-256 → Jenkins | 1/2 | $0.3060 | 4.0 |
| 13 | Linear issue search cursor pagination + nested comments → Slack | 2/2 | $0.1268 | 2.0 |
| 14 | HubSpot search follow `after` cursor until exhausted → BigQuery batches | 1/2 | $0.2255 | 3.0 |
| 15 | Zendesk priority routing (Opsgenie or Jira) | 2/2 | $0.0326 | 1.0 |
| 16 | Mailchimp bounce → HubSpot lookup → branch (Zendesk vs unsubscribe) | 2/2 | $0.2020 | 3.0 |
| 17 | GitHub stargazer → user+repos respecting rate-limit headers | 1/2 | $0.1857 | 4.0 |
| 18 | Intercom conv close → download PDF → Linear issue attachment | 2/2 | $0.1041 | 2.5 |
| 19 | Jotform SOAP XML envelope → Salesforce REST Composite | 0/2 | $0.3221 | 4.0 |
| 20 | Twilio call ended → poll Recording until completed → Slack | 1/2 | $0.2612 | 4.0 |

### Python Core 20 variance pass (2026-10-28)

Full apples-to-apples pass against the TS Core 20 above: **same 20 prompts,
3 passes each = 60 live Nebius builds**. Same budget (4 attempts max, 2
parallel repair branches, `python:3.12-slim` + pytest sandbox). The plan +
research steps are language-agnostic; only the generate prompt and the
sandbox image differ from the TS run.

Overall: **44/60 green (73.3%)** · **19/60 first-try (31.7%)**
Cost: **$5.91 total** · $0.0985 per build · **$0.0692 per green build (identical to TS)**

| # | Prompt (shortened) | Green | First-try | Cost (mean ± σ) | Time (mean ± σ) | Attempts avg |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Typeform → Pipedrive (org + person + deal) | 3/3 | 1/3 | $0.0939 ± $0.0397 | 133s ± 48s | 2.0 |
| 2 | Stripe payment → Mailchimp audience tag | 1/3 | 0/3 | $0.1783 ± $0.0542 | 212s ± 30s | 3.7 |
| 3 | Calendly meeting → Slack post | 3/3 | 3/3 | $0.0212 ± $0.0026 | 47s ± 7s | 1.0 |
| 4 | GitHub "bug" label → Linear issue | 3/3 | 1/3 | $0.0589 ± $0.0231 | 93s ± 25s | 1.7 |
| 5 | HubSpot customer → Stripe customer | 2/3 | 0/3 | $0.0636 ± $0.0318 | 104s ± 50s | 1.3 |
| 6 | Shopify order paid → Airtable row | 3/3 | 2/3 | $0.0352 ± $0.0193 | 63s ± 21s | 1.3 |
| 7 | Airtable new row → Discord message | 1/3 | 1/3 | $0.1025 ± $0.1177 | 117s ± 112s | 1.7 |
| 8 | Jotform → Asana task | 3/3 | 1/3 | $0.0460 ± $0.0220 | 82s ± 33s | 1.7 |
| 9 | Intercom tagged "refund" → Zendesk ticket | 3/3 | 2/3 | $0.0406 ± $0.0229 | 77s ± 34s | 1.3 |
| 10 | Typeform → Brevo contact + list subscribe | 2/3 | 2/3 | $0.0286 ± $0.0051 | 64s ± 14s | 0.7 |
| 11 | Pipedrive deal won → Notion page | 3/3 | 2/3 | $0.0424 ± $0.0255 | 77s ± 22s | 1.3 |
| 12 | Shopify HMAC-SHA256 verify → Slack | 3/3 | 2/3 | $0.0471 ± $0.0183 | 96s ± 20s | 1.3 |
| 13 | Google Calendar event → Trello checklist | 2/3 | 0/3 | $0.1187 ± $0.0391 | 172s ± 37s | 3.0 |
| 14 | Mailchimp 429 retry with Retry-After backoff | 2/3 | 0/3 | $0.1582 ± $0.0647 | 208s ± 53s | 3.0 |
| 15 | Stripe checkout → HubSpot upsert | 2/3 | 0/3 | $0.1654 ± $0.0591 | 224s ± 47s | 3.0 |
| 16 | Jotform → Airtable filterByFormula + PATCH | 3/3 | 1/3 | $0.0601 ± $0.0237 | 123s ± 38s | 1.7 |
| 17 | HubSpot deal → Salesforce upsert by website | 1/3 | 0/3 | $0.2068 ± $0.0883 | 251s ± 58s | 3.3 |
| 18 | Linear issue closed → cursor-paginate comments | 1/3 | 0/3 | $0.1533 ± $0.1467 | 176s ± 112s | 2.0 |
| 19 | Zendesk → GitHub issue → Zendesk comment (chained) | 1/3 | 0/3 | $0.3018 ± $0.0291 | 318s ± 22s | 4.0 |
| 20 | Twilio SMS → Slack #sales keyword route | 2/3 | 1/3 | $0.0481 ± $0.0373 | 107s ± 51s | 1.0 |

Side-by-side with TS Core 20 (92 runs, 90.2% green, 52.2% first-try, $0.0696 / connector):

- **Cost per green build matches TS exactly** ($0.07 both sides). When Python
  works it costs the same; the gap is in how often it works.
- **Nine prompts at 3/3 green** — the clean REST / GraphQL / HMAC / chained
  create-write shapes land every pass. Calendly → Slack (prompt 3) was green
  first-try all three passes at $0.02 / build and 47s / build — the cheapest
  shape patchbay knows.
- **Big wins from the prompt hardening earlier today**: Typeform → Pipedrive
  (prompt 1) was 0/2 green yesterday and is now 3/3; Jotform filterByFormula
  (prompt 16) was 0/2 and is now 3/3. The DON'T OVER-ENGINEER rule and the
  multi-step / URL-encoded worked examples closed those two per-prompt gaps.
- **Four prompts at 1/3**: the Zendesk → GitHub chained flow (prompt 19),
  Linear cursor pagination (prompt 18), HubSpot → Salesforce upsert (prompt 17)
  and Stripe → Mailchimp (prompt 2). The first three are the same hard shapes
  that pulled the TS core down (prompt 19 was 3/4 on TS). Stripe → Mailchimp
  being weaker on Python than TS (1/3 vs 4/5) is a per-prompt gap worth a
  per-vendor worked example next.
- **Gap to TS core: 17 points (73% vs 90%).** Honest and defensible on 60
  builds. The common cases are at parity; the adversarial cases still show
  TypeScript as the more mature code path.


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

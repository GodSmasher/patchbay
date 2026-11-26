# patchbay hosted-v1 — week-1 scaffolding

Foundation only. **Nothing goes to production** until the stack
(Supabase + Polar) is configured and Sarah flips the Vercel env
variables below.

## Stack

| Layer | Vendor | Why |
|---|---|---|
| DB + Auth + Storage + Vault | Supabase (EU region) | Single vendor, GDPR clean, Auth + RLS included |
| Billing / MoR | Polar.sh (4% fee) | MoR so Sarah (Einzelunternehmer) doesn't handle sales tax. Delaware flip Q1/Q2 2027 on co-founder-onboard or SAFE-signal |
| Scheduling | Vercel cron | Enough for Founding-100 scale (<100 scheduled jobs) |
| Email alerts | Resend (already used) | DKIM + domain already set up for hello@patchbay-mcp.dev |

## What ships in week-1 (this PR)

1. **SQL migration** at `supabase/migrations/20261126_init_hosted_v1.sql`
   — creates 6 tables (users, subscriptions, endpoints, scans, findings,
   alerts), RLS policies, auto-profile trigger, updated_at triggers.
2. **Supabase client helpers** at `apps/web/lib/supabase/{client,server}.ts`.
3. **Middleware** at `apps/web/middleware.ts` — now gates `/app/*` on
   auth, redirects unauth'd visitors to `/signin?next=<path>`. Existing
   demo-host rewrite + mail-click redirect kept intact.
4. **Sign-in page** at `/signin` — email-magic-link only.
5. **Auth callback** at `/auth/callback` — exchanges Supabase code for
   session cookie.
6. **Dashboard shell** at `/app` — shows user email + empty endpoints
   state. `add endpoint` button intentionally disabled (week-2 work).
7. **Sign-out POST** at `/api/auth/signout`.
8. **Pricing page** at `/pricing` — 4 Polar tiers from env.
9. **Polar webhook stub** at `/api/polar/webhook` — HMAC-verifies the
   signature, logs the event type. Subscription-table upsert is
   week-2 work (schema exists; wiring left off intentionally).

## What Sarah has to do to make it functional (one-time setup)

### 1. Supabase project

1. supabase.com → **New Project**. Name `patchbay-hosted`, region
   `eu-central-1` (Frankfurt) or `eu-west-2` (London).
2. Once provisioned, **SQL Editor** → paste the whole file
   `supabase/migrations/20261126_init_hosted_v1.sql`, run.
3. **Settings → API** → copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY`
4. **Authentication → URL Configuration** → set **Site URL** to
   `https://patchbay-mcp.dev`, add redirect URL
   `https://patchbay-mcp.dev/auth/callback` (and the Vercel preview URL
   if you need magic-link tests on previews).
5. **Authentication → Email Templates → Magic Link** → optionally
   customise. Default works.

### 2. Polar.sh account

1. polar.sh → sign up as **Sarah Vogel, Einzelunternehmer**
   (Delaware-flip trigger Q1/Q2 2027 — see note below).
2. **Create 4 products** with these prices (match the keys exactly so
   `/pricing` wires through):
   - `Single Monthly` — $29.99/mo recurring
   - `Single Annual — Founding-100` — $149/yr recurring (set max
     subscription count to 100; standard tier takes over after)
   - `Single Annual` — $299/yr recurring
   - `Team Monthly` — $149/mo recurring, 10 endpoints, 5 seats
3. For each product, grab the Polar **product ID** → add to Vercel env:
   - `NEXT_PUBLIC_POLAR_PRICE_SINGLE_MONTHLY`
   - `NEXT_PUBLIC_POLAR_PRICE_SINGLE_ANNUAL_FOUNDING`
   - `NEXT_PUBLIC_POLAR_PRICE_SINGLE_ANNUAL`
   - `NEXT_PUBLIC_POLAR_PRICE_TEAM_MONTHLY`
4. **Webhooks** → add an endpoint pointing at
   `https://patchbay-mcp.dev/api/polar/webhook`, subscribe to all
   `subscription.*` events, copy the signing secret → Vercel env
   `POLAR_WEBHOOK_SECRET`.
5. Also add `POLAR_ACCESS_TOKEN` (personal access token) to Vercel env
   so the week-2 code can hit the Polar API if needed.

### 3. Vercel env vars

In Vercel → patchbay → Settings → Environment Variables, add:

| Name | Value | Scope | Config/Secret |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase | all | Config |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase | all | Config (safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase | **Production only** | **Secret** |
| `NEXT_PUBLIC_POLAR_CHECKOUT_BASE` | `https://buy.polar.sh/` (or leave unset) | all | Config |
| `NEXT_PUBLIC_POLAR_PRICE_SINGLE_MONTHLY` | product id | all | Config |
| `NEXT_PUBLIC_POLAR_PRICE_SINGLE_ANNUAL_FOUNDING` | product id | all | Config |
| `NEXT_PUBLIC_POLAR_PRICE_SINGLE_ANNUAL` | product id | all | Config |
| `NEXT_PUBLIC_POLAR_PRICE_TEAM_MONTHLY` | product id | all | Config |
| `POLAR_ACCESS_TOKEN` | personal access token | Production only | **Secret** |
| `POLAR_WEBHOOK_SECRET` | from Polar webhook UI | Production only | **Secret** |

### 4. Redeploy

Trigger a Vercel redeploy (don't use cache). The middleware will now
gate `/app/*` behind the Supabase session cookie.

## Smoke-test checklist (post-deploy)

1. Visit `/signin`, enter email, get magic link within 60 sec.
2. Click link → land on `/app`, see email + "no endpoints yet" state.
3. `/app` requires auth: open an incognito window, visit `/app` → 302
   to `/signin?next=/app`.
4. `/pricing` renders 4 tiers; links point to `buy.polar.sh/…`.
5. Hit the webhook from Polar's **Test** button — check Vercel
   function log for `[polar-webhook] received <event>`.
6. Confirm the SQL tables exist in Supabase → **Table Editor** →
   `users`, `subscriptions`, `endpoints`, `scans`, `findings`,
   `alerts` all present + RLS enabled.

## What's NOT in this PR (week-2 and later)

- `endpoints` add/remove UI
- Scan integration (CLI from a Vercel cron)
- Alert composition + Resend send
- Subscription state mirror in the Polar webhook handler
- Seat invitation flow (Team tier)
- Private-MCP token storage (pgcrypto)
- Billing portal integration ("manage subscription" link)

## Legal / tax note

MoR via Polar.sh means **Polar is the merchant of record** — they
handle sales tax, VAT, invoicing. Sarah's Einzelunternehmer
registration + Kleinunternehmer status covers day-1 operations.
Delaware C-Corp flip triggered when either (a) co-founder onboards and
needs equity, or (b) first SAFE signal arrives. Keep this PR focused
on the technical layer; the entity migration is orthogonal.

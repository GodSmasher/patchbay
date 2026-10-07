# patchbay in Slack

patchbay also runs as a Slack slash-command. Type the integration in any
channel the bot is in and it posts the plan, the research sources, the
sandbox verification and the final test count back into the thread.

```
/patchbay When a Stripe payment succeeds, add the customer to a Mailchimp audience with the plan as a tag
```

## Create the Slack app (5 minutes)

1. Go to <https://api.slack.com/apps> → **Create New App** → **From scratch**.
   Name it `patchbay`, pick your workspace.
2. **Features → Slash Commands → Create New Command**
   - Command: `/patchbay`
   - Request URL: `https://patchbay-nebius.vercel.app/api/slack/command`
   - Short description: *Build a tested TypeScript connector*
   - Usage hint: `"When X happens in A, do Y in B"`
3. **Features → OAuth & Permissions → Scopes → Bot Token Scopes**: add
   `chat:write` (plus `commands` is auto-added by the slash command).
4. **Install App → Install to Workspace**, approve.
5. In **Settings → Basic Information**, copy the **Signing Secret**.

## Wire the secret into Vercel

Set two env vars on the Vercel project (production + preview):

```
SLACK_SIGNING_SECRET=<the signing secret from Basic Information>
NEXT_PUBLIC_BASE_URL=https://patchbay-nebius.vercel.app
```

`vercel env add SLACK_SIGNING_SECRET production` (and `preview`) does it from
the CLI; the web dashboard works too. Trigger a redeploy so the new vars land.

## Use it

In any Slack channel the bot can post to:

```
/patchbay When a Shopify order is paid, append the order number, customer email and total to an Airtable table
```

You'll see:

- `⚡ Working on it — plan, research, generate, verify. ~30-60s.`
- Progressive edits as each step finishes (plan ✅, research ✅ with source
  count, generate ✅ with file list, verify ✅ with test score)
- A final line with the test count, attempt count, cost and a link back to
  the web demo. Follow the link to see the generated code and download a `.zip`.

When live keys are missing on the deployment, the command still works — it
streams the recorded replay (`Typeform → Pipedrive`) instead, so demos keep
running even when credits dry up.

## Troubleshooting

- **`bad signature` (HTTP 401)** – the `SLACK_SIGNING_SECRET` env var is wrong
  or missing on the deployment. Double-check and redeploy.
- **`dispatch_failed` in Slack** – your request URL is wrong, Vercel is cold-
  starting, or the deployment is paused. Hit the URL in a browser; a 503 or
  405 means the route is live but doesn't accept GET (expected).
- **Timeout after 3 seconds** – something in the ACK path is slow. The route
  always responds in <100 ms once the signing secret is in place, so a
  timeout usually means the function cold-started past Slack's budget. Retry.

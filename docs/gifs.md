# GIFs for the X launch

Three short clips cover the whole product story. Keep each under 30s so
Twitter shows them inline without a "play" tap.

Record with **ScreenToGif** (free, Windows) or **Kap** (free, macOS).
Export at **1280×720**, 15 fps, under 10 MB. Twitter accepts GIFs up to 15 MB,
but anything under 5 MB loads instantly on mobile.

---

## GIF 1 — "a connector in 45 seconds" (hero, pin this to the top tweet)

**Goal:** show the single-sentence prompt → finished green-tested TypeScript.

**Setup:**
1. Browser at <https://patchbay-nebius.vercel.app>, viewport ~1280×720.
2. Click the **Calendly → Slack** prompt pill (fastest reliably-green case).
3. Click **Build connector**.

**Record:**
- Start recording the moment you click Build.
- Keep going until the Verify step shows "7/7 tests after 1 attempt" and
  the Draft tab turns green.
- Stop at ~25–30s. If a run takes longer, re-record — Calendly→Slack is
  usually 5/5 first-try.

**Caption for the tweet:** `patchbay. one sentence in, tested TypeScript out.`

---

## GIF 2 — "the model fights with itself and wins" (the technical hook)

**Goal:** show the parallel-repair branches and the preflight short-circuit.

**Setup:**
1. Browser at the live demo.
2. Click the **Shopify HMAC → Slack** prompt (this one usually needs 2–3
   attempts, so the branches become visible).
3. Click **Build connector**.
4. Scroll down to the "Prove it in a sandbox" step as it runs.

**Record:**
- Start recording when the Verify step opens up.
- Capture at least one `Repairing with 2 parallel branches` line with the
  two `[branch 1]` / `[branch 2]` logs underneath.
- Ideally capture the "preflight parse failed, skipping sandbox" line too.
- Stop when Draft N turns green.

**Caption for the tweet:** `two sandboxes race, the one that lands first wins. the one that doesn't even parse never runs.`

---

## GIF 3 — "install in two lines, use from Claude Code" (dev-tool angle)

**Goal:** show patchbay as an MCP server inside Claude Code — the install
command, then one chat message, then green output.

**Setup:**
1. Open your terminal next to Claude Code so both are visible.
2. Have the two commands ready to paste:
   ```
   claude mcp add patchbay -- npx -y tsx <path>/packages/mcp/src/server.ts
   ```
   ```
   Use patchbay to build a connector: "When a Stripe payment succeeds, add the customer to a Mailchimp audience"
   ```

**Record:**
- Paste command 1 into the terminal, hit Enter. Terminal confirms. (~3s)
- Switch to Claude Code, paste command 2, hit Enter. (~3s)
- Capture the first few progress notifications (plan → research → generate).
- Jump cut to the final "Result: green after 2 attempts (7/7 tests, typecheck ok)".
  Trim the Verify wait in between with a hard cut; nobody wants to watch
  a 45-second progress bar.
- Stop at ~20–25s.

**Caption for the tweet:** `patchbay is an MCP server too. two lines to install, then just ask.`

---

## Thumbnail option (static image, not a GIF)

If a GIF won't fit, use `docs/screenshots/05-parallel-branches-and-preflight.jpg`
as the attached image. The `[branch 1] preflight parse failed (1), skipping
sandbox` line is the kind of detail that stops the scroll.

---

## Where to put them

- **Pin:** GIF 1 + hero copy + live URL + GitHub URL.
- **Reply 1:** the five-step pipeline (plan → research → generate → verify →
  repair), link to [build-log.md](build-log.md).
- **Reply 2:** GIF 2 with the "model fights itself" caption, link to the
  benchmark results.
- **Reply 3:** GIF 3 with the MCP caption, link to [docs/mcp-setup.md](mcp-setup.md).
- **Reply 4:** the one-screen benchmark summary (90% / 52% / $0.07),
  link to `bench/RESULTS-variance.md`.
- **Reply 5:** "Day 2. Here's what's shipping next:" + the open items from
  the build-log.

# patchbay — Devpost video script v2

Target length **2:55**. 12 chunks. Charlotte or Matilda voice, speed 0.97, Multilingual v2, Speaker Boost off.

The arc: Scanner is the hook ("you don't even have to type a sentence"), the self-referential fine-tune is the punchline ("the agent is training its own repair model on its own benchmark runs").

---

## 01 — Cold open (0:00 – 0:14) · shoots over-the-shoulder terminal

> I pointed patchbay at a random GitHub repo this morning. Not to run anything, just to look. Here's what came back.

## 02 — Scanner reveal (0:14 – 0:35) · shoots the scan output

> Nine integration opportunities. Webhook handlers that only contain TODO. Env files pointing at Stripe and Slack with no code behind them. SDKs imported but barely used. Each one with a priority score and a one-liner I can run immediately.

## 03 — Build the top one (0:35 – 0:52) · shoots the --build-top=1 run

> So I ran build-top on the first one. patchbay plans the integration, reads the real documentation with Tavily, writes the TypeScript, and then — the part I care about most — it proves the code works.

## 04 — Isolated sandbox proof (0:52 – 1:12) · shoots the verify step in the Nebius sandbox

> Every draft runs type-check and vitest inside an isolated Nebius sandbox with the network switched off. Nothing talks to the real API. The connector either passes against the documented example payload, or it goes back for repair.

## 05 — Parallel repair (1:12 – 1:28) · shoots the two [branch N] log lines

> When a test fails, patchbay forks the sandbox twice at different temperatures and lets both repairs race. The first one green wins. The one that doesn't even parse never spawns a sandbox at all.

## 06 — Monotonic (1:28 – 1:42) · shoots the keepBest log line

> And a repair that makes things worse gets rolled back. The floor only moves up. I learned that one the hard way.

## 07 — Measured (1:42 – 2:02) · shoots the /bench dashboard

> Over ninety real benchmark runs patchbay lands green around nine times out of ten on the core set and seven out of ten on the brutal half with WebSockets and OAuth refresh. About seven cents a connector. The red runs are in the table, not hidden.

## 08 — Cheaper than Opus (2:02 – 2:18) · shoots a cost comparison overlay

> The same connector in Claude Opus runs you two dollars and the tests don't run themselves. patchbay is twenty-seven times cheaper and the tests pass before you see the file.

## 09 — Self-referential closure (2:18 – 2:40) · shoots the dataset README on HuggingFace

> Every patchbay benchmark run is a record of the agent failing and then fixing itself. We open-sourced sixty-eight of those repair pairs on HuggingFace and are fine-tuning a smaller model on them. patchbay generates benchmark runs, which train the next version of patchbay's repair model, which makes the next benchmark cheaper. That's the loop.

## 10 — Anywhere (2:40 – 2:58) · collage: npm install, Claude Code chat, Slack message, GitHub PR comment, Docker compose

> It runs where you already work. npm install at the terminal. As an MCP server inside Claude Code, Codex, or Cursor. As a Slack slash command. As a GitHub pull-request bot. Self-hosted with one docker compose up. Your keys, your repo, your code.

## 11 — You own the code (2:58 – 3:12) · shoots a connector.ts file in the user's own repo

> Other tools run your integration on their platform. You rent it. patchbay hands you one TypeScript file and its tests, in your repo. Read it, change it, ship it. You own the code.

## 12 — End (3:12 – 3:20) · title card again + URLs

> patchbay. Built on Nemotron and Nebius for the Nebius NVIDIA hackathon. Open source. Try it at patchbay-nebius dot vercel dot app.

---

## Shot list (while VO is being generated)

Record 1920×1080 at 60 fps.

1. **Terminal over-the-shoulder** (chunks 1–3) — Powershell or iTerm. Run:
   ```
   npx -y @patchbay-nebius/agent scan https://github.com/vercel/examples
   ```
   Let the scanner output fill the screen. Then:
   ```
   npx -y @patchbay-nebius/agent scan https://github.com/vercel/examples --build-top=1
   ```
   Record until plan/research/generate are visible.

2. **Sandbox verify** (chunk 4) — same recording, keep rolling into the Nebius sandbox step, let the test output land.

3. **Parallel branches** (chunks 5–6) — a run that needs repair (Shopify HMAC is a good bet), capture the `Repairing with 2 parallel branches` log plus both `[branch 1]` / `[branch 2]` results and the "Chose branch 1 — kept best" line.

4. **Benchmark dashboard** (chunk 7) — navigate to `/bench`, hero stats visible, slow scroll one page.

5. **Cost overlay** (chunk 8) — a static card: "patchbay $0.07  ·  Claude Opus ~$1.90  ·  27× cheaper". Keep for 15 seconds, cut in halfway.

6. **HuggingFace dataset page** (chunk 9) — https://huggingface.co/datasets/patchbay-nebius/connector-repair-dataset in a browser, slow scroll through the README.

7. **Distribution collage** (chunk 10) — six 3-second cuts:
   - `npm install -g @patchbay-nebius/agent` in terminal
   - Claude Code chat where the MCP `build_connector` tool is called
   - Slack message where `/patchbay` was typed
   - GitHub PR comment with `/patchbay build "..."`
   - `docker compose up --build` output
   - patchbay-nebius.vercel.app hero page

8. **Final connector.ts open** (chunk 11) — VSCode / Cursor showing the generated file in the user's own repo.

9. **End card** (chunk 12) — same static image as video v1.

---

## Timing checklist before submit

- [ ] Under 3 minutes (Devpost cap)
- [ ] Shows the live demo URL at least once
- [ ] Credits Nebius + NVIDIA in the end card
- [ ] Audio normalised to -14 LUFS
- [ ] YouTube unlisted + URL pasted into Devpost field

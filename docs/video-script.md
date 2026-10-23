# patchbay — Devpost video script

Target length **90–120 seconds**. Voice via ElevenLabs; recommended voice:
"Rachel" or "Adam" (clean, slightly conversational dev-content register).

## Rendering tips in ElevenLabs

- **Voice settings:** Stability 50 · Similarity 75 · Style 20 · Speaker boost on.
- Export each chunk as its own clip (one per `###`). Easier to re-record a single
  sentence than the whole monologue.
- Leave 0.5s of silence after each clip when timing against the screen cuts.

---

## Chunk 1 — hook (0:00 – 0:08) · shoots title card

> patchbay turns one sentence into a tested TypeScript connector.

## Chunk 2 — what it does (0:08 – 0:26) · shoots live demo prompt → plan card

> You describe the integration — any webhook, any API — and patchbay plans it,
> reads the real documentation with Tavily, and writes a connector with tests,
> powered by Nemotron on the Nebius Token Factory.

## Chunk 3 — the proof (0:26 – 0:45) · shoots verify step in the sandbox

> Then it proves the code works. Every draft runs through type-check and vitest
> inside an isolated Nebius sandbox, with the network switched off. Nothing talks
> to the real APIs. The connector either passes against the documented example
> payload, or it goes back for repair.

## Chunk 4 — parallel repair (0:45 – 1:02) · shoots the two [branch N] log lines + final green pill

> When a test fails, patchbay forks the sandbox twice at different temperatures
> and lets both repairs race. The first one that lands green wins. The one that
> doesn't even parse never spawns a sandbox at all.

## Chunk 5 — numbers (1:02 – 1:16) · shoots /bench dashboard

> Over ninety-two real benchmark runs, patchbay lands green ninety percent of the
> time. More than half pass on the first draft. Each connector costs about seven
> cents.

## Chunk 6 — distribution (1:16 – 1:38) · collage: CLI terminal, Claude Code chat, Slack message, GitHub PR comment

> It runs anywhere you work. As a CLI. As an MCP server inside Claude Code,
> Codex and Cursor. As a web demo. As a Slack slash command. As a GitHub
> pull-request bot that drops the finished connector straight into your repo.

## Chunk 7 — close (1:38 – 1:50) · title card again + URLs

> Describe an integration. Walk away. Come back to passing tests.
> patchbay. Open source. Built on Nebius.

---

## Shot list to film while the VO is being generated

Record **1920×1080 at 60 fps**, no mouse highlight, hide the OS cursor glow.
Any clean screen recorder works (OBS Studio, ScreenToGif, QuickTime). You can
also just reuse the Puppeteer renders in `docs/screenshots/*.mp4` for the shots
where the browser is the whole frame.

1. **Title card** — static image (I'll ship it as an Artifact). 8s.
2. **Live demo prompt → plan** — open `patchbay-nebius.vercel.app`, click the
   `Stripe → Mailchimp` pill, click `Build connector`. Record until the Plan
   card is fully visible. ~18s.
3. **Verify in sandbox** — same recording, keep rolling into the `Prove it in
   a sandbox` step. Expand the step so the log is visible. ~20s.
4. **Parallel branches** — in a run that needs repair (Shopify HMAC is a good
   bet), capture the `Repairing with 2 parallel branches` log line + both
   `[branch 1]` / `[branch 2]` results + the "Chose branch 1" line. ~15s.
5. **Benchmark dashboard** — navigate to `/bench`, hero stats visible, slow
   scroll down one page. ~15s.
6. **Distribution collage** — four quick cuts, 4-5s each:
   - Terminal with `patchbay build "..."` running
   - Claude Code chat where the MCP tool is called
   - Slack message where `/patchbay` was typed and the thread replies
   - GitHub PR with the auto-opened patchbay PR
7. **End card** — static image (I'll ship this too). 10s.

## Editing

- CapCut (free, mac/win) or DaVinci Resolve (free). Both handle 1080p60 fine.
- Audio: lay the ElevenLabs clips end-to-end on one track, add 0.5s silence
  between chunks. The silent screens stretch to match the voice length.
- Background music optional. If you add one, keep it under -22 dBFS so it
  doesn't fight the voice. Pixabay has royalty-free "ambient tech" tracks.
- Export: H.264 MP4, 1080p60, ~15 Mbps. YouTube unlisted → paste link in Devpost.

## Timing checklist before submit

- [ ] Under 3 minutes (Devpost cap)
- [ ] Shows the live demo URL at least once (lower-third or end card)
- [ ] Credits Nebius + NVIDIA in the end card
- [ ] Audio normalised to -14 LUFS
- [ ] Downloadable copy saved in `docs/` in case YouTube takes it down

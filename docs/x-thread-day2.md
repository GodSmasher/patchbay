# X thread — Day 2

Draft for the Day 2 build-in-public thread. Written to be pasted and lightly
edited, not read as prose. Each tweet is already under 280 chars.

---

## Tweet 1 (pin candidate — attach GIF 1)

Day 2 of building patchbay in public.

one sentence in → tested TypeScript connector out.

generated, verified in a sandbox with the network off, repaired until green.

90% green over 92 runs on real APIs.

try it: https://patchbay-nebius.vercel.app

---

## Tweet 2 (reply, no media)

five steps, three Nemotron tiers on Nebius:

plan (Lightning) →
research the real docs via Tavily (Super) →
write connector + tests (Ultra) →
verify in a Nebius sandbox, no network →
repair with the failing output, up to 4x

full write-up: github.com/GodSmasher/patchbay/blob/main/docs/build-log.md

---

## Tweet 3 (reply — attach GIF 2)

the moment the model fights itself:

two repair branches run in parallel at different temperatures. the one
that compiles first wins. the one that doesn't even parse never spawns a
sandbox.

cheaper and faster than "give me one more try, slower"

---

## Tweet 4 (reply, no media)

the bugs that mattered this week:

• nested describe('contract') broke a regex. 8/10 → 10/10 green
• parallelRepairs=3 made quality WORSE. reverted to 2
• monotonic repair: never hand back something strictly worse
• esbuild preflight: catch parser errors before burning a sandbox fork

full post-mortem per bug in the build log ↑

---

## Tweet 5 (reply — attach GIF 3)

patchbay runs as an MCP server too.

two lines in your terminal and it shows up inside Claude Code / Codex /
Cursor. ask in natural language, get the connector back as a tool-call
result with live progress.

setup: github.com/GodSmasher/patchbay/blob/main/docs/mcp-setup.md

---

## Tweet 6 (reply — attach the benchmark table screenshot or paste as text)

the current scoreboard:

• 90.2% green over 92 runs
• 52.2% first-try (no repair needed)
• ~$0.07 per connector
• ~45s average wall-clock

run it yourself: npm run bench -- --passes=5

results: github.com/GodSmasher/patchbay/blob/main/bench/RESULTS-variance.md

---

## Tweet 7 (close — plain text)

Day 3 ships:
• /patchbay slash command live in Slack
• a Vercel-free self-host guide
• the five-pass variance redo

star the repo if you want to follow along:
https://github.com/GodSmasher/patchbay

---

## Notes

- Tweet 1 is the pin — the hero GIF has to be the Calendly→Slack first-try
  green run. Nothing else beats that for stopping the scroll.
- Tweet 3 and Tweet 5 are the two that most reliably convert to clicks.
  Make sure the GIFs are under 5 MB each so mobile users see them without
  tapping play.
- If a tweet underperforms within the first hour, don't be afraid to
  delete and re-post with a sharper first line. The thread is more valuable
  than any single tweet in it.

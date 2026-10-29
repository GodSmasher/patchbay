# patchbay — hackathon video production plan

**Goal**: a 90-second submission video that looks like a human engineer made it, not a generative model. The uncanny valley for AI video is pacing + voice + perfect UI pixels — avoid all three.

**The split**:
1. **You record** the real product on screen capture (3 clips, ~2 minutes of raw footage total).
2. **You record** a real voiceover reading the narration below (~90 seconds).
3. **Fable** does the assembly: cuts your clips to the beats, syncs voice, adds minimal title cards, color-grades.

That order is important. The recorded parts are what sells "this is real software made by a real person". Fable is the tasteful editor, not the author.

---

## Step 1 — Record these three clips yourself

Open OBS or ScreenStudio at 1920×1080, 30 fps, cursor highlight ON.

### Clip A — "the demo" (record ~2 minutes, we'll cut to ~35 seconds)

1. Open `patchbay-nebius.vercel.app` in a fresh tab.
2. Click the first example chip (**Typeform → Pipedrive**).
3. Click **Build connector**.
4. Let the whole pipeline run. Don't talk, don't do anything. Just let plan → research → generate → verify stream.
5. When it hits green (13/13), hover the **Download .zip** button, click it.
6. Open the downloaded zip in Finder/Explorer, show `connector/`, `trajectory/`, `manifest.json`.

### Clip B — "the numbers" (record ~30 seconds)

1. New tab at `patchbay-nebius.vercel.app/bench`.
2. Hold on the TypeScript Core 20 tab for 3 seconds. Numbers visible.
3. Click Python → Core 20. Hold 3 seconds.
4. Click Python → Brutal 20. Hold 3 seconds.
5. Scroll down slowly through the per-prompt table for 10 seconds.

### Clip C — "the fine-tune" (record ~45 seconds)

1. Open `tokenfactory.nebius.com/post-training`.
2. Click the succeeded Oct 28 patchbay-repair job (Last updated 11:22:44 AM).
3. Hold on the Checkpoints view, loss values visible (0.0099 → 0.0082 → 0.0064).
4. Open a second tab at `tokenfactory.nebius.com/endpoints` → show the `patchbay-repair` endpoint running on H100 NVLink. (If the AI Cloud endpoint is where it's running, use that console view instead.)
5. Hold for 5 seconds on each.

Save each as `clip-a.mov`, `clip-b.mov`, `clip-c.mov`.

---

## Step 2 — Record the narration

Read this out loud into a quiet mic. Pause 500ms between sections. One continuous take; don't restart on small flubs. Natural tone, not announcer voice.

Save as `narration.wav`.

> Every integration is the same ritual. Read the docs. Write the glue code. Hope the tests pass. Debug when they don't. patchbay does it for you.
>
> One sentence in. A small Nemotron plans the integration. Tavily reads the real Typeform and Pipedrive docs. Nemotron Ultra writes the connector and the tests. Then it runs them in an isolated Nebius Sandbox — with the network switched off. If a test fails, the model sees the failure and fixes the code.
>
> Thirteen out of thirteen green on the second draft. Two minutes. Seven cents.
>
> Full audit bundle in one zip. The connector, the trajectory, every prompt that went to the model, hashes you can verify. Nothing hidden.
>
> We ran it a hundred and ninety-two times on live Nebius Sandboxes. TypeScript Core twenty: ninety point two percent green. Python Core twenty: seventy-three. Twenty adversarial prompts — OAuth refresh, GraphQL federation, presigned uploads — seventy percent.
>
> patchbay produces repair data on every run. We trained Qwen 3, thirty-B, on a hundred and nine of those pairs on Nebius Token Factory Post-training. It serves right now on Nebius AI Cloud, H100 NVLink, OpenAI-compatible.
>
> Four Nebius services, end to end. Nemotron for the pipeline. Sandboxes for the proof. Post-training for the self-improvement loop. AI Cloud for serving.

Timings target (count silence as part of the section):
- Hook: 10s
- Demo: 35s
- Numbers: 20s
- Fine-tune: 15s
- Close: 10s
- **Total: 90s**

If your take runs over 100s, cut the hook — it's the most expendable.

---

## Step 3 — Hand this to Fable

Paste this prompt into Fable and attach `clip-a.mov`, `clip-b.mov`, `clip-c.mov`, `narration.wav`.

```
Assemble a 90-second product video for a hackathon submission from the four
attached files. One voice, no music.

Source material:
- narration.wav — the voice track, use the full 90 seconds.
- clip-a.mov — the live build demo. The pipeline streams on screen.
- clip-b.mov — the benchmark page with the numbers.
- clip-c.mov — the Nebius console views for the fine-tune.

Cut structure, matched to the voice:
- 0:00–0:10 hook. clip-a frozen on the landing page before the pipeline
  starts. Hold on the prompt text.
- 0:10–0:45 live demo. Play clip-a at native speed. When the voice says
  "thirteen out of thirteen green" cut to the exact frame where that number
  first appears. When the voice says "full audit bundle" cut to the zip
  being opened.
- 0:45–1:05 numbers. Cut to clip-b. Each time the voice names a percentage,
  cut to the frame where that tab is active and the number is centered.
  Overlay each number — 90.2%, 73.3%, 70.0% — in the same serif as the page.
- 1:05–1:20 fine-tune. Cut to clip-c. Hold on the loss curve while the voice
  names the loss values. Then cut to the running endpoint when the voice
  says "serves right now".
- 1:20–1:30 close. End card over clip-a landing page, muted. Serif text:
  "patchbay". Mono line below: "patchbay-nebius.vercel.app · github.com/GodSmasher/patchbay".

Visual rules:
- No zooms, no pans, no Ken Burns effect. Static framing only.
- Transitions are hard cuts. One quiet piano note (middle C) at each
  section break, no music under the dialogue.
- Keep the paper tone of the source clips, don't recolor to blue.
- If overlay text is needed, use a serif face at 48pt, ink color
  matching the page, with a 1s fade in and no fade out.
- Mouse cursor stays visible on all demo footage.

Deliberately do NOT:
- Insert any generated b-roll, stock footage, or motion graphics.
- Add captions or lower thirds.
- Speed-ramp or slow-ramp any clip.
- Add logo stingers or sponsor placements.
- Make the voice sound processed — leave the room tone in.

Output: single .mp4, 1920×1080, 30 fps, H.264, 90-100 seconds.
```

---

## Numbers to pronounce right

- 90.2 percent (say "ninety point two")
- 73.3 percent
- 70.0 percent
- 192 (say "one hundred and ninety-two")
- 109 (say "one hundred and nine")
- Qwen 3 (say "Qwen three", not "Qwen cubed")
- H100 NVLink (say "H one hundred NVLink")

## Why this will not look AI

- The screen capture IS the product. No synthesized UI.
- Your voice has real room tone and real breath. Even imperfect, that's the tell.
- Hard cuts and silence between sections — AI-generated video defaults to over-animated transitions. Static framing reads as human-edited.
- No motion graphics, no logo animations, no "powered by" text. Hackathon judges have seen every pre-built template.

## If you don't want to record a voiceover yourself

Use ElevenLabs with the "Rachel" or "Adam" voice at 0.85 stability, 0.65 similarity. Pass the same narration script. The AI-ness is 70% in the voice, so this is where quality matters most — pay the pennies for a natural voice model, not Fable's generic one.

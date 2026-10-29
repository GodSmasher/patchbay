# patchbay — hackathon submission video script

**Length target**: ~90 seconds. Pacing: fast but not rushed, 2 cuts per sentence block.
**Tone**: honest engineer, not pitchy. Numbers do the selling.
**Visual language**: 90% screen capture, 10% b-roll (dashboard panels, bench page).

---

## 0:00–0:10 — Hook

**[VISUAL]** Landing page `patchbay-nebius.vercel.app`, cursor types the Typeform → Pipedrive example into the prompt box.

**[NARRATION]**
> Every integration is the same ritual: read the docs, write the glue code,
> hope the tests pass, debug when they don't. patchbay does it for you.

---

## 0:10–0:45 — Live demo (the money shot)

**[VISUAL]** Click **Build connector**. Screen capture the live run as the four phases stream in: Plan → Research → Generate → Verify.

**[NARRATION — read over the stream]**
> One sentence in. A small Nemotron plans the integration.
> Tavily reads the real Typeform and Pipedrive docs, mid-size Nemotron
> extracts the endpoints. Nemotron Ultra writes a TypeScript connector
> with tests. Then — this is the part — it runs the tests in an
> isolated Nebius Sandbox. Network off. If a test fails, the model
> sees the failure, fixes the code, and tries again.

**[VISUAL]** Repair cycle visible: Draft 1 → Draft 2 with the `13/13 ✓`.

**[NARRATION]**
> Thirteen out of thirteen tests green on the second draft. Two minutes.
> Seven cents.

**[VISUAL]** Hover the **Download .zip** button, click, show the extracted
`connector/`, `trajectory/`, `prompt.txt`, `manifest.json` with SHA-256
hashes.

**[NARRATION]**
> Full audit bundle in one zip — code, trajectory, every prompt that
> went to the model, hashes you can verify. Nothing hidden.

---

## 0:45–1:10 — The numbers (the honesty slide)

**[VISUAL]** Navigate to `/bench`. Switch TypeScript → Python → Brutal 20.

**[NARRATION]**
> We ran it 192 times on live Nebius Sandboxes. TypeScript Core 20:
> ninety point two percent green. Python Core 20: seventy-three.
> Twenty adversarial prompts — OAuth refresh, GraphQL federation,
> presigned uploads — seventy percent. Every per-run JSON is in the repo.
> No cherry-picking.

---

## 1:10–1:30 — The fine-tune (the "we went further" slide)

**[VISUAL]** Nebius Console → Token Factory → Post-training jobs → open
Job ftjob-75eb0... (succeeded ✓, loss curve visible).

**[NARRATION]**
> patchbay produces repair data on every run — red test, green test, the
> code change between. We trained Qwen3-30B-A3B on 109 of those pairs
> on Nebius Token Factory Post-training. Three epochs, loss down from
> point-oh-one to point-oh-oh-six.

**[VISUAL]** Cut to the AI Cloud Endpoints page → `patchbay-repair` endpoint
Running on H100 NVLink.

**[NARRATION]**
> And it serves right now on Nebius AI Cloud, H100 NVLink, OpenAI-compatible.
> One API key swap and patchbay runs on its own fine-tune.

---

## 1:30–1:45 — Close

**[VISUAL]** Back to landing page. Scroll to the stack line: "Models:
Nemotron on Nebius Token Factory · API docs: Tavily · Verified in: Nebius
Sandboxes".

**[NARRATION]**
> Four Nebius services end to end. Nemotron for the pipeline, Sandboxes
> for the proof, Post-training for the self-improvement loop, AI Cloud
> for serving. Repo and live site in the description. Thanks.

---

## Deliverable checklist for recording

- [ ] Browser tab at `patchbay-nebius.vercel.app` with the Typeform example pre-filled
- [ ] A second tab at `/bench?lang=py&set=brutal` for the numbers cut
- [ ] Nebius console tab on the fine-tune job page (Checkpoints view, loss values visible)
- [ ] Nebius console tab on the Model Endpoints page showing `patchbay-repair` state = Running
- [ ] 1080p screen capture, 30 fps minimum, mouse-highlight ON

## Optional B-roll (if you want to run long to 2:00)

- Monaco code panel scrolling the generated connector
- Diff view of Draft 1 → Draft 2 (where the repair happened)
- Terminal running `patchbay build "..."` CLI → shows the same pipeline out of the browser
- Claude Code pane calling the MCP server's `build_connector` tool

## Numbers to say exactly right

- **90.2%** TypeScript Core 20 (not "about 90%")
- **73.3%** Python Core 20
- **70.0%** Python Brutal 20
- **192** live Nebius Sandbox runs
- **109** red→green repair pairs in the fine-tune dataset
- **Qwen3-30B-A3B-Instruct-2507** base model (not "Qwen 30B")
- **H100 NVLink** GPU (not just "H100")

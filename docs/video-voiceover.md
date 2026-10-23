# Voiceover für patchbay-Demo (ElevenLabs)

**Vorgehen:**
1. elevenlabs.io → Text to Speech
2. Voice: **Rachel** (clean, dev-content tone) oder **Adam** (etwas tiefer)
3. Voice settings: **Stability 50 · Similarity 75 · Style 20 · Speaker boost ON**
4. Model: **Eleven Multilingual v2** oder **Eleven Turbo v2.5** (günstiger, schneller)
5. Jeden Chunk unten einzeln generieren, als MP3 exportieren
6. Dateien benennen: `01-hook.mp3`, `02-what.mp3`, …, `07-close.mp3`
7. In CapCut/Resolve chronologisch an die Video-Timeline packen, 0.5s Stille dazwischen

---

## 01 — Hook (0:00–0:08)

```
patchbay turns one sentence into a tested TypeScript connector.
```

## 02 — What it does (0:08–0:26)

```
You describe the integration — any webhook, any API — and patchbay plans it, reads the real documentation with Tavily, and writes a connector with tests, powered by Nemotron on the Nebius Token Factory.
```

## 03 — The proof (0:26–0:45)

```
Then it proves the code works. Every draft runs through type-check and vitest inside an isolated Nebius sandbox, with the network switched off. Nothing talks to the real APIs. The connector either passes against the documented example payload, or it goes back for repair.
```

## 04 — Parallel repair (0:45–1:02)

```
When a test fails, patchbay forks the sandbox twice at different temperatures and lets both repairs race. The first one that lands green wins. The one that doesn't even parse never spawns a sandbox at all.
```

## 05 — Numbers (1:02–1:16)

```
Over ninety real benchmark runs, patchbay lands green nearly nine times out of ten. More than half pass on the first draft. Each connector costs about seven cents.
```

## 06 — Distribution (1:16–1:38)

```
It runs anywhere you work. As a CLI. As an MCP server inside Claude Code, Codex and Cursor. As a web demo. As a Slack slash command. As a GitHub pull-request bot that drops the finished connector straight into your repo.
```

## 07 — Close (1:38–1:50)

```
Describe an integration. Walk away. Come back to passing tests. patchbay. Open source. Built on Nebius.
```

---

**Gesamtlänge:** ~1:50 (Devpost-Cap: 3:00 — safe)
**Normalisieren beim Export:** -14 LUFS für YouTube

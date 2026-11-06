# -*- coding: utf-8 -*-
"""Call ElevenLabs TTS on patchbay's narration script and save the result as mp3."""
import os
import sys
import urllib.request
import json

sys.stdout.reconfigure(encoding='utf-8')

API_KEY = os.environ.get("ELEVENLABS_API_KEY")
if not API_KEY:
    print("ERROR: ELEVENLABS_API_KEY not in env", file=sys.stderr)
    sys.exit(1)

# Rachel — American English, calm engineer tone. ElevenLabs default voice id.
VOICE_ID = "21m00Tcm4TlvDq8ikWAM"
MODEL = "eleven_multilingual_v2"

# Clean narration — pronunciation hints removed, pauses as ellipses (ElevenLabs reads
# "..." as a natural pause). The brackets in narration-tts-ready.md are reader hints,
# not SSML, so they'd be read literally. We strip them for the API call.
NARRATION = """Every integration is the same ritual.

Read the docs. Write the glue code. Hope the tests pass. Debug when they don't.

...

patchbay does it for you.

One sentence in.

A small Nemotron plans the integration.

Tavily reads the real Typeform and Pipedrive docs.

Nemotron Ultra writes the connector and the tests.

Then it runs them in an isolated Nebius Sandbox — with the network switched off.

If a test fails, the model sees the failure and fixes the code.

...

Thirteen out of thirteen green on the second draft. Two minutes. Seven cents.

...

Full audit bundle in one zip. The connector, the trajectory, every prompt that went to the model, hashes you can verify. Nothing hidden.

...

We ran it a hundred and ninety-two times on live Nebius Sandboxes.

TypeScript Core twenty: ninety point two percent green.

Python Core twenty: seventy-three point three.

Twenty adversarial prompts — OAuth refresh, GraphQL federation, presigned uploads — seventy percent.

...

patchbay produces repair data on every run. We trained Qwen three, thirty B, A three B, on a hundred and seventy-three of those pairs, on Nebius Token Factory Post-training.

It serves right now on Nebius AI Cloud, H one hundred NVLink, OpenAI compatible.

...

Four Nebius services, end to end. Nemotron for the pipeline. Sandboxes for the proof. Post-training for the self-improvement loop. AI Cloud for serving.
"""

body = json.dumps({
    "text": NARRATION,
    "model_id": MODEL,
    "voice_settings": {
        "stability": 0.85,
        "similarity_boost": 0.65,
        "style": 0.0,
        "use_speaker_boost": True,
    },
}).encode("utf-8")

url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
req = urllib.request.Request(
    url,
    data=body,
    headers={
        "xi-api-key": API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    },
    method="POST",
)
print(f"POST {url}")
print(f"model: {MODEL}, voice: Rachel ({VOICE_ID})")
print(f"text length: {len(NARRATION)} chars")

try:
    with urllib.request.urlopen(req, timeout=180) as r:
        print(f"status: {r.status}")
        audio = r.read()
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode(errors='replace')[:500]}", file=sys.stderr)
    sys.exit(2)

out = "docs/patchbay-narration.mp3"
with open(out, "wb") as f:
    f.write(audio)

print(f"\nwrote {out} ({len(audio) / 1024:.1f} KiB)")

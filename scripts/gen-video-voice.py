# -*- coding: utf-8 -*-
"""Final try — one continuous narration that TELLS the story.
Doesn't read the on-screen text. Flows naturally. No chopping.
"""
import os, sys, json, subprocess, urllib.request, pathlib

sys.stdout.reconfigure(encoding='utf-8')

API_KEY = os.environ["ELEVENLABS_API_KEY"]
VOICE_ID = "XB0fDUnXU5powFXDhCwa"  # Charlotte — warmer, more natural
MODEL = "eleven_multilingual_v2"
# Looser stability + a bit of style = more human intonation, less flat announcer
VOICE_SETTINGS = {"stability": 0.45, "similarity_boost": 0.80, "style": 0.30, "use_speaker_boost": True}

OUT_DIR = pathlib.Path("scratchpad/video-voice")
OUT_DIR.mkdir(parents=True, exist_ok=True)
VIDEO_IN = pathlib.Path(os.path.expanduser("~")) / "Downloads" / "patchbay-90s.mp4"
VIDEO_OUT = pathlib.Path("docs") / "patchbay-90s-voiced.mp4"
NAR = OUT_DIR / "narration-story.mp3"

# Story-flow narration. Does NOT read the on-screen text — tells the WHY, the context,
# the thing the viewer wouldn't get from the visuals alone. Natural paragraphs.
# Target ~85-90s at Charlotte's natural pace.
# Main story (one continuous take). Ends at "Four Nebius services" to match the
# visual at 80-85s. The final "You own the code" is a separate clip anchored at
# the 86.8s visual below.
NARRATION_MAIN = (
    "Every integration starts the same way. You read the docs. "
    "You write the glue code. You wait for broken tests. "
    "patchbay just does it. "
    "You give it one sentence — a Typeform submission becomes a Pipedrive lead. "
    "A small Nemotron parses the apps, the trigger, the field mapping. "
    "Tavily pulls the real vendor documentation. Not training data. The actual pages. "
    "Nemotron Ultra writes the connector and the tests. "
    "Then it runs them in a Nebius sandbox with the network cut. "
    "When a test fails, the model reads the failure and fixes the code. "
    "Second draft, thirteen green out of thirteen. Two minutes. Seven cents. "
    "You get the whole bundle — code, trajectory, every prompt that went to the model, hashes you can verify. "
    "We ran this a hundred and ninety-two times on live Nebius sandboxes. "
    "TypeScript: ninety point two percent green. "
    "Python: seventy-three. "
    "The hardest prompts — OAuth refresh, GraphQL federation, presigned uploads — seventy percent. "
    "And every run creates its own training data. "
    "patchbay fine-tuned Qwen three thirty-B on a hundred and seventy-three of its own repairs. "
    "It's serving right now on a Nebius H one hundred. "
    "Four Nebius services end to end — Token Factory, Sandboxes, Post-training, AI Cloud. One closed loop."
)

OUTRO_TEXT = "You own the code."
OUTRO_START = 87.6  # 0.6s after visual appears, lets main narration finish cleanly
NARRATION = NARRATION_MAIN  # keep legacy variable so the rest of script works

def probe(p):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                   "-of", "default=noprint_wrappers=1:nokey=1", str(p)])
    return float(out.strip())

# One call
print(f"generating one-shot story narration ({len(NARRATION)} chars)...")
body = json.dumps({"text": NARRATION, "model_id": MODEL, "voice_settings": VOICE_SETTINGS}).encode()
req = urllib.request.Request(
    f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}",
    data=body, method="POST",
    headers={"xi-api-key": API_KEY, "Content-Type": "application/json", "Accept": "audio/mpeg"},
)
with urllib.request.urlopen(req, timeout=180) as r:
    NAR.write_bytes(r.read())
dur = probe(NAR)
print(f"  dur: {dur:.2f}s (video 90s)")

# If > 90s, use a gentle 0.98 speed. If < 90s, use as-is (end has silence for outro visuals).
if dur > 90.5:
    factor = min(dur / 90.0, 1.05)  # tiny speed-up only if needed
    NAR_FIT = OUT_DIR / "narration-story-fit.mp3"
    subprocess.run([
        "ffmpeg", "-y", "-i", str(NAR), "-filter:a", f"atempo={factor:.4f}",
        "-c:a", "libmp3lame", "-b:a", "192k", str(NAR_FIT)
    ], check=True, capture_output=True)
    NAR = NAR_FIT
    print(f"  speed {factor:.3f}x -> {probe(NAR):.2f}s")

# generate outro clip, delay it to OUTRO_START and mix with main narration
OUTRO = OUT_DIR / "outro.mp3"
if not OUTRO.exists():
    body2 = json.dumps({"text": OUTRO_TEXT, "model_id": MODEL, "voice_settings": VOICE_SETTINGS}).encode()
    req2 = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}",
        data=body2, method="POST",
        headers={"xi-api-key": API_KEY, "Content-Type": "application/json", "Accept": "audio/mpeg"},
    )
    with urllib.request.urlopen(req2, timeout=120) as r:
        OUTRO.write_bytes(r.read())
outro_dur = probe(OUTRO)
# Make sure outro starts cleanly after main (never overlaps). Guarantee at least 0.3s gap.
EFFECTIVE_START = max(OUTRO_START, dur + 0.3)
print(f"outro '{OUTRO_TEXT}' dur: {outro_dur:.2f}s, main ends {dur:.2f}s, lands at {EFFECTIVE_START:.2f}s")

print("merging (video full 90s, main narration + outro at 86.8s)...")
delay_ms = int(EFFECTIVE_START * 1000)
subprocess.run([
    "ffmpeg", "-y", "-i", str(VIDEO_IN), "-i", str(NAR), "-i", str(OUTRO),
    "-filter_complex",
    f"[2:a]adelay={delay_ms}|{delay_ms}[outro];"
    f"[1:a][outro]amix=inputs=2:duration=longest:normalize=0[mix];"
    f"[mix]apad=whole_dur=90[a]",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
    "-map", "0:v:0", "-map", "[a]",
    "-shortest",
    str(VIDEO_OUT)
], check=True, capture_output=True)
print(f"OK: {VIDEO_OUT} ({VIDEO_OUT.stat().st_size / 1024 / 1024:.1f} MiB)")

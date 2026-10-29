#!/bin/sh
# Entrypoint for a Nebius AI Cloud "Create Endpoint" that serves patchbay's
# fine-tuned Qwen3-30B-A3B via vLLM.
#
# This script runs INSIDE the vllm/vllm-openai container when the endpoint
# starts. It:
#   1. Downloads the fine-tune checkpoint directly from Nebius Token Factory
#      (so the user never has to touch the 48 GB locally)
#   2. Starts vLLM OpenAI-compatible server on :8000
#
# Requirements set in the Nebius endpoint config:
#   - Image: vllm/vllm-openai:latest
#   - Port: 8000 (HTTP)
#   - Secret env var: NEBIUS_API_KEY (same key that trained the model)
#   - Optional env var: FINETUNE_JOB_ID (defaults to the current job if unset)

set -e

JOB_ID="${FINETUNE_JOB_ID:-ftjob-75eb05699051437e97573635b7a30abd}"
API="https://api.tokenfactory.nebius.com/v1"
WEIGHTS_DIR="${WEIGHTS_DIR:-/weights}"

if [ -z "$NEBIUS_API_KEY" ]; then
  echo "FATAL: NEBIUS_API_KEY must be set (add it as a Secret environment variable in the Nebius endpoint config)."
  exit 1
fi

mkdir -p "$WEIGHTS_DIR"
echo "[entrypoint] job: $JOB_ID"
echo "[entrypoint] weights dir: $WEIGHTS_DIR"

# One Python invocation does everything: get the job → list result_files →
# fetch per-file metadata → pick the biggest ftckpt_ group → stream each file.
python3 <<PYEOF
import json, os, sys, time, urllib.request

API = "$API"
JOB_ID = "$JOB_ID"
WEIGHTS = "$WEIGHTS_DIR"
KEY = os.environ["NEBIUS_API_KEY"]
HDRS = {"Authorization": f"Bearer {KEY}"}

def get_json(path):
    req = urllib.request.Request(API + path, headers=HDRS)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())

print(f"[entrypoint] fetching job metadata...", flush=True)
job = get_json(f"/fine_tuning/jobs/{JOB_ID}")
ids = job.get("result_files") or []
print(f"[entrypoint] result_files: {len(ids)}", flush=True)

metas = []
for fid in ids:
    for attempt in range(3):
        try:
            metas.append(get_json(f"/files/{fid}"))
            break
        except Exception as e:
            if attempt == 2: raise
            time.sleep(1 + attempt)

groups = {}
for m in metas:
    fn = m.get("filename", "")
    if fn.startswith("ftckpt_"):
        ckpt = fn.split("/", 1)[0]
        groups.setdefault(ckpt, []).append(m)
if not groups:
    print("[entrypoint] FATAL: no ftckpt_ files in result_files", file=sys.stderr)
    sys.exit(2)

chosen = max(groups.items(), key=lambda kv: sum(m["bytes"] for m in kv[1]))
ckpt_id, files = chosen
total = sum(m["bytes"] for m in files)
print(f"[entrypoint] chosen checkpoint: {ckpt_id}", flush=True)
print(f"[entrypoint] {len(files)} files, {total / 1024**3:.1f} GiB total", flush=True)

for i, m in enumerate(files, 1):
    rel = m["filename"].split("/", 1)[1]
    dest = os.path.join(WEIGHTS, rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    size_mib = m["bytes"] / 1024**2
    print(f"[entrypoint] [{i}/{len(files)}] {rel} ({size_mib:.1f} MiB)...", flush=True)
    # Token Factory /files/{id}/content throttles sequential bursts after ~6 large shards
    # with HTTP 403, so retry with exponential backoff up to 5 attempts (2s, 4s, 8s, 16s, 32s).
    for attempt in range(5):
        try:
            req = urllib.request.Request(API + f"/files/{m['id']}/content", headers=HDRS)
            with urllib.request.urlopen(req, timeout=600) as resp, open(dest, "wb") as out:
                while True:
                    chunk = resp.read(4 * 1024 * 1024)
                    if not chunk: break
                    out.write(chunk)
            break
        except urllib.error.HTTPError as e:
            if attempt == 4 or e.code not in (403, 429, 500, 502, 503, 504):
                raise
            backoff = 2 ** (attempt + 1)
            print(f"[entrypoint]   HTTP {e.code} on attempt {attempt + 1}, sleeping {backoff}s", flush=True)
            time.sleep(backoff)
    # Small sleep between files to avoid tripping the burst limit at all.
    time.sleep(1)

print(f"[entrypoint] weights ready in {WEIGHTS}", flush=True)
PYEOF

echo "[entrypoint] starting vLLM..."
exec python -m vllm.entrypoints.openai.api_server \
  --model "$WEIGHTS_DIR" \
  --served-model-name patchbay-repair \
  --max-model-len 32768 \
  --port 8000 \
  --trust-remote-code \
  --dtype bfloat16

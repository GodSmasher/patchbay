#!/usr/bin/env bash
# Pull the fine-tune weights from $CHECKPOINT_URL into /weights/, then exec vLLM
# with the OpenAI-compatible server loading them as a LoRA adapter on top of
# the Qwen3-30B base model.
set -euo pipefail

: "${HF_TOKEN:?HF_TOKEN env var is required to pull the base model from Hugging Face}"
: "${CHECKPOINT_URL:?CHECKPOINT_URL env var is required (fine-tune weights archive)}"

MODEL_ID="${MODEL_ID:-patchbay}"
BASE_MODEL="${BASE_MODEL:-Qwen/Qwen3-30B-A3B-Instruct-2507}"
WEIGHTS_DIR="/weights"
ARCHIVE_PATH="/tmp/patchbay-checkpoint"

export HUGGING_FACE_HUB_TOKEN="$HF_TOKEN"
export HF_TOKEN

if [ ! -f "${WEIGHTS_DIR}/.ready" ]; then
  echo "[run.sh] downloading fine-tune weights from ${CHECKPOINT_URL%%\?*}"
  curl -fL --retry 3 --retry-delay 2 -o "$ARCHIVE_PATH" "$CHECKPOINT_URL"

  # Nebius Token Factory serves checkpoints as either a .tar.gz or a .zip
  # depending on tenant settings; detect by magic bytes rather than extension.
  mkdir -p "$WEIGHTS_DIR"
  if head -c 4 "$ARCHIVE_PATH" | od -An -c | grep -q 'P   K'; then
    echo "[run.sh] extracting zip"
    unzip -q "$ARCHIVE_PATH" -d "$WEIGHTS_DIR"
  elif head -c 2 "$ARCHIVE_PATH" | od -An -c | grep -q '037 213'; then
    echo "[run.sh] extracting tar.gz"
    tar -xzf "$ARCHIVE_PATH" -C "$WEIGHTS_DIR"
  else
    echo "[run.sh] unknown archive format; assuming raw safetensors directory listing"
    mv "$ARCHIVE_PATH" "$WEIGHTS_DIR/"
  fi
  rm -f "$ARCHIVE_PATH"
  touch "$WEIGHTS_DIR/.ready"
  echo "[run.sh] weights ready at $WEIGHTS_DIR"
fi

# If the archive contained a single top-level directory, drop into it so vLLM
# sees adapter_config.json / adapter_model.safetensors at the root path we hand it.
if [ ! -f "$WEIGHTS_DIR/adapter_config.json" ] && [ ! -f "$WEIGHTS_DIR/config.json" ]; then
  INNER=$(find "$WEIGHTS_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1 || true)
  if [ -n "$INNER" ]; then
    LORA_PATH="$INNER"
  else
    LORA_PATH="$WEIGHTS_DIR"
  fi
else
  LORA_PATH="$WEIGHTS_DIR"
fi

echo "[run.sh] starting vLLM: base=$BASE_MODEL · lora=$MODEL_ID=$LORA_PATH"

# Full fine-tune vs LoRA adapter: if the archive contains a config.json but no
# adapter_config.json, it's a full fine-tune — serve directly as the model.
if [ -f "$LORA_PATH/config.json" ] && [ ! -f "$LORA_PATH/adapter_config.json" ]; then
  exec python -m vllm.entrypoints.openai.api_server \
    --host 0.0.0.0 --port 8000 \
    --model "$LORA_PATH" \
    --served-model-name "$MODEL_ID" \
    --max-model-len 32768
else
  exec python -m vllm.entrypoints.openai.api_server \
    --host 0.0.0.0 --port 8000 \
    --model "$BASE_MODEL" \
    --enable-lora \
    --lora-modules "$MODEL_ID=$LORA_PATH" \
    --max-model-len 32768
fi

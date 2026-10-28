# vLLM container that serves the patchbay-repair fine-tune of Qwen3-30B-A3B-Instruct.
#
# At runtime we read:
#   HF_TOKEN         — Hugging Face token with Qwen/Qwen3-30B-A3B-Instruct-2507 access
#   CHECKPOINT_URL   — direct download for the fine-tune weights archive (tarball or zip)
#   MODEL_ID         — the name patchbay sends as `model` on OpenAI chat/completions
#                     (default: patchbay)
#   BASE_MODEL       — Hugging Face id of the base (default: Qwen/Qwen3-30B-A3B-Instruct-2507)
#
# The entrypoint shell script is `run.sh` — it pulls weights into /weights/
# and then execs vLLM with `--enable-lora --lora-modules $MODEL_ID=/weights`.
#
# Build:  docker build -t patchbay/vllm-repair .
# Run:    docker run --gpus all -p 8000:8000 \
#           -e HF_TOKEN=hf_… -e CHECKPOINT_URL=https://… \
#           patchbay/vllm-repair

FROM vllm/vllm-openai:latest

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates tar unzip \
  && rm -rf /var/lib/apt/lists/*

# Where the fine-tune weights land. Mounted into vLLM as a LoRA adapter at startup.
RUN mkdir -p /weights

COPY run.sh /opt/patchbay/run.sh
RUN chmod +x /opt/patchbay/run.sh

EXPOSE 8000

ENTRYPOINT ["/bin/bash", "/opt/patchbay/run.sh"]

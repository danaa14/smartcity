#!/usr/bin/env bash
# Downloads the Whisper base model (multilingual) for local speech transcription into ocr/whisper.
# Requires whisper-cpp locally: `brew install whisper-cpp`.
set -euo pipefail
mkdir -p ocr/whisper
if [ ! -f ocr/whisper/ggml-base.bin ]; then
  curl -sSL -o ocr/whisper/ggml-base.bin \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
fi
ls -la ocr/whisper
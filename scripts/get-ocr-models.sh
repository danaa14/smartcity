#!/usr/bin/env bash
# Downloads Tesseract fast models for Romanian and Russian into ocr/tessdata (local OCR only).
set -euo pipefail
mkdir -p ocr/tessdata
for l in ron rus eng osd; do
  [ -f "ocr/tessdata/$l.traineddata" ] || curl -sSL -o "ocr/tessdata/$l.traineddata" "https://github.com/tesseract-ocr/tessdata_fast/raw/main/$l.traineddata"
done
ls -la ocr/tessdata

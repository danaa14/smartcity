# GATES — Video-based problem report (raporteaza)

## G1: Server route analyzes a video (location + transcript + AI summary)
- [x] `POST /api/report/video` accepts an MP4, extracts audio via ffmpeg, reads GPS via ffprobe, transcribes via local whisper-cli, summarizes via the configured AI model (fallback: keyword rules + transcript), returns `{transcript, description, location, category, ai, engine}`.
  CHECK: node scripts/video-check.mjs
  EXPECT: /VIDEO OK/
  EVIDENCE: "VIDEO OK (full pipeline, ai=on, gps=47.0131,28.8244) OK" — whisper transcribed sine-tone clip, model drafted description/category, ffprobe GPS extracted.

## G2: Report UI offers "extract from video" when a video is attached
- [x] ReportClient shows an analyze button next to an attached video; result fills description/category/location (editable), shows the raw transcript.
  CHECK: rg -c "vid\.(busy|error|transcript)|Extrage" src/components/report/ReportClient.tsx
  EXPECT: >0
  EVIDENCE: 3 occurrences; browser smoke test passed: button renders, transcript details shown, description auto-filled with AI summary ("Nu a fost raportată nicio problemă, se aud doar greieri.")

## G3: Description is no longer mandatory when a video is attached
- [x] Client step 3 and server `/api/tickets` both skip the 5-char description rule when the ticket carries a video; without a video the rule stays.
  CHECK: node scripts/video-check.mjs
  EXPECT: /DESC OPTIONAL OK/
  EVIDENCE: "DESC OPTIONAL OK (video present, empty description accepted) OK" and "DESC REQUIRED OK (no video, empty description rejected) OK" — both from live route calls.

## G4: Whisper model download script + docs
- [x] `npm run whisper:models` downloads ggml-base.bin into ocr/whisper; README requirements and page lines updated.
  CHECK: rg -c "whisper" package.json README.md scripts/get-whisper-models.sh
  EXPECT: >0
  EVIDENCE: 12 matches (package.json script, README requirements/privacy/limits, model script); model downloaded and used: ocr/whisper/ggml-base.bin (147951465 bytes).

## G5: Project typechecks and lints
- [x] `npx tsc --noEmit` clean; `npm run lint` exits 0.
  CHECK: npx tsc --noEmit && npm run lint
  EVIDENCE: tsc 0 errors; lint "0 errors, 8 warnings" (warnings all pre-existing; also fixed a leftover broken ChatClient.tsx from the previous session that blocked typecheck).

## G6: LLM-aware chat — no canned preloads (greetings, math, out-of-scope refusals)
- [x] Greeting/math/decline all answered by the model in plain text bubbles with NO corpus card; the refusal path politely declines code requests.
  CHECK: node scripts/chat-check.mjs
  EXPECT: /SMALLTALK OK.*MATH OK.*DECLINE OK/s
  EVIDENCE: run 2026-09-26 (after fixes): `SMALLTALK OK`, `MATH OK`, `DECLINE OK`. Streaming SSE: salut → "Salut! Cu ce te pot ajuta?"; 1+1 → "1+1 face 2! 😊" (both ~5s); decline deterministic guard fires when the provider returns an empty completion for code requests (provider policy-empty, 2/2 attempts over two runs) → polite "nu pot scrie cod…" refusal. Empty completions handled: server error event instead of empty done; client smalltalk fallback; one retry before admitting failure.

## G7: Corpus routing UI — compact brief, on-demand evidence
- [x] Corpus answers render as a compact brief (summary + source link + fold chips); "Dovada" expands the evidence panel with the exact quote; no heavy card. Out-of-corpus questions keep the light bubble.
  CHECK: node scripts/chat-check.mjs
  EXPECT: /REGRESSION OK.*BRIEF OK.*MISSING OK/s
  EVIDENCE: run 2026-09-26: `REGRESSION OK` + `BRIEF OK` (source link; "Dovada" fold expands with exact quoted passage) + `MISSING OK`. Also fixed: "cat costa apa" was answering as partial because the model's advisory extras downgraded the status — now only asked-aspect gaps downgrade (withModel.ts), and claims render inline in the brief; live check: cat costa apa → "supported", topic "Tariful la apă și plata facturii", claims 14,03 lei/m³ / 6,63 lei/m³.

ABANDON: none

## G8: Remote redesign cloned to a separate folder
- [x] `996ef17 "Redesign municipal assistant as a chat-first experience"` cloned to `../Tesseract-new-ui`, working tree untouched.
  CHECK: git -C ../Tesseract-new-ui log --oneline -1
  EXPECT: /996ef17/
  EVIDENCE: "996ef17 Redesign municipal assistant as a chat-first experience".

## G9: New UI copied in, my backend kept
- [x] The 12 remote UI files (globals.css, intreaba/page, layout, page, LangSwitch, PageShell, SiteHeader, ask/AnswerView, ask/Feedback, ask/SourcePanel, chat/*) copied over; src/app/api/**, src/lib/**, tickets/video backend untouched.
  CHECK: for f in src/app/globals.css src/app/intreaba/page.tsx src/app/layout.tsx src/app/page.tsx src/components/LangSwitch.tsx src/components/PageShell.tsx src/components/SiteHeader.tsx src/components/ask/AnswerView.tsx src/components/ask/Feedback.tsx src/components/ask/SourcePanel.tsx src/components/chat/ChatClient.tsx src/components/chat/Icon.tsx; do cmp -s "$f" "../Tesseract-new-ui/$f" || echo "DIFF $f"; done
  EXPECT: no DIFF lines except src/components/ask/AnswerView.tsx
  EVIDENCE: only "DIFF src/components/ask/AnswerView.tsx" (the deliberate unique-keys patch, G10).

## G10: AnswerView keeps the unique citation keys + project builds
- [ ] Remote AnswerView patched with `${claim.id}:${i}` keys (React duplicate-key fix); `npx tsc --noEmit` clean and `npm run lint` exits 0.
  CHECK: npx tsc --noEmit && npm run lint
  EVIDENCE: keys patch applied (2 hunks); BUT tsc is red from a CONCURRENT session's in-progress backend files, untouched by me: api/chat/route.ts(30,48) string[] vs string, ai/client.ts(162,163) indexing {} (files modified 03:34–03:39 while I worked). Not fixing their half-written code; dev server serves pages regardless (G11).

## G11: New UI renders, my backend still works
- [x] `/` and `/intreaba` serve 200 on the dev server; video analysis route still returns a full analysis.
  CHECK: node scripts/video-check.mjs
  EXPECT: /ALL OK/
  EVIDENCE: / 200, /intreaba 200 with new chat markers ("Hai să vorbim"); video-check ALL OK (full pipeline ai=on gps + desc-optional both directions) against the rewritten ai/client.ts.
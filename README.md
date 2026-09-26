# Chișinău, pe fir — prototype

> *Fiecare indicație are o dovadă. Fiecare problemă are un traseu.*
> Every instruction has evidence. Every problem has a route.

A working prototype of a municipal assistant for Chișinău that answers only from a defined corpus, cites the exact passage behind every claim, says plainly what it does not know, shows contradictions side by side, and turns those gaps into review items for staff.

**Status:** independent prototype. **Not** an official City Hall service, **not** production-ready, **not** integrated with any municipal system.

## Run it

Requirements: Node ≥ 20, npm. For OCR: `tesseract` and `poppler` (`pdftoppm`, `pdftotext`) on the machine (`brew install tesseract poppler`). For video analysis: `ffmpeg` and `whisper-cpp` (`brew install ffmpeg whisper-cpp`) plus `npm run whisper:models`.

```bash
npm install
npm run ocr:models      # downloads ron/rus Tesseract models into ocr/tessdata (already present in this repo)
npm run dev             # http://localhost:3100
```

Checks:

```bash
npm run verify:corpus   # every real passage must occur verbatim in its fetched snapshot (corpus/raw)
npm run test:answers    # 10 scenarios → expected answer state
npm run test:e2e        # 48 headless-browser checks (needs dev server + `npx playwright install chromium`)
npm run test:docchat    # in-chat document flow: attach → local OCR → redaction gate → verdict → follow-up context
                        # STUB=1 mocks the review response, to check the verdict UI without the model

npx tsc --noEmit && npm run lint
npm run build && npm start
```

**AI model (optional).** Copy `.env.example` to `.env` and set `OPENCODE_API_KEY` (OpenCode Go). The default model is `muse-spark-1.3-contributor`; OpenCode requires "Allow paid endpoints that train on request data" in the workspace Privacy settings for it. The model only drafts the direct-answer claims; each one must still quote a passage verbatim or it is dropped. With no key, or if the model call fails, the app uses the **deterministic demo mode**. Every answer states which mode produced it ("How this answer was produced").

## Pages

| Route | What it does |
|---|---|
| `/` | Question box first, example questions, entry points to Report / Scan / Call. |
| `/intreaba` | Ask: status badge, claims with `[n]` citation markers, source panel with highlighted passage, "radiography" toggle, step-by-step route, missing/contradiction views, contacts + official service page, rating, citation report. **Documents are handled in the same conversation**: attach a photo/PDF from the composer (or drop it on the page) and the OCR, the personal-data review and the verdict all render as chat turns without leaving the page. Whatever is typed when the file is attached becomes the review goal. Afterwards the redacted text travels with follow-up questions, so "ce înseamnă clauza despre penalități?" is answered about that document. |
| `/surse`, `/surse/[id]` | Corpus documents, passage search, Annex 1 inventory, per-document metadata, relations, tariff version timeline. CSV: `/api/inventory`. |
| `/scaneaza` | The same flow as a full page, for a document worth spending time on (side-by-side review, text correction, sample contract). Shares its OCR, redaction and highlighting code with the in-chat version via `src/components/scan/parts.tsx`. Photo/PDF → OCR **in the browser** (tesseract.js, `ron`+`rus` best models) → personal data found **in the browser** (rules for IDNP/IBAN/phone/e-mail/plates/dates + multilingual PII model via transformers.js) and blurred on the page image → user reviews, unticks or adds items and confirms the exact outgoing text → only that redacted text goes to Muse Spark, which returns a verdict, missing elements, risky clauses and suggestions; each finding's quote is checked verbatim against the document before it is highlighted. |
| `/raporteaza` → `/tichet/[id]` | 3-step report (text/photo/video/voice → location + category + description → review & confirm) → local DEMO ticket, truthful timeline, delete. When a video is attached, a button extracts GPS + audio transcript (local whisper-cpp) and an AI model drafts the location, category and description — the description then becomes optional. |
| `/suna` | Phone concept demo (RO/RU), same answer engine, voice report with read-back, human escalation when evidence is missing. |
| `/angajati` | Back office, behind a password (`STAFF_PASSWORD`). Overview; **coverage** (source-to-answer funnel, demand vs. corpus, live traffic); unanswered/partial questions; candidate contradictions with both passages; citation reports; ratings; demo tickets with category, aging and classifier-agreement panels; **evidence** with the corpus recheck queue. Review states and filters throughout. |
| `/despre` | What works / simulated / needs integration, coverage, privacy, **monthly budget calculator**. |

## Architecture

```
src/lib/
  corpus/      docs.ts (source metadata, temporal fields, relations) · passages.ts (verbatim passages + unofficial translations)
               facts.ts (atomic claims, each with verbatim quotes) · topics.ts (route/"GPS" steps, contacts, known gaps)
               inventory.ts (Annex 1 inventory) · examples.ts
  retrieval/   topic + aspect detection (RO/RU, diacritic-insensitive), passage search
  answer/      pipeline.ts (search → draft → validate → gaps/conflicts → route) · validate.ts · conflicts.ts · types.ts
  ocr/         adapter.ts (OcrAdapter; local Tesseract CLI) · analyze.ts (observations vs. deductions) · evidence.ts
  tickets/     types.ts · classify.ts (keyword suggestion) · repo.ts (local JSON + uploads) · adapter.ts (MunicipalSubmissionAdapter)
  feedback/    review items (ratings, citation reports, gaps, conflicts) with PII redaction
  staff/       auth.ts (password gate, HMAC session cookie) · events.ts (one metadata row per answer)
               metrics.ts (coverage funnel, demand, traffic, ticket panels, recheck queue)
  store/db.ts  serialised JSON collections in .data/
  i18n/        RO/RU strings, cookie-based language
  budget.ts    parameters + formulas
scripts/       probe_annex.py · fetch_text.py · verify-corpus.ts · test-answers.ts · e2e.mjs
corpus/        annex-probe.json · raw/ (fetched HTML + extracted text + retrieval metadata) · pdf/
```

**Answer model.** `Answer = { status, claims[{ text{ro,ru}, citations[{n, passageId, quote}], uncertainty }], steps[{ text, claimIds }], missing[], conflicts[{ sides[passage, value], explanation }], contacts, servicePage, passages, docs, validation, engine }`.

**Pipeline.** (1) detect language, requested aspects (documents / cost / time / contact / channel …) and topic; (2) retrieve the topic's facts and passages; (3) draft: select claims for the requested aspects; (4) **validate** every claim: each citation must resolve to an indexed passage and the quote must occur verbatim in it; demo passages may only back `[DEMO]` claims — anything failing is dropped and reported; (5) detect conflicts (same `conflictGroup`, different values, different documents) and missing aspects; (6) return route steps whose claims survived validation. Unanswered, partial and conflicting answers are logged (redacted) as staff review items.

**Plugging in a model.** Replace the draft step with an LLM that outputs the same structure (claims referencing passage IDs + quotes). Validation, gap and conflict detection stay unchanged, so an unsupported sentence from a model is dropped rather than shown.

## Corpus coverage (what was actually processed)

All 42 Annex 1 start URLs were probed on 2026-09-25 (all returned HTTP 200). **4 start URLs were processed into 13 concrete pages/documents, 52 verbatim passages and 39 claims.** Full table at `/surse` and `/api/inventory`.

| Annex start URL | Pages/documents processed |
|---|---|
| chisinau.md | `/ro/petitions` and `/ru/petitions` (online petition form, MSIGN rule); homepage footer (One-Stop-Shop contacts, address) |
| acc.md (Apă-Canal) | `/contraction/1-contractare-proprietari-apartamente`, `/contraction`, `/consumer` (FAQ), `/contacts`, `/tarif-serviciu-apa` (ANRE decision no. 479 of 04.08.2026 as reproduced by the operator + tariff history) |
| autosalubritate.md/informatie-de-contact | that page + `/servicii/servicii-persoane-fizice/` |
| agsv.md/diagrama-defrisare-… | the Annex URL (actually the "Contacte" page), `/petitii-on-line-2/`, PDF form "Cerere pentru examinare fitosanitară a arborilor" |

Topics answerable from real sources: water & sewerage contract (apartment), water tariffs & paying the bill, petitions to City Hall, waste-collection contract (private houses), tree-inspection requests.

Not processed: education, health, transport, district praeturas, the local-taxes list, CMC decisions. `egradinita.md`, `escoala.chisinau.md` and `detsciocana.educ.md` are JavaScript apps with no citable HTML. `chisinau.md/ro/transparenta` rendered the homepage. The AGSV Annex URL named "diagrama defrișare" shows a contacts page.

**Fictional DEMO documents:** two invented "seasonal terrace" documents (a 2024 regulation: 30 calendar days; a 2026 counter page: 15 working days) exist only to demonstrate the contradiction view. They have no URL and are labelled DEMO everywhere.

**Temporal metadata.** Only the Apă-Canal tariff page states publication/effective dates (06.08.2026) and an explicit abrogation (pt. 5 abrogates ANRE decision no. 120/2025); a version timeline is shown on its source page. All other real pages show no date and are marked "validity not established". The Monitorul Oficial original of the ANRE decision was not checked.

## What is simulated / limits

- Answer drafting is deterministic over hand-extracted facts — not live AI. Questions phrased outside the keyword coverage fall back to "Missing".
- Passage translations are unofficial prototype translations; originals are always shown.
- Phone page: caller lines are scripted; no phone number, ASR, call transfer or SMS. Optional browser speech synthesis only.
- Tickets are stored locally and never sent; no processing states are simulated. Categories are the prototype's, not official departments.
- Document assistant: OCR and personal-data detection run in the browser. The PII model (`onnx-community/multilang-pii-ner-ONNX`, ~280 MB int8) is downloaded once from Hugging Face and cached by the browser; no document content is sent in that request. Detection is best-effort: the user must check the blurred preview and the outgoing text before sending, and the server refuses text that still contains e-mails, IDNPs, IBANs or card numbers. The review needs `OPENCODE_API_KEY` and Muse Spark enabled in the OpenCode workspace; the model trains on request data. It is not legal advice. The bundled sample (`public/samples/contract-exemplu.jpg`) is a fictitious contract. The older server-side OCR route (`/api/ocr`, Tesseract CLI, AGSV form rules) is still present.
- Video transcription is real (local whisper-cpp, `ocr/whisper/ggml-base.bin`); the summary uses the configured AI model (see AI section) or keyword rules when the model is unavailable. Video GPS metadata is shown as coordinates; no reverse geocoding.
- Back office is gated by one shared password (`STAFF_PASSWORD`, min. 8 characters) held in an 8-hour HMAC cookie — there are no individual accounts, roles or audit trail, and with the variable unset the page stays closed to everyone. Nobody at City Hall receives these items.
- Back-office figures come only from use of this prototype on this machine. Ticket panels describe a handful of demo tickets, so percentages there move wildly with one more record.

## Integration points

| Need | Where |
|---|---|
| LLM (API or self-hosted) | draft step in `src/lib/answer/pipeline.ts`; keep `validate.ts` |
| Official report submission | implement `MunicipalSubmissionAdapter` in `src/lib/tickets/adapter.ts` (stub `officialPortalAdapterStub`; no public API for the "Sesizează" portal was identified) |
| Another OCR engine | implement `OcrAdapter` in `src/lib/ocr/adapter.ts` (set `external: true` and tell the user) |
| Telephony / ASR / TTS | `/suna` flow → `/api/ask` and `/api/tickets` |
| Corpus refresh | `scripts/probe_annex.py`, `scripts/fetch_text.py`, then `npm run verify:corpus` |
| Storage | `src/lib/store/db.ts` (JSON files → database) |

## Privacy

Demo mode sends nothing to external AI, OCR or storage services. Scanned files are processed in a temp directory and deleted immediately. Video transcription runs locally (whisper-cpp); the transcript and GPS coordinates leave the machine only if the configured AI model is enabled and creates the summary. Tickets and media live in `.data/` and can be deleted from the ticket page. Reports ask for no name, phone or e-mail. Questions stored for review have e-mails, phone numbers and IDNPs replaced. Logs contain no document content.

Every answer also writes one row to `.data/ask-events.json` so the back office has a denominator for its failure counts. That row holds **no question text** — only language, topic, retrieval score, answer status, engine, claim count and the ids of cited passages. A failed question additionally keeps its redacted wording as a review item, because a person has to read it to repair the corpus; a successful one only ever needs counting. Widening this to store wording for successes is a one-line change in `src/lib/staff/events.ts`, and would trade the current privacy posture for the ability to see real phrasings.

## Monthly budget (also interactive at `/despre#buget`)

Assumptions (illustrative, editable in the UI): 30,000 questions/month; 3,000 input tokens (instructions + ~6 passages) and 400 output tokens per question; 50 % of input served from prompt cache; OCR local.

**A. External API — Claude Haiku 4.5.** Prices verified 2026-09-26 on [platform.claude.com/docs/en/about-claude/pricing](https://platform.claude.com/docs/en/about-claude/pricing): $1/MTok input, $5/MTok output, $0.10/MTok cache hits.
Deployment: model on Anthropic infrastructure (global routing; US-only inference is ×1.1); app, DB and files in an EU or Moldovan data centre.

```
input  = 30,000 × 3,000 = 90 MTok → 45 MTok uncached × $1 + 45 MTok cached × $0.10 = $49.50
output = 30,000 × 400   = 12 MTok × $5                                         = $60.00
inference ≈ $109.50 · app + DB ≈ $40 · storage ≈ $10 · OCR $0      → ≈ $160 / month
```

**B. Self-hosted open-weight model (7–14B, vLLM) on a 24 GB GPU dedicated server** in an EU/Moldovan data centre; nothing leaves the operator's infrastructure. The GPU price **could not be verified** on the provider's official page during this run (prices did not render), so it is an assumption.

```
GPU server ≈ $250 · app + DB ≈ $40 · storage ≈ $10 · maintenance 16 h × $15 = $240 · OCR $0
→ ≈ $540 / month (fixed up to one GPU's capacity)
```

Trade-offs: the API is cheaper at this volume and stronger in RO/RU with little operations work, but question text and passages go to the provider (needs a data-processing agreement and disclosure in the UI). Self-hosting keeps data in-house at a fixed cost but needs model evaluation, updates, monitoring and GPU redundancy. The same citation validator applies to both. Telephony is excluded (costs not verified).

## Docs

- `docs/ux/journeys.md` — Ask, Scan, Report journeys incl. failure paths
- `docs/ux/review.md` — design choices, accessibility, known limitations

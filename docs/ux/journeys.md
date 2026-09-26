# User journeys — Ask, Scan, Report

Pattern for each: arrives → understands purpose → acts → gets feedback → knows what happens next. Each lists the failure path, because a dead end is the most likely way to lose a citizen.

## Ask ("Întreabă primăria")

| | |
|---|---|
| **User** | Citizen (often on a phone, RO or RU), or employee checking a rule. |
| **Goal** | "What do I need to do, and can I trust it?" |
| **Needs at this point** | The answer in one line, the steps in order, where to go, and proof. |
| **Shortest safe path** | Home question box → answer summary + status badge → route steps → official page link. |
| **Wrong impression to avoid** | That an unsupported fee/deadline is official; that a newer page overrides a regulation. |

1. **Arrives** on Home; the question box is the first element (above the fold on 390×844). Example chips show questions the corpus can actually answer.
2. **Understands** via the status badge (text + icon: ✓ Supported, ◐ Partial, ∅ Missing, ⚠ Possible contradiction) and a one-sentence summary.
3. **Acts**: reads "What the sources say"; taps a `[n]` marker to see the exact passage highlighted in the original language (side panel on desktop, bottom sheet dialog on mobile). "Radiography" toggles every quote inline.
4. **Feedback**: route steps ("Traseul dvs."), each with its own markers; "Where to go / whom to call" with cited contacts and the verified service page.
5. **Next**: rate usefulness; report a wrong/outdated citation; follow-up questions.
- **Fails / missing**: "Missing from corpus" lists exactly what is not covered, offers the cited City Hall one-stop-shop contact, and logs the (redacted) question for staff. Network failure keeps the question in the field with a retry message.
- **Contradiction**: two passages side by side, the differing values highlighted, explicit "do not plan on either value until confirmed", item goes to staff review.

## Scan ("Scanează un document")

| | |
|---|---|
| **User** | Citizen about to submit a form; wants to know whether something is missing. |
| **Goal** | "Did I forget anything?" |
| **Wrong impression to avoid** | That the tool validates the document, or that OCR is always right. |

1. **Arrives**: two options — upload own file, or scan the bundled sample (real AGSV form, fictitious data, labelled DEMO). Privacy notice states processing is local and nothing is kept.
2. **Acts**: upload → real local Tesseract OCR.
3. **Feedback**: preview with coloured boxes (legend also in text); "Observations" (what the text shows, e.g. "field appears blank") are separated from "Deductions" (what published sources say, each with a highlighted citation). OCR confidence shown.
4. **Next**: correct the OCR text and re-analyse; "What next" tells them to complete fields and submit via the institution's channel.
- **Fails**: unsupported/too-large file → specific message; low confidence or unknown form → "Needs review" with reasons; OCR missing → install instructions. No invented text for arbitrary uploads.

## Report ("Raportează o problemă")

| | |
|---|---|
| **User** | Resident on the street, one hand on the phone. |
| **Goal** | Report quickly and know it was recorded. |
| **Wrong impression to avoid** | That City Hall received it or is working on it. |

1. **Arrives**: DEMO banner up front with the link to the official "Sesizează" portal; 3-step progress bar.
2. **Step 1 — What**: short text, optional photo/video, voice recording (or audio upload).
3. **Step 2 — Where & type**: manual address or suggested device location (shown as coordinates, removable); keyword-suggested category the user confirms or changes; tidied description the user edits.
4. **Step 3 — Review**: everything that will be stored, "No personal data", where it is stored, explicit confirmation checkbox.
5. **Feedback**: ticket page with unique `DEMO-YYYYMMDD-XXXXXX`, "Demo ticket — not submitted to City Hall", a timeline whose only completed step is local creation.
6. **Next**: report another, or delete the ticket and its files.
- **Fails**: field-level errors with focus moved to the field; submission failure keeps the draft on the device (survives reload).

# UX review

## Key design choices

- **Task first, no hero.** Home opens with the question box, four answerable example questions, then Report / Scan / Call. Primary action is visible within the first viewport on a 390 px phone.
- **Evidence is the interface.** Every claim carries numbered markers; the source panel shows publisher, locator, dates, validity note, original-language quote with the supporting span highlighted, then an unofficial translation clearly labelled. Original text is never replaced by a translation.
- **Bureaucratic GPS.** Answers end in ordered steps; a step is only rendered if at least one of its claims passed citation validation.
- **Honest states.** Four answer states, each with icon + text + colour. "Partial" lists which sub-questions are missing; "Contradiction" refuses to pick a winner and explains why (newer ≠ prevailing).
- **Documentation repair loop.** Missing/partial/conflict answers and user reports become review items in the employee view, with states (New / In review / Resolved / Dismissed) and filters.
- **Truthful demo labelling.** DEMO documents, the scan sample, tickets, the phone page and the employee view are all labelled in-context, not just in an About page.
- **Language switch without re-query.** Answers carry RO and RU text for each claim with the same citation IDs, so switching re-renders instantly and numbering stays identical.
- **Restrained civic palette.** One brand blue, neutral greys, semantic colours only for status; system fonts (no external font request).

## Accessibility

- Semantic landmarks, one `h1` per page, skip link as first Tab stop, visible 3 px focus ring.
- All form fields have persistent labels and hints linked with `aria-describedby`; errors use `role="alert"` and move focus to the first invalid field.
- Loading and result changes announced via `aria-live` regions; answer heading receives focus after a result.
- Mobile citation panel uses native `<dialog>` (focus trapped, Esc closes, focus returns to the marker).
- Employee tabs follow the WAI-ARIA tab pattern with arrow-key navigation.
- Status never relies on colour alone (icon + text). Scan highlights are also listed as text observations.
- `prefers-reduced-motion` disables animations; touch targets ≥ 44 px for primary controls.
- `lang` attribute set on the document and on every quoted passage (RO/RU) so screen readers switch pronunciation.
- Verified automatically: keyboard skip link, focus outline, Enter-to-submit, dialog focus return, no horizontal overflow at 390 px (`npm run test:e2e`).

## Known limitations

- No formal screen-reader session (VoiceOver/NVDA). Palette text/background pairs were computed with the WCAG formula (lowest: 5.75:1 for status text on tinted backgrounds; muted text 7.0:1), but no full-page automated audit (e.g. axe) was run.
- Answer drafting is deterministic over a hand-curated fact set: phrasing outside the keyword coverage falls to "Missing" rather than a smarter match.
- Blank-field detection is a heuristic for one known form; other forms get OCR text and a "needs review" notice only.
- Voice recordings are attached, not transcribed. No live ASR.
- Employee view has no authentication.
- Translations of passages are prototype translations, not official.

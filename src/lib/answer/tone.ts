/**
 * Safety net for the conversational voice. The prompts already ask the model to speak like a
 * support agent, but models still open with "Conform Anexei 1, …" or "Согласно источнику, …".
 * The interface shows the evidence separately, so these openers are dropped from the wording.
 *
 * Deliberately narrow: an opener is removed only when it names a source-like noun (annex,
 * source, passage, document, page…). "Conform legii, …" or "Din documentele necesare, …"
 * carry meaning and stay.
 */

const SOURCE_RO = String.raw`(?:anex|surs|pasaj|document|informați|informati|fragment|corpus|extras|pagin|site|text)`;
const SOURCE_RU = String.raw`(?:приложени|источник|документ|фрагмент|данн|информаци|текст|страниц|сайт|корпус|выдержк|отрыв)`;
// Start of the text, of a line, or of a sentence.
const START = String.raw`(^|[.!?…]\s+|\n[ \t]*)`;

const OPENERS: RegExp[] = [
  // "Conform Anexei 1, …", "Potrivit informațiilor de pe site, …", "Așa cum prevede documentul, …"
  new RegExp(`${START}(?:conform|potrivit|în conformitate cu|in conformitate cu|așa cum (?:se )?(?:prevede|menționează|arată|indică|scrie)|după cum (?:se )?(?:arată|menționează|scrie|reiese din))\\s+[^,.!?\\n]{0,80}?${SOURCE_RO}[^,.!?\\n]{0,60},\\s*`, "giu"),
  // "Din informațiile disponibile, …", "Pe baza surselor indexate, …"
  new RegExp(`${START}(?:din|pe baza|în baza)\\s+(?:sursel|pasajel|informațiil|informatiil|fragmentel|datel)\\S*(?:\\s+\\S+){0,2},\\s*`, "giu"),
  // "Согласно приложению 1, …", "По данным сайта, …", "Как указано в документе, …"
  new RegExp(`${START}(?:согласно|в соответствии с|как указано в|как сказано в|как следует из|по данным|судя по)\\s+[^,.!?\\n]{0,80}?${SOURCE_RU}[^,.!?\\n]{0,60},\\s*`, "giu"),
  // "Исходя из предоставленных данных, …"
  new RegExp(`${START}(?:исходя из|на основании)\\s+(?:предоставленн|имеющ|доступн|приведённ|приведенн)\\S*\\s+(?:данных|информации|источников|фрагментов|документов)[^,.!?\\n]{0,40},\\s*`, "giu"),
];

// "(conform Anexei 1)", "(vezi sursa)", "(см. источник 2)" — but not "(vezi pasul 3)".
const ASIDE = new RegExp(String.raw`\s*\((?:conform|potrivit|vezi|sursa|согласно|см\.|источник)[^)]{0,80}\)`, "giu");
const ASIDE_SOURCE = new RegExp(`${SOURCE_RO}|${SOURCE_RU}`, "iu");
// "[1]", "[2, 3]", "[1–4]" — never "[DEMO]" or redaction tags like "[NUME_1]".
const MARKER = /\s*\[\d+(?:\s*[,–-]\s*\d+)*\]/g;
const CAP = "\u0000";

export function humanize(text: string): string {
  let s = text;
  for (const re of OPENERS) s = s.replace(re, (_m, start: string) => start + CAP);
  return s
    .replace(new RegExp(`${CAP}(\\p{Ll})`, "gu"), (_m, c: string) => c.toUpperCase())
    .replaceAll(CAP, "")
    .replace(ASIDE, (m) => (ASIDE_SOURCE.test(m) ? "" : m))
    .replace(MARKER, "")
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .trim();
}

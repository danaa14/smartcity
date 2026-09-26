

export type PiiType = "name" | "address" | "city" | "phone" | "email" | "idnp" | "iban" | "card" | "date" | "plate" | "id_doc" | "other";

export interface PiiSpan {
  id: string;
  start: number;
  end: number;
  text: string;
  type: PiiType;
  source: "rule" | "model" | "user";
  score: number;
  /** Whether it will be masked before anything leaves the device. */
  redact: boolean;
}

const RULES: { type: PiiType; re: RegExp }[] = [
  { type: "email", re: /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu },
  // OCR often misreads "@" as "(Q", "(a)", "©"; catch those so a garbled e-mail is not sent.
  { type: "email", re: /[\p{L}\p{N}._%+-]{2,}\s?(?:\(Q|\(a\)|\(@|©|®|@)\s?[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.(?:md|com|ru|ro|net|org|eu|ua)\b/giu },
  { type: "iban", re: /\bMD\d{2}\s?(?:[A-Z0-9]{2,4}\s?){4,6}[A-Z0-9]{0,4}\b/g },
  { type: "idnp", re: /\b[0-2]\d{12}\b/g },
  { type: "card", re: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g },
  { type: "phone", re: /(?:\+?373[\s-]?|\b0)(?:\(?\d{2,3}\)?[\s-]?)\d{2,3}[\s-]?\d{2,3}[\s-]?\d{0,3}\b/g },
  { type: "plate", re: /\b[A-ZА-Я]{1,3}[\s-]?[A-ZА-Я]{0,3}[\s-]?\d{3}\b(?=[\s,.;)]|$)/g },
  { type: "id_doc", re: /\b(?:[A-Z]{1,2}\d{7,8}|\d{2}\s?\d{2}\s?\d{6})\b/g },
  { type: "date", re: /\b(?:0?[1-9]|[12]\d|3[01])[./-](?:0?[1-9]|1[0-2])[./-](?:19|20)\d{2}\b/g },
  { type: "address", re: /(?<![\p{L}])(?:str\.|strada|bd\.|bulevardul|şos\.|șos\.|ул\.|улица|бул\.|пр\.)\s*[\p{L}\s.'’-]{2,40}?,?\s*(?:nr\.?|№|д\.)?\s*\d+[\p{L}]?(?:\s*,?\s*(?:ap\.|кв\.)\s*\d+)?/giu },
];

/** Deterministic, high-precision detectors for structured identifiers. */
export function detectRules(text: string): PiiSpan[] {
  const out: PiiSpan[] = [];
  for (const { type, re } of RULES) {
    for (const m of text.matchAll(re)) {
      const raw = m[0].replace(/[\s,.;-]+$/, "");
      if (type === "phone" && raw.replace(/\D/g, "").length < 8) continue;
      if (type === "plate" && !/[A-ZА-Я]{2}/.test(raw)) continue;
      out.push({ id: `r${m.index}-${type}`, start: m.index!, end: m.index! + raw.length, text: raw, type, source: "rule", score: 1, redact: true });
    }
  }
  return out;
}

const NER_MAP: Record<string, PiiType> = {
  GIVENNAME: "name", SURNAME: "name", TITLE: "name",
  STREET: "address", BUILDINGNUM: "address", ZIPCODE: "address",
  CITY: "city",
  TELEPHONENUM: "phone", EMAIL: "email",
  IDCARDNUM: "id_doc", PASSPORTNUM: "id_doc", DRIVERLICENSENUM: "id_doc", SOCIALNUM: "idnp", TAXNUM: "idnp",
  CREDITCARDNUMBER: "card", DATE: "date",
};

export const NER_MODEL = "onnx-community/multilang-pii-ner-ONNX";

type NerOut = { entity: string; score: number; index: number; word: string; start?: number | null; end?: number | null }[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let nerPromise: Promise<any> | null = null;

/** Loads the multilingual PII model once; runs fully in the browser (WebGPU when available, else WASM). Cached by the browser after first download. */
export async function loadNer(onProgress?: (pct: number) => void) {
  if (!nerPromise) {
    nerPromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.allowLocalModels = false;
      const files = new Map<string, { loaded: number; total: number }>();
      const progress_callback = (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status === "progress" && p.file && p.total) {
          files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
          let l = 0, t = 0;
          for (const f of files.values()) { l += f.loaded; t += f.total; }
          onProgress?.(t ? l / t : 0);
        }
      };
      const browser = typeof window !== "undefined";
      // Runtime files are served from this site: the CDN copy of this onnxruntime build is not published.
      if (browser && env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = { mjs: "/ort/ort-wasm-simd-threaded.asyncify.mjs", wasm: "/ort/ort-wasm-simd-threaded.asyncify.wasm" };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasGpu = browser && "gpu" in navigator && !!(await (navigator as any).gpu.requestAdapter().catch(() => null));
      try {
        return await pipeline("token-classification", NER_MODEL, { dtype: "q8", device: hasGpu ? "webgpu" : browser ? "wasm" : undefined, progress_callback });
      } catch (e) {
        console.warn("NER webgpu failed, falling back to wasm:", e);
        return await pipeline("token-classification", NER_MODEL, { dtype: "q8", device: browser ? "wasm" : undefined, progress_callback });
      }
    })();
    nerPromise.catch(() => (nerPromise = null));
  }
  return nerPromise;
}

/** Runs NER over sentences and maps sub-word tokens back to character offsets in `text`. */
export async function detectModel(text: string, onProgress?: (pct: number) => void): Promise<PiiSpan[]> {
  const ner = await loadNer(onProgress);
  const spans: PiiSpan[] = [];
  const chunks = chunk(text, 400);
  for (const c of chunks) {
    const out = (await ner(c.text, { ignore_labels: ["O"] })) as NerOut;
    let cursor = 0;
    let cur: { type: PiiType; start: number; end: number; score: number } | null = null;
    const flush = () => {
      if (cur && cur.end > cur.start) {
        const t = text.slice(cur.start, cur.end);
        const core = t.replace(/[\s\p{P}\p{S}]/gu, "");
        // Very short low-confidence hits are almost always OCR noise ("și", "$1"), not personal data.
        const noise = core.length < 2 || (core.length <= 3 && cur.score < 0.8);
        // A large city alone does not identify anyone; list it but leave it visible unless the user ticks it.
        const bigCity = cur.type === "city" && /^(?:mun\.\s*)?(?:chi[șşs]in[ăa]u|кишин[её]в)$/iu.test(t.trim());
        if (!noise)
          spans.push({ id: `m${cur.start}`, start: cur.start, end: cur.end, text: t, type: cur.type, source: "model", score: cur.score, redact: cur.score >= 0.5 && !bigCity });
      }
      cur = null;
    };
    for (const tok of out) {
      const label = tok.entity.replace(/^[BI]-/, "");
      const type = NER_MAP[label];
      const piece = tok.word.replace(/^##|^▁|^Ġ/, "");
      if (!type || !piece) { flush(); continue; }
      const found = c.text.indexOf(piece, cursor);
      if (found < 0) continue;
      const s = c.offset + found;
      const e = s + piece.length;
      cursor = found + piece.length;
      const gap = cur ? text.slice(cur.end, s) : "";
      if (cur && cur.type === type && /^[\s-]{0,2}$/.test(gap) && !tok.entity.startsWith("B-")) {
        cur.end = e;
        cur.score = Math.min(cur.score, tok.score);
      } else if (cur && cur.type === type && gap === "") {
        cur.end = e;
      } else {
        flush();
        cur = { type, start: s, end: e, score: tok.score };
      }
    }
    flush();
  }
  return spans.map(expandToWord(text));
}

function expandToWord(text: string) {
  return (s: PiiSpan): PiiSpan => {
    let { start, end } = s;
    while (start > 0 && /[\p{L}\p{N}]/u.test(text[start - 1])) start--;
    while (end < text.length && /[\p{L}\p{N}@.]/u.test(text[end]) && !/\.\s/.test(text.slice(end, end + 2))) end++;
    while (end > start && /[.,;:]/.test(text[end - 1])) end--;
    return { ...s, start, end, text: text.slice(start, end) };
  };
}

function chunk(text: string, max: number): { text: string; offset: number }[] {
  const out: { text: string; offset: number }[] = [];
  let i = 0;
  while (i < text.length) {
    let j = Math.min(text.length, i + max);
    if (j < text.length) {
      const cut = Math.max(text.lastIndexOf("\n", j), text.lastIndexOf(". ", j));
      if (cut > i + 50) j = cut + 1;
    }
    out.push({ text: text.slice(i, j), offset: i });
    i = j;
  }
  return out;
}

/** Merges overlapping spans; rules win the type because they are exact. Text is recomputed from offsets. */
export function mergeSpans(spans: PiiSpan[], text: string): PiiSpan[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || (a.source === "rule" ? -1 : 1));
  const out: PiiSpan[] = [];
  for (const s of sorted) {
    const prev = out[out.length - 1];
    const gap = prev ? text.slice(prev.end, s.start) : "";
    const joinable = prev && prev.type === s.type && (/^\s{1,2}$/.test(gap) || (s.type === "address" && /^[\s,]{1,3}$/.test(gap)));
    if (prev && (s.start < prev.end || joinable)) {
      prev.end = Math.max(prev.end, s.end);
      prev.redact = prev.redact || s.redact;
      prev.score = Math.max(prev.score, s.score);
      continue;
    }
    out.push({ ...s });
  }
  return out.map((s) => ({ ...s, text: text.slice(s.start, s.end) }));
}

export const PLACEHOLDER: Record<PiiType, { ro: string; ru: string; tag: string }> = {
  name: { ro: "Nume", ru: "Имя", tag: "NUME" },
  address: { ro: "Adresă", ru: "Адрес", tag: "ADRESĂ" },
  city: { ro: "Localitate", ru: "Населённый пункт", tag: "LOCALITATE" },
  phone: { ro: "Telefon", ru: "Телефон", tag: "TELEFON" },
  email: { ro: "E-mail", ru: "E-mail", tag: "EMAIL" },
  idnp: { ro: "IDNP / cod fiscal", ru: "IDNP / фискальный код", tag: "IDNP" },
  iban: { ro: "IBAN", ru: "IBAN", tag: "IBAN" },
  card: { ro: "Card bancar", ru: "Банковская карта", tag: "CARD" },
  date: { ro: "Dată", ru: "Дата", tag: "DATA" },
  plate: { ro: "Nr. înmatriculare", ru: "Госномер", tag: "NR_AUTO" },
  id_doc: { ro: "Nr. act de identitate", ru: "Номер документа", tag: "ACT_ID" },
  other: { ro: "Altă dată personală", ru: "Другие личные данные", tag: "PERSONAL" },
};

/** Replaces each redacted span with a numbered tag, e.g. [NUME_1]. Same value → same tag. */
export function redactText(text: string, spans: PiiSpan[]): string {
  const counters: Partial<Record<PiiType, number>> = {};
  const seen = new Map<string, string>();
  let out = "";
  let pos = 0;
  for (const s of [...spans].filter((x) => x.redact).sort((a, b) => a.start - b.start)) {
    if (s.start < pos) continue;
    const key = `${s.type}:${s.text.toLowerCase().replace(/\s+/g, " ")}`;
    let tag = seen.get(key);
    if (!tag) {
      counters[s.type] = (counters[s.type] ?? 0) + 1;
      tag = `[${PLACEHOLDER[s.type].tag}_${counters[s.type]}]`;
      seen.set(key, tag);
    }
    out += text.slice(pos, s.start) + tag;
    pos = s.end;
  }
  return out + text.slice(pos);
}

/** Final safety net run on the outgoing text: any structured identifier still present blocks sending. */
export function leftoverIdentifiers(redacted: string): string[] {
  return detectRules(redacted)
    .filter((s) => ["email", "iban", "idnp", "card", "phone"].includes(s.type))
    .map((s) => s.text);
}



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
  { type: "name", re: /(?:[Mm][ăa]\s+numesc|[Nn]umele\s+meu\s+(?:este|e))\s+([\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+){0,2})/gu },
  { type: "name", re: /(?:[Мм]еня\s+зовут|[Мм]о[её]\s+имя)\s+([\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+){0,2})/gu },
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
  { type: "address", re: /(?<![\p{L}])(?:str\.|strada|bd\.|bulevardul|şos\.|șos\.|ул\.|улиц[аеы]|бул\.|пр\.)\s*[\p{L}\s.'’-]{2,40}?,?\s*(?:nr\.?|№|д\.)?\s*\d+[\p{L}]?(?:\s*,?\s*(?:ap\.|кв\.)\s*\d+)?/giu },
];

/** Deterministic, high-precision detectors for structured identifiers. */
export function detectRules(text: string): PiiSpan[] {
  const out: PiiSpan[] = [];
  for (const { type, re } of RULES) {
    for (const m of text.matchAll(re)) {
      const raw = (m[1] ?? m[0]).replace(/[\s,.;-]+$/, "");
      const start = m.index! + (m[1] ? m[0].indexOf(m[1]) : 0);
      if (type === "phone" && raw.replace(/\D/g, "").length < 8) continue;
      if (type === "plate" && !/[A-ZА-Я]{2}/.test(raw)) continue;
      out.push({ id: `r${start}-${type}`, start, end: start + raw.length, text: raw, type, source: "rule", score: 1, redact: true });
    }
  }
  return out;
}

const NER_MAP: Record<string, PiiType> = {
  GIVEN_NAME: "name", SURNAME: "name",
  STREET_ADDRESS: "address", STREET_NAME: "address", BUILDING_NUMBER: "address", SECONDARY_ADDRESS: "address", ZIP_CODE: "address",
  CITY: "city", STATE: "city", COUNTRY: "city",
  PHONE: "phone", FAX_NUMBER: "phone", EMAIL: "email",
  GOVERNMENT_ID: "id_doc", PASSPORT: "id_doc", DRIVERS_LICENSE: "id_doc", SSN: "idnp", TAX_ID: "idnp",
  CREDIT_DEBIT_CARD: "card", CVV: "card", IBAN: "iban", DATE: "date", DATE_OF_BIRTH: "date", LICENSE_PLATE: "plate",
  ACCOUNT_NUMBER: "other", CUSTOMER_ID: "other", EMPLOYEE_ID: "other", API_KEY: "other", PASSWORD: "other", PIN: "other", USERNAME: "other",
  MEDICAL_RECORD_NUMBER: "other", ROUTING_NUMBER: "other", SWIFT_BIC: "other", MAC_ADDRESS: "other",
};

export const NER_MODEL = "Wismut/nym-pii-multilingual-small";
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 0 && typeof matchMedia !== "undefined" && matchMedia("(max-width: 1024px)").matches);
}
const MODEL_REVISION = "4348999cd3c2e20c49615e9af7c6bbb45b64cd85";
const MODEL_URL = `https://huggingface.co/${NER_MODEL}/resolve/${MODEL_REVISION}/edge-int8/model_int8.onnx`;
// The model's config uses O followed by B/I pairs in this order.
const NER_LABELS = ["ACCOUNT_NUMBER", "AGE", "API_KEY", "BUILDING_NUMBER", "CITY", "COMPANY_NAME", "COUNTRY", "CREDIT_DEBIT_CARD", "CUSTOMER_ID", "CVV", "DATE", "DATE_OF_BIRTH", "DRIVERS_LICENSE", "EMAIL", "EMPLOYEE_ID", "FAX_NUMBER", "GENDER", "GIVEN_NAME", "GOVERNMENT_ID", "IBAN", "LICENSE_PLATE", "MAC_ADDRESS", "MEDICAL_RECORD_NUMBER", "PASSPORT", "PASSWORD", "PHONE", "PIN", "ROUTING_NUMBER", "SECONDARY_ADDRESS", "SSN", "STATE", "STREET_ADDRESS", "STREET_NAME", "SURNAME", "SWIFT_BIC", "TAX_ID", "TIME", "URL", "USERNAME", "ZIP_CODE"];

type NerOut = { entity: string; score: number; word: string }[];
type LocalNer = (text: string) => Promise<NerOut>;
let nerPromise: Promise<LocalNer> | null = null;

/** Loads the compact multilingual model locally. No message text is sent to the model host. */
export async function loadNer(onProgress?: (pct: number) => void): Promise<LocalNer> {
  if (!nerPromise) {
    nerPromise = (async () => {
      const [{ AutoTokenizer, env }, ort] = await Promise.all([import("@huggingface/transformers"), import("onnxruntime-web")]);
      env.allowLocalModels = false;
      if (typeof window !== "undefined") {
        // Match the bundled ONNX Runtime version; CDN WASM copies are unavailable for this build.
        ort.env.wasm.wasmPaths = { mjs: "/ort/ort-wasm-simd-threaded.mjs", wasm: "/ort/ort-wasm-simd-threaded.wasm" };
      }
      const tokenizer = await AutoTokenizer.from_pretrained(NER_MODEL, { revision: MODEL_REVISION });
      const response = await fetch(MODEL_URL);
      if (!response.ok) throw new Error(`PII model download failed: ${response.status}`);
      const total = Number(response.headers.get("content-length")) || 0;
      let model: Uint8Array;
      if (response.body && total) {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let loaded = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.byteLength;
          onProgress?.(Math.min(0.95, loaded / total * 0.95));
        }
        model = new Uint8Array(loaded);
        let pos = 0;
        for (const chunk of chunks) { model.set(chunk, pos); pos += chunk.byteLength; }
      } else {
        model = new Uint8Array(await response.arrayBuffer());
      }
      const session = await ort.InferenceSession.create(model, { executionProviders: [typeof window === "undefined" ? "cpu" : "wasm"] });
      onProgress?.(1);
      return async (text: string) => {
        const tokens = tokenizer(text);
        const outputs = await session.run({
          input_ids: new ort.Tensor("int64", tokens.input_ids.data as BigInt64Array, tokens.input_ids.dims),
          attention_mask: new ort.Tensor("int64", tokens.attention_mask.data as BigInt64Array, tokens.attention_mask.dims),
        });
        const logits = outputs.logits.data as Float32Array;
        const width = NER_LABELS.length * 2 + 1;
        const ids = tokens.input_ids.data as BigInt64Array;
        const out: NerOut = [];
        for (let i = 0; i < ids.length; i++) {
          const start = i * width;
          let best = 0;
          for (let j = 1; j < width; j++) if (logits[start + j] > logits[start + best]) best = j;
          if (!best) continue;
          const word = tokenizer.decode([Number(ids[i])], { skip_special_tokens: true });
          if (!word) continue;
          let sum = 0;
          for (let j = 0; j < width; j++) sum += Math.exp(logits[start + j] - logits[start + best]);
          out.push({ entity: `${best % 2 ? "B" : "I"}-${NER_LABELS[Math.floor((best - 1) / 2)]}`, score: 1 / sum, word });
        }
        return out;
      };
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
    const out = await ner(c.text);
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
          spans.push({ id: `m${cur.start}`, start: cur.start, end: cur.end, text: t, type: cur.type, source: "model", score: cur.score, redact: cur.score >= 0.25 && !bigCity });
      }
      cur = null;
    };
    for (const tok of out) {
      const label = tok.entity.replace(/^[BI]-/, "");
      const type = NER_MAP[label];
      const piece = tok.word.replace(/^##|^▁|^Ġ/, "");
      if (!type || !piece.trim()) { flush(); continue; }
      const found = c.text.indexOf(piece, cursor);
      if (found < 0) continue;
      const leading = piece.length - piece.trimStart().length;
      const trailing = piece.length - piece.trimEnd().length;
      const s = c.offset + found + leading;
      const e = c.offset + found + piece.length - trailing;
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

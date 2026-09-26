import { FACTS } from "../corpus/facts";
import { PASSAGES } from "../corpus/passages";
import { DOCS, DOC_BY_ID } from "../corpus/docs";
import { TOPICS, OUT_OF_CORPUS_HINTS } from "../corpus/topics";
import type { Aspect, Passage, Topic } from "../corpus/types";
import { normalize, tokens } from "../text";

/**
 * Words that appear in every civic question and so identify no subject on their own.
 * Payment verbs belong here: "platesc"/"achit" are water-tariff keywords, which used to make
 * "cum evit sa platesc impozitele?" match the water tariff with full confidence.
 */
const GENERIC = new Set([
  "contract", "contractul", "acte", "documente", "casa", "договор", "документ", "дом",
  "cost", "costa", "lei", "лей", "plati", "platesc", "platit", "plata", "achit", "factura",
  "плат", "оплат", "счет",
]);

/** Function words carry no topical signal but match nearly every passage, so they never score. */
const STOP = new Set([
  "care", "este", "sunt", "pentru", "despre", "unde", "cand", "cine", "cum", "ce", "cat", "cate", "cati",
  "din", "dar", "sau", "cu", "la", "de", "pe", "in", "si", "un", "una", "unui", "unei", "al", "ale", "lui",
  "mai", "fel", "vreau", "trebuie", "poate", "pot", "imi", "mie", "eu", "tu", "noi", "voi", "are", "am",
  "fost", "fie", "daca", "asta", "acest", "aceasta", "acel", "there", "the", "and", "for", "what", "how",
  "это", "как", "что", "где", "когда", "кто", "для", "про", "или", "но", "из", "на", "по", "мне", "мой",
  "быть", "если", "этот", "эта", "тот", "они", "вы", "мы", "я", "нужно", "надо", "можно", "могу", "есть",
]);

function contentTokens(s: string): string[] {
  return tokens(s).filter((t) => !STOP.has(t));
}

const ASPECT_CUES: Record<Aspect, string[]> = {
  documents: ["act", "acte", "document", "documente", "anex", "hartii", "ce trebuie", "ce imi trebuie", "документ", "справк", "бумаг", "что нужно", "что нужн", "прилож"],
  cost: ["cost", "costa", "pret", "tarif", "taxa", "lei", "bani", "plata", "platesc", "achit", "cat e", "стоит", "стоим", "цен", "тариф", "плат", "лей", "деньг", "оплат"],
  time: ["termen", "cand", "cate zile", "cat dureaza", "dureaza", "in cat timp", "zile", "timp", "срок", "когда", "сколько дней", "как долго", "дней", "время", "за сколько"],
  contact: ["contact", "telefon", "suna", "unde", "adresa", "program", "sediu", "телефон", "где", "адрес", "контакт", "позвон", "куда"],
  procedure: ["cum", "pasi", "procedura", "ce fac", "depun", "как", "порядок", "что делать", "подать", "шаг"],
  channel: ["online", "internet", "email", "e mail", "site", "онлайн", "интернет", "почт", "сайт"],
  obligation: ["obligat", "trebuie sa", "amenda", "penalit", "обязан", "штраф", "должен"],
  validity: ["in vigoare", "valabil", "actual", "nou", "действ", "актуал", "новый"],
};

function matches(qNorm: string, qTokens: string[], kw: string): boolean {
  const k = normalize(kw);
  if (!k) return false;
  if (k.includes(" ")) return qNorm.includes(k);
  return qTokens.some((t) => t.startsWith(k) || (k.length >= 5 && k.startsWith(t) && t.length >= 4));
}

export function detectAspects(question: string): Aspect[] {
  const qn = normalize(question);
  const qt = tokens(question);
  return (Object.keys(ASPECT_CUES) as Aspect[]).filter((a) => ASPECT_CUES[a].some((c) => matches(qn, qt, c)));
}

export interface TopicHit {
  topic: Topic;
  score: number;
  /**
   * Score from subject-bearing keywords only — no generic words, no aspect bonus.
   * Ranking uses `score`; deciding whether we may answer without the model uses this,
   * because "cost" and "procedure" aspects match almost any question and must never
   * on their own make a topic look certain.
   */
  specific: number;
}

export function rankTopics(question: string, aspects: Aspect[]): TopicHit[] {
  const qn = normalize(question);
  const qt = tokens(question);
  return TOPICS.map((topic) => {
    let score = 0;
    let specific = 0;
    for (const kw of topic.keywords) {
      const kn = normalize(kw);
      let w = 0;
      if (!kn) continue;
      // A question token INSIDE a longer keyword ("primar" in "primărie") is a
      // weak, often coincidental signal — demote it so a lone coincidence
      // never reads as a confident topic match.
      if (kn.includes(" ")) {
        if (qn.includes(kn)) w = 1;
      } else if (qt.some((t) => t.startsWith(kn))) w = 1;
      else if (qt.some((t) => kn.length >= 5 && kn.startsWith(t) && t.length >= 4)) w = 0.4;
      if (w > 0) {
        if (GENERIC.has(kn)) score += Math.min(w, 0.3);
        else {
          score += w;
          specific += w;
        }
      }
    }
    if (score > 0) {
      const topicAspects = new Set(FACTS.filter((f) => f.topic === topic.id).flatMap((f) => f.aspects));
      score += aspects.filter((a) => topicAspects.has(a)).length * 0.5;
    }
    return { topic, score: Math.round(score * 100) / 100, specific: Math.round(specific * 100) / 100 };
  })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function keywordFactMatch(question: string, keywords?: string[]): boolean {
  if (!keywords) return false;
  const qn = normalize(question);
  const qt = tokens(question);
  return keywords.some((k) => matches(qn, qt, k));
}

export function outOfCorpusHint(question: string) {
  const qn = normalize(question);
  const qt = tokens(question);
  return OUT_OF_CORPUS_HINTS.find((h) => h.keywords.some((k) => matches(qn, qt, k)));
}

// ---------------------------------------------------------------------------
// BM25 passage index
//
// The curated topics cover six subjects, but the corpus holds hundreds of
// ingested pages. Keyword topic ranking alone cannot reach them, so every
// passage is indexed here and scored independently of whether a topic matched.
// ---------------------------------------------------------------------------

const K1 = 1.5;
const B = 0.75;

interface Index {
  postings: Map<string, { i: number; f: number }[]>;
  len: number[];
  avg: number;
  n: number;
}

let INDEX: Index | null = null;

function index(): Index {
  if (INDEX) return INDEX;
  const postings = new Map<string, { i: number; f: number }[]>();
  const len: number[] = [];
  PASSAGES.forEach((p, i) => {
    const doc = DOC_BY_ID.get(p.docId);
    const hay = contentTokens(
      `${p.text} ${p.unofficialTranslation?.ro ?? ""} ${p.unofficialTranslation?.ru ?? ""} ${doc?.title ?? ""}`,
    );
    len[i] = hay.length;
    const tf = new Map<string, number>();
    for (const t of hay) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [t, f] of tf) {
      const list = postings.get(t);
      if (list) list.push({ i, f });
      else postings.set(t, [{ i, f }]);
    }
  });
  const n = PASSAGES.length;
  INDEX = { postings, len, avg: len.reduce((s, l) => s + l, 0) / Math.max(1, n), n };
  return INDEX;
}

/** Query terms are matched by prefix so Romanian/Russian inflections still hit. */
const EXPAND_CACHE = new Map<string, string[]>();

function expand(q: string, idx: Index): string[] {
  const hit = EXPAND_CACHE.get(q);
  if (hit) return hit;
  const out: string[] = [];
  for (const term of idx.postings.keys()) {
    if (term.startsWith(q) || (q.length >= 5 && q.startsWith(term) && term.length >= 4)) out.push(term);
  }
  if (EXPAND_CACHE.size > 2000) EXPAND_CACHE.clear();
  EXPAND_CACHE.set(q, out);
  return out;
}

export interface PassageHit {
  passage: Passage;
  score: number;
  /**
   * Share of the question's *distinguishing* weight found in this passage (0–1), weighted by
   * inverse document frequency. Matching only ubiquitous words ("primăria", "Chișinău") scores
   * near zero, so a passage must cover the rare terms to count as an answer.
   */
  coverage: number;
}

/** BM25 search across every indexed passage. Used by the source browser and the answer pipeline. */
export function searchPassages(query: string, limit = 12, allowedDocIds?: readonly string[]): PassageHit[] {
  const idx = index();
  const qt = [...new Set(contentTokens(query))];
  if (!qt.length) return [];

  const acc = new Map<number, { score: number; hit: Set<string> }>();
  const reach = new Map<string, Set<number>>();
  for (const q of qt) {
    const seen = new Set<number>();
    reach.set(q, seen);
    for (const term of expand(q, idx)) {
      const list = idx.postings.get(term)!;
      const idf = Math.log(1 + (idx.n - list.length + 0.5) / (list.length + 0.5));
      if (idf <= 0) continue;
      for (const { i, f } of list) {
        seen.add(i);
        const norm = (f * (K1 + 1)) / (f + K1 * (1 - B + B * (idx.len[i] / idx.avg)));
        const cur = acc.get(i);
        if (cur) {
          cur.score += idf * norm;
          cur.hit.add(q);
        } else acc.set(i, { score: idf * norm, hit: new Set([q]) });
      }
    }
  }

  // How much each query word narrows the corpus: a word in half the passages is nearly free.
  const weight = new Map<string, number>();
  for (const q of qt) {
    const df = reach.get(q)!.size;
    weight.set(q, Math.log(1 + (idx.n - df + 0.5) / (df + 0.5)));
  }
  const total = qt.reduce((s, q) => s + weight.get(q)!, 0) || 1;

  return [...acc]
    .map(([i, v]) => ({
      passage: PASSAGES[i],
      score: Math.round(v.score * 1000) / 1000,
      coverage: Math.round(([...v.hit].reduce((s, q) => s + weight.get(q)!, 0) / total) * 1000) / 1000,
    }))
    .filter((hit) => !allowedDocIds || allowedDocIds.includes(hit.passage.docId))
    .sort((a, b) => b.coverage - a.coverage || b.score - a.score)
    .slice(0, limit);
}

export interface Retrieval {
  topic: Topic | null;
  topicScore: number;
  candidates: { topicId: string; score: number }[];
  passages: PassageHit[];
  /** Worth drafting cited claims. Deliberately permissive: if the passages turn out not to
   *  answer the question the drafter returns nothing and the caller falls back to prose. */
  grounded: boolean;
  /** Strong enough to serve the curated facts verbatim when the model is unavailable.
   *  A weak keyword brush ("Primăria" in a question about tax codes) must never qualify,
   *  because the deterministic fallback cannot tell that the topic is wrong. */
  confident: boolean;
}

const TOPIC_WEAK = 1;
/** Confidence needs the subject named, not just transactional words plus aspect overlap. */
const SPECIFIC_CONFIDENT = 1.5;
const COVERAGE_ALONE = 0.5;
/** Coverage is degenerate for one- or two-word inputs: "salut" trivially covers itself. */
const MIN_TOKENS_FOR_COVERAGE = 3;

export function retrieve(question: string, aspects = detectAspects(question)): Retrieval {
  const ranked = rankTopics(question, aspects).filter((hit) => hit.topic.kind !== "demo");
  const top = ranked[0] && ranked[0].score >= TOPIC_WEAK ? ranked[0] : null;
  const officialIds = DOCS.filter((doc) => doc.kind === "real" && doc.url && doc.id !== "voice-annex-source-list").map((doc) => doc.id);
  const passages = searchPassages(question, 8, officialIds);
  const coverage = passages[0]?.coverage ?? 0;
  const score = top?.score ?? 0;
  const enoughWords = new Set(contentTokens(question)).size >= MIN_TOKENS_FOR_COVERAGE;

  return {
    topic: top?.topic ?? null,
    topicScore: score,
    candidates: ranked.slice(0, 3).map((h) => ({ topicId: h.topic.id, score: h.score })),
    passages,
    grounded: (top?.specific ?? 0) >= SPECIFIC_CONFIDENT || (enoughWords && coverage >= COVERAGE_ALONE),
    confident: (top?.specific ?? 0) >= SPECIFIC_CONFIDENT,
  };
}

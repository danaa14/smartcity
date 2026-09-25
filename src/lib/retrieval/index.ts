import { FACTS } from "../corpus/facts";
import { PASSAGES } from "../corpus/passages";
import { DOC_BY_ID } from "../corpus/docs";
import { TOPICS, OUT_OF_CORPUS_HINTS } from "../corpus/topics";
import type { Aspect, Passage, Topic } from "../corpus/types";
import { normalize, tokens } from "../text";

const GENERIC = new Set(["contract", "contractul", "acte", "documente", "casa", "договор", "документ", "дом", "cost", "costa", "lei", "лей"]);

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
  const out = (Object.keys(ASPECT_CUES) as Aspect[]).filter((a) => ASPECT_CUES[a].some((c) => matches(qn, qt, c)));
  return out;
}

export interface TopicHit {
  topic: Topic;
  score: number;
}

export function rankTopics(question: string, aspects: Aspect[]): TopicHit[] {
  const qn = normalize(question);
  const qt = tokens(question);
  return TOPICS.map((topic) => {
    let score = 0;
    for (const kw of topic.keywords) if (matches(qn, qt, kw)) score += GENERIC.has(normalize(kw)) ? 0.3 : 1;
    if (score > 0) {
      const topicAspects = new Set(FACTS.filter((f) => f.topic === topic.id).flatMap((f) => f.aspects));
      score += aspects.filter((a) => topicAspects.has(a)).length * 0.25;
    }
    return { topic, score: Math.round(score * 100) / 100 };
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

/** Plain passage search for the source browser (term overlap, both languages via translations). */
export function searchPassages(query: string, limit = 12): { passage: Passage; score: number }[] {
  const qt = tokens(query);
  if (!qt.length) return [];
  return PASSAGES.map((p) => {
    const hay = tokens(`${p.text} ${p.unofficialTranslation?.ro ?? ""} ${p.unofficialTranslation?.ru ?? ""} ${DOC_BY_ID.get(p.docId)?.title ?? ""}`);
    let score = 0;
    for (const q of qt) if (hay.some((h) => h.startsWith(q) || (q.length >= 5 && q.startsWith(h.slice(0, 5))))) score++;
    return { passage: p, score: score / qt.length };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

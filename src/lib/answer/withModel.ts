import "server-only";
import { answerQuestion } from "./pipeline";
import { draftWithModel, fallbackLabel, MODEL_LABEL } from "./llm";
import { validateClaims } from "./validate";
import { AI } from "../ai/config";
import { ModelError } from "../ai/client";
import { FACTS } from "../corpus/facts";
import { PASSAGE_BY_ID } from "../corpus/passages";
import { DOC_BY_ID } from "../corpus/docs";
import { retrieve } from "../retrieval";
import { normalize } from "../text";
import type { Lang } from "../corpus/types";
import type { Answer } from "./types";

/** Repeated questions resolve instantly: corpus answers only depend on the question, lang and corpus. */
const CACHE = new Map<string, Promise<Answer | null>>();
const CACHE_MAX = 200;

/**
 * Model-assisted corpus answer, or `null` when the corpus cannot reach the question and the
 * caller should fall back to the general (uncited) path.
 *
 * The deterministic pipeline supplies the curated route, contacts, conflicts and known gaps;
 * the model only drafts the direct-answer claims, which must pass verbatim-quote validation.
 */
export function answerWithModel(question: string, lang: Lang, signal?: AbortSignal): Promise<Answer | null> {
  // Normalised so "Cât costă apa?" and "cat costa apa" share one entry.
  const key = `${lang}\0${normalize(question)}`;
  const hit = CACHE.get(key);
  if (hit) return hit;
  const run = (async () => {
    try {
      const answer = await buildAnswer(question, lang, signal);
      if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value as string);
      return answer;
    } catch (e) {
      CACHE.delete(key);
      throw e;
    }
  })();
  CACHE.set(key, run);
  return run;
}

async function buildAnswer(question: string, lang: Lang, signal?: AbortSignal): Promise<Answer | null> {
  const found = retrieve(question);
  const base = answerQuestion(question, lang);

  // A conflict between sources is the one thing the model must never adjudicate.
  if (base.status === "contradiction") return base;
  if (!found.grounded) return null;
  // Serving pre-written facts is only safe when retrieval is sure of the subject; otherwise
  // the user gets a confident answer to a question they did not ask.
  const curated = found.confident && base.claims.length > 0;
  if (!AI.enabled) return curated ? base : null;

  // A passage-only match has no curated topic, so the pipeline's "not covered by the
  // indexed sources" gap no longer applies — the passages below ARE indexed sources.
  const start = base.topicId ? base : { ...base, missing: [] };

  const topicPassages = base.topicId
    ? FACTS.filter((f) => f.topic === base.topicId).flatMap((f) => f.cites.map((c) => c.passageId))
    : [];
  const candidates = [...new Set([...topicPassages, ...found.passages.map((h) => h.passage.id)])];

  try {
    const draft = await draftWithModel(question, candidates, signal);
    const { valid, report } = validateClaims(draft.claims);
    // Nothing survived validation: keep a curated answer if we have one, otherwise let the
    // caller answer from general knowledge rather than stonewalling the user.
    if (!valid.length) return curated ? withFallback(start, "empty") : null;

    // Renumber: model claims first, then the route/contact citations already numbered by the pipeline.
    const order: string[] = [];
    for (const c of valid) for (const cit of c.citations) if (!order.includes(cit.passageId)) order.push(cit.passageId);
    for (const s of start.sources) if (!order.includes(s.passageId)) order.push(s.passageId);
    const renumber = (cs: { passageId: string; n: number }[]) => cs.forEach((c) => (c.n = order.indexOf(c.passageId) + 1));
    for (const c of valid) renumber(c.citations);
    for (const c of Object.values(start.claimIndex)) renumber(c.citations);

    const passages = { ...start.passages };
    const docs = { ...start.docs };
    for (const c of valid)
      for (const cit of c.citations) {
        const p = PASSAGE_BY_ID.get(cit.passageId)!;
        passages[p.id] = p;
        docs[p.docId] = DOC_BY_ID.get(p.docId)!;
      }

    const missing = [...start.missing, ...draft.missing];
    if (report.dropped.length)
      missing.push({
        ro: `${report.dropped.length} afirmație(i) propuse de model au fost eliminate: citatul nu apărea exact în sursă.`,
        ru: `${report.dropped.length} утверждение(й), предложенных моделью, удалено: цитата не совпадала с источником.`,
      });
    // Partial only when an ASKED aspect is uncovered (pipeline gaps are aspect-grounded).
    // Extras the model volunteers (e.g. penalties nobody asked about) stay in `missing` as
    // advisory but must not downgrade a complete answer.
    const status = start.missing.length ? "partial" : "supported";
    const subject = start.topicTitle ? ` Subiect: ${start.topicTitle.ro}.` : "";
    const subjectRu = start.topicTitle ? ` Тема: ${start.topicTitle.ru}.` : "";

    return {
      ...start,
      status,
      claims: valid,
      claimIndex: { ...start.claimIndex, ...Object.fromEntries(valid.map((c) => [c.id, c])) },
      sources: order.map((passageId, i) => ({ n: i + 1, passageId })),
      missing,
      passages,
      docs,
      summary:
        status === "supported"
          ? { ro: `Răspuns susținut de surse: ${valid.length} afirmații verificate.${subject}`, ru: `Ответ подтверждён источниками: ${valid.length} проверенных утверждений.${subjectRu}` }
          : { ro: `Răspuns parțial: ${valid.length} puncte verificate, ${start.missing.length} lipsesc sau au fost eliminate.${subject}`, ru: `Частичный ответ: ${valid.length} проверенных пунктов, ${start.missing.length} отсутствуют или удалены.${subjectRu}` },
      validation: { checked: report.checked + start.validation.checked, passed: report.passed + start.validation.passed, dropped: [...report.dropped, ...start.validation.dropped] },
      engine: { ...start.engine, mode: "llm", model: AI.model, label: MODEL_LABEL() },
    };
  } catch (e) {
    const code = e instanceof ModelError ? e.code : "upstream";
    console.warn(`[answer] model fallback: ${code}`);
    return curated ? withFallback(start, code) : null;
  }
}

function withFallback(base: Answer, code: string): Answer {
  return { ...base, engine: { ...base.engine, mode: "llm-fallback", model: AI.model, label: fallbackLabel(code) } };
}

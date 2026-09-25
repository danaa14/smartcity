import "server-only";
import { answerQuestion } from "./pipeline";
import { draftWithModel, fallbackLabel, MODEL_LABEL } from "./llm";
import { validateClaims } from "./validate";
import { AI } from "../ai/config";
import { ModelError } from "../ai/client";
import { FACTS } from "../corpus/facts";
import { PASSAGE_BY_ID } from "../corpus/passages";
import { DOC_BY_ID } from "../corpus/docs";
import { searchPassages } from "../retrieval";
import type { Lang } from "../corpus/types";
import type { Answer } from "./types";

/**
 * Model-assisted answer. The deterministic pipeline supplies retrieval, the route, contacts,
 * conflicts and known gaps; the model only drafts the direct-answer claims, which must pass the
 * same verbatim-quote validation. Any model failure falls back to the deterministic answer.
 */
export async function answerWithModel(question: string, lang: Lang): Promise<Answer> {
  const base = answerQuestion(question, lang);
  if (!AI.enabled || base.status === "contradiction" || !base.topicId) return base;

  const topicPassages = FACTS.filter((f) => f.topic === base.topicId).flatMap((f) => f.cites.map((c) => c.passageId));
  const searched = searchPassages(question, 6).map((h) => h.passage.id);
  const candidates = [...new Set([...topicPassages, ...searched])];

  try {
    const draft = await draftWithModel(question, candidates);
    const { valid, report } = validateClaims(draft.claims);
    if (!valid.length) return withFallback(base, "empty");

    // Renumber: model claims first, then the route/contact citations already numbered by the pipeline.
    const order: string[] = [];
    for (const c of valid) for (const cit of c.citations) if (!order.includes(cit.passageId)) order.push(cit.passageId);
    for (const s of base.sources) if (!order.includes(s.passageId)) order.push(s.passageId);
    const renumber = (cs: { passageId: string; n: number }[]) => cs.forEach((c) => (c.n = order.indexOf(c.passageId) + 1));
    for (const c of valid) renumber(c.citations);
    for (const c of Object.values(base.claimIndex)) renumber(c.citations);

    const passages = { ...base.passages };
    const docs = { ...base.docs };
    for (const c of valid)
      for (const cit of c.citations) {
        const p = PASSAGE_BY_ID.get(cit.passageId)!;
        passages[p.id] = p;
        docs[p.docId] = DOC_BY_ID.get(p.docId)!;
      }

    const missing = [...base.missing, ...draft.missing];
    if (report.dropped.length)
      missing.push({
        ro: `${report.dropped.length} afirmație(i) propuse de model au fost eliminate: citatul nu apărea exact în sursă.`,
        ru: `${report.dropped.length} утверждение(й), предложенных моделью, удалено: цитата не совпадала с источником.`,
      });
    const status = missing.length ? "partial" : "supported";

    return {
      ...base,
      status,
      claims: valid,
      claimIndex: { ...base.claimIndex, ...Object.fromEntries(valid.map((c) => [c.id, c])) },
      sources: order.map((passageId, i) => ({ n: i + 1, passageId })),
      missing,
      passages,
      docs,
      summary:
        status === "supported"
          ? { ro: `Răspuns susținut de surse: ${valid.length} afirmații verificate. Subiect: ${base.topicTitle!.ro}.`, ru: `Ответ подтверждён источниками: ${valid.length} проверенных утверждений. Тема: ${base.topicTitle!.ru}.` }
          : { ro: `Răspuns parțial: ${valid.length} puncte verificate, ${missing.length} lipsesc sau au fost eliminate. Subiect: ${base.topicTitle!.ro}.`, ru: `Частичный ответ: ${valid.length} проверенных пунктов, ${missing.length} отсутствуют или удалены. Тема: ${base.topicTitle!.ru}.` },
      validation: { checked: report.checked + base.validation.checked, passed: report.passed + base.validation.passed, dropped: [...report.dropped, ...base.validation.dropped] },
      engine: { ...base.engine, mode: "llm", model: AI.model, label: MODEL_LABEL() },
    };
  } catch (e) {
    const code = e instanceof ModelError ? e.code : "upstream";
    console.warn(`model fallback: ${code}`);
    return withFallback(base, code);
  }
}

function withFallback(base: Answer, code: string): Answer {
  return { ...base, engine: { ...base.engine, mode: "llm-fallback", model: AI.model, label: fallbackLabel(code) } };
}

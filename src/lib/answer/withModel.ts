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
import type { Answer, Claim, ValidationReport } from "./types";
import type { LlmDraft } from "./llm";

/** Repeated questions resolve instantly: corpus answers only depend on the question, lang and corpus. */
const CACHE = new Map<string, Promise<Answer | null>>();
const CACHE_MAX = 200;
type NeedDraft = { need: string; draft: LlmDraft; valid: Claim[]; report: ValidationReport };

/**
 * Model-assisted corpus answer, or `null` when the corpus cannot reach the question and the
 * caller should abstain for municipal questions without verified corpus evidence.
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
  const base = answerQuestion(question, lang, { includeDemo: false });

  // A conflict between sources is the one thing the model must never adjudicate.
  if (base.status === "contradiction") return base;
  if (!found.grounded) return null;
  // Serving pre-written facts is only safe when retrieval is sure of the subject; otherwise
  // the user gets a confident answer to a question they did not ask.
  const curated = found.informationNeeds.length === 1 && found.confident && base.claims.length > 0;
  if (!AI.enabled) return curated ? base : null;

  // A passage-only match has no curated topic, so the pipeline's "not covered by the
  // indexed sources" gap no longer applies — the passages below ARE indexed sources.
  const start = base.topicId && found.informationNeeds.length === 1
    ? base
    : {
        ...base,
        topicId: null,
        topicTitle: null,
        demoCorpus: false,
        claims: [],
        claimIndex: {},
        sources: [],
        steps: [],
        missing: [],
        conflicts: [],
        contacts: [],
        passages: {},
        docs: {},
        servicePage: undefined,
      };

  try {
    // Draft each explicit information need against only its own retrieved passages. This
    // prevents a strong match for one clause from becoming evidence for another clause.
    const drafts: NeedDraft[] = await Promise.all(found.informationNeeds.map(async (need, index) => {
      const topicPassages = found.informationNeeds.length === 1 && found.confident && base.topicId
        ? FACTS.filter((f) => f.topic === base.topicId).flatMap((f) => f.cites.map((c) => c.passageId))
        : [];
      const candidates = [...new Set([...topicPassages, ...found.needPassages[index].map((h) => h.passage.id)])];
      if (!candidates.length) return { need, draft: { claims: [], missing: [] }, valid: [], report: { checked: 0, passed: 0, dropped: [] } as ValidationReport };
      const draft = await draftWithModel(need, candidates, signal);
      const checked = validateClaims(draft.claims);
      return { need, draft, valid: checked.valid, report: checked.report };
    }));
    const valid = drafts.flatMap(({ valid }, index) => valid.map((claim, claimIndex) => ({
      ...claim,
      id: `llm-${index + 1}-${claimIndex + 1}`,
    })));
    const report: ValidationReport = {
      checked: drafts.reduce((sum, item) => sum + item.report.checked, 0),
      passed: drafts.reduce((sum, item) => sum + item.report.passed, 0),
      dropped: drafts.flatMap((item) => item.report.dropped),
    };
    // Nothing survived validation: keep a curated answer if we have one, otherwise let the
    // caller abstain instead of filling the evidence gap from model memory.
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

    const missingNeeds = [
      ...found.missingNeeds,
      ...drafts.filter((item) => found.needPassages[found.informationNeeds.indexOf(item.need)].length > 0 && item.valid.length === 0).map((item) => item.need),
    ];
    const missing = [
      ...start.missing,
      ...missingNeeds.map((need) => ({
        ro: `Nu am putut confirma din pasajele oficiale: „${need}”.`,
        ru: `Не удалось подтвердить по официальным фрагментам: «${need}».`,
      })),
      ...drafts.flatMap((item) => item.draft.missing),
    ].filter((item, index, all) => all.findIndex((other) => other.ro === item.ro && other.ru === item.ru) === index);
    if (report.dropped.length)
      missing.push({
        ro: `${report.dropped.length} afirmație(i) propuse de model au fost eliminate: citatul nu apărea exact în sursă.`,
        ru: `${report.dropped.length} утверждение(й), предложенных моделью, удалено: цитата не совпадала с источником.`,
      });
    // A model-reported missing part or a dropped unverifiable claim must never be returned
    // as fully supported, even if the deterministic aspect detector missed that sub-question.
    const status = !valid.length ? "missing" : missing.length ? "partial" : "supported";
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

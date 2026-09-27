import "server-only";
import { answerQuestion } from "./pipeline";
import { draftWithModel, fallbackLabel, MODEL_LABEL } from "./llm";
import { validateClaims } from "./validate";
import { AI } from "../ai/config";
import { ModelError } from "../ai/client";
import { FACTS } from "../corpus/facts";
import { PASSAGE_BY_ID } from "../corpus/passages";
import { DOC_BY_ID } from "../corpus/docs";
import { detectAspects, rankTopics, retrieve } from "../retrieval";
import { normalize, tokens } from "../text";
import type { Lang } from "../corpus/types";
import type { Answer, Claim, ValidationReport } from "./types";
import type { LlmDraft } from "./llm";

/** Repeated questions resolve instantly: corpus answers only depend on the question, lang and corpus. */
const CACHE = new Map<string, { answer: Answer; expires: number }>();
const CACHE_MAX = 200;
const SOURCE_AGENT_TIMEOUT_MS = 15000;
type NeedDraft = { need: string; draft: LlmDraft; valid: Claim[]; report: ValidationReport; failed: boolean };

/** Two source groups can be researched at once without treating either model output as evidence. */
async function draftNeed(need: string, candidates: string[], parallel: boolean, signal?: AbortSignal): Promise<NeedDraft> {
  if (!candidates.length) return { need, draft: { claims: [], missing: [] }, valid: [], report: { checked: 0, passed: 0, dropped: [] }, failed: false };
  const groups = parallel && candidates.length >= 4
    ? [candidates.slice(0, Math.ceil(candidates.length / 2)), candidates.slice(Math.ceil(candidates.length / 2))]
    : [candidates];
  const results = await Promise.allSettled(groups.map((ids, index) => draftWithModel(need, ids, signal, index)));
  const valid: Claim[] = [];
  const report: ValidationReport = { checked: 0, passed: 0, dropped: [] };
  const missing: LlmDraft["missing"] = [];
  const seen = new Set<string>();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const checked = validateClaims(result.value.claims);
    report.checked += checked.report.checked;
    report.passed += checked.report.passed;
    report.dropped.push(...checked.report.dropped);
    for (const claim of checked.valid) {
      const key = `${normalize(claim.text.ro)}\0${claim.citations.map((c) => c.passageId).join(",")}`;
      if (!seen.has(key)) { seen.add(key); valid.push(claim); }
    }
    // A source group may lack an answer that another group found. Its missing list is
    // useful only when that group saw the complete candidate set.
    if (groups.length === 1) missing.push(...result.value.missing);
  }
  return { need, draft: { claims: [], missing }, valid, report, failed: results.some((result) => result.status === "rejected") };
}

/**
 * Model-assisted corpus answer, or `null` when the corpus cannot reach the question and the
 * caller should abstain for municipal questions without verified corpus evidence.
 *
 * The deterministic pipeline supplies the curated route, contacts, conflicts and known gaps;
 * the model only drafts the direct-answer claims, which must pass verbatim-quote validation.
 */
export function answerWithModel(question: string, lang: Lang, signal?: AbortSignal): Promise<Answer | null> {
  // Request cancellation belongs to this caller, never a shared in-flight promise.
  const key = `${lang}\0${normalize(question)}`;
  const hit = CACHE.get(key);
  if (hit && hit.expires > Date.now()) return Promise.resolve(structuredClone({ ...hit.answer, question }));
  return buildAnswer(question, lang, signal).then((answer) => {
    if (answer && !signal?.aborted && answer.status === "supported" && answer.engine.mode !== "llm-fallback") {
      if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value as string);
      CACHE.set(key, { answer: structuredClone(answer), expires: Date.now() + 60_000 });
    }
    return answer;
  });
}

async function buildAnswer(question: string, lang: Lang, signal?: AbortSignal): Promise<Answer | null> {
  const found = retrieve(question);
  const base = answerQuestion(question, lang, { includeDemo: false });

  // A conflict between sources is the one thing the model must never adjudicate.
  if (base.status === "contradiction") return base;
  if (!found.grounded) return null;
  // Serving pre-written facts is only safe when retrieval is sure of the subject; otherwise
  // the user gets a confident answer to a question they did not ask.
  // Curated claims already have exact citations and need no model round trip.
  if (found.informationNeeds.length === 1 && found.confident && base.claims.length > 0) return base;
  // A multi-part question about that one subject still goes to the model part by part, but
  // its curated answer (with the gaps named) is what is served offline or if drafting fails.
  const curated = found.confident && base.claims.length > 0 && sameSubject(found.informationNeeds, base.topicId);
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
    const draftSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(SOURCE_AGENT_TIMEOUT_MS)])
      : AbortSignal.timeout(SOURCE_AGENT_TIMEOUT_MS);
    // Draft each explicit information need against only its own retrieved passages. This
    // prevents a strong match for one clause from becoming evidence for another clause.
    const drafts: NeedDraft[] = await Promise.all(found.informationNeeds.map(async (need, index) => {
      const topicPassages = found.informationNeeds.length === 1 && found.confident && base.topicId
        ? FACTS.filter((f) => f.topic === base.topicId).flatMap((f) => f.cites.map((c) => c.passageId))
        : [];
      const candidates = [...new Set([...topicPassages, ...found.needPassages[index].map((h) => h.passage.id)])];
      return draftNeed(need, candidates, found.informationNeeds.length === 1, draftSignal);
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
    if (!valid.length) return curated ? withFallback(base, "empty") : null;

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
      ...drafts.filter((item) => item.failed && item.valid.length > 0).map((item) => item.need),
    ];
    const missing = [
      ...start.missing,
      ...missingNeeds.map((need) => ({
        ro: `Pentru „${need}” nu am o informație sigură — cel mai bine verificați direct la instituția responsabilă.`,
        ru: `По вопросу «${need}» у меня нет точной информации — лучше уточнить напрямую в ответственном учреждении.`,
      })),
      ...drafts.flatMap((item) => item.draft.missing),
    ].filter((item, index, all) => all.findIndex((other) => other.ro === item.ro && other.ru === item.ru) === index);
    if (report.dropped.length)
      missing.push({
        ro: `Câteva detalii (${report.dropped.length}) nu le-am putut verifica sigur, așa că le-am lăsat deoparte.`,
        ru: `Некоторые детали (${report.dropped.length}) не удалось надёжно проверить, поэтому их здесь нет.`,
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
          : { ro: `Răspuns parțial: ${valid.length} puncte verificate, ${missing.length} lipsesc sau au fost eliminate.${subject}`, ru: `Частичный ответ: ${valid.length} проверенных пунктов, ${missing.length} отсутствуют или удалены.${subjectRu}` },
      validation: { checked: report.checked + start.validation.checked, passed: report.passed + start.validation.passed, dropped: [...report.dropped, ...start.validation.dropped] },
      engine: { ...start.engine, mode: "llm", model: AI.model, label: MODEL_LABEL() },
    };
  } catch (e) {
    const code = e instanceof ModelError ? e.code : "upstream";
    console.warn(`[answer] model fallback: ${code}`);
    return curated ? withFallback(base, code) : null;
  }
}

/**
 * "Cât costă și în cât timp se încheie contractul de apă?" splits into two needs, but both are
 * about the one curated topic: the curated answer covers them aspect by aspect and names the
 * gaps. A need naming another subject ("…și cine e primarul?") must not be silently dropped,
 * so every part has to point at the same topic, or be a bare aspect fragment ("Cât costă").
 */
function sameSubject(needs: string[], topicId: string | null): boolean {
  if (!topicId) return false;
  return needs.every((need) => {
    const aspects = detectAspects(need);
    const top = rankTopics(need, aspects).filter((hit) => hit.topic.kind !== "demo" && hit.specific > 0)[0];
    if (top) return top.topic.id === topicId;
    return aspects.length > 0 && tokens(need).length <= 3;
  });
}

function withFallback(base: Answer, code: string): Answer {
  return { ...base, engine: { ...base.engine, mode: "llm-fallback", model: AI.model, label: fallbackLabel(code) } };
}

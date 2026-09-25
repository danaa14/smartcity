import { FACTS, FACT_BY_ID } from "../corpus/facts";
import { PASSAGE_BY_ID } from "../corpus/passages";
import { DOC_BY_ID } from "../corpus/docs";
import type { Aspect, Fact, L10n, Lang, Passage, SourceDoc } from "../corpus/types";
import { detectAspects, keywordFactMatch, outOfCorpusHint, rankTopics } from "../retrieval";
import { detectLang } from "../text";
import { validateClaims } from "./validate";
import { detectConflicts } from "./conflicts";
import type { Answer, AnswerStatus, Claim } from "./types";

const MIN_TOPIC_SCORE = 1;

const ASPECT_LABEL: Record<Aspect, L10n> = {
  procedure: { ro: "procedura", ru: "порядок" },
  documents: { ro: "actele necesare", ru: "необходимые документы" },
  cost: { ro: "costul", ru: "стоимость" },
  time: { ro: "termenul", ru: "срок" },
  contact: { ro: "contactul", ru: "контакты" },
  obligation: { ro: "obligațiile", ru: "обязанности" },
  validity: { ro: "valabilitatea", ru: "действительность" },
  channel: { ro: "canalul de depunere", ru: "канал подачи" },
};

function factToClaim(f: Fact): Claim {
  return {
    id: f.id,
    text: f.text,
    citations: f.cites.map((c) => ({ n: 0, passageId: c.passageId, quote: c.quote })),
    uncertainty: f.uncertainty,
    aspect: f.aspects,
    demo: f.topic.startsWith("demo-"),
  };
}

/**
 * Deterministic demo engine: retrieve topic → select facts relevant to the requested aspects →
 * validate every claim against its passages → detect conflicts and gaps → build the route.
 * An LLM drafter can replace `draft` later; validation and gap/conflict detection stay the same.
 */
export function answerQuestion(question: string, uiLang?: Lang): Answer {
  const q = question.trim().slice(0, 500);
  const questionLang = uiLang ?? detectLang(q);
  const aspects = detectAspects(q);
  const ranked = rankTopics(q, aspects);
  const top = ranked[0] && ranked[0].score >= MIN_TOPIC_SCORE ? ranked[0] : null;

  const base = {
    question: q,
    questionLang,
    requestedAspects: aspects,
    generatedAt: new Date().toISOString(),
    engine: {
      mode: "deterministic-demo" as const,
      label: {
        ro: "Mod demonstrativ determinist: răspunsul este asamblat din afirmații pre-extrase și verificate, nu generat de un model AI.",
        ru: "Детерминированный демо-режим: ответ собирается из заранее извлечённых и проверенных утверждений, а не генерируется ИИ-моделью.",
      },
      retrieval: { topicScore: top?.score ?? 0, candidates: ranked.slice(0, 3).map((h) => ({ topicId: h.topic.id, score: h.score })) },
    },
  };

  if (!top) return missingAnswer(q, base);

  const topic = top.topic;
  const topicFacts = FACTS.filter((f) => f.topic === topic.id);

  // Draft: pick direct-answer facts for the aspects asked about; default to the core facts.
  const wanted = aspects.filter((a) => a !== "contact" || aspects.length === 1);
  let direct = topicFacts.filter(
    (f) => !topic.contactFactIds.includes(f.id) && (keywordFactMatch(q, f.keywords) || f.aspects.some((a) => wanted.includes(a))),
  );
  if (!direct.length) direct = topicFacts.filter((f) => f.core);
  if (aspects.includes("contact")) direct = [...direct, ...topicFacts.filter((f) => topic.contactFactIds.includes(f.id))];
  direct = dedupe(direct).slice(0, 7);

  const stepFactIds = topic.steps.flatMap((s) => s.factIds);
  const allIds = dedupe([...direct.map((f) => f.id), ...stepFactIds, ...topic.contactFactIds, ...(topic.servicePage ? [topic.servicePage.factId] : [])]);
  const drafted = allIds.map((id) => FACT_BY_ID.get(id)).filter(Boolean).map((f) => factToClaim(f!));

  // Validate every claim before it can be shown.
  const { valid, report } = validateClaims(drafted);
  const validIds = new Set(valid.map((c) => c.id));
  const byId = Object.fromEntries(valid.map((c) => [c.id, c]));

  // Number citations by first appearance, across direct claims, then steps, then contacts.
  const order: string[] = [];
  const claimOrder = [...direct.map((f) => f.id), ...stepFactIds, ...topic.contactFactIds].filter((id) => validIds.has(id));
  for (const id of claimOrder) for (const c of byId[id].citations) if (!order.includes(c.passageId)) order.push(c.passageId);
  for (const c of valid) for (const cit of c.citations) cit.n = order.indexOf(cit.passageId) + 1;

  const claims = direct.filter((f) => validIds.has(f.id)).map((f) => byId[f.id]);
  const steps = topic.steps
    .map((s) => ({ text: s.text, claimIds: s.factIds.filter((id) => validIds.has(id)) }))
    .filter((s) => s.claimIds.length > 0);
  const contacts = topic.contactFactIds.filter((id) => validIds.has(id) && !claims.some((c) => c.id === id)).map((id) => byId[id]);

  const conflicts = detectConflicts(valid);

  // Missing coverage: aspects the user asked about with no supporting claim, plus dropped claims.
  const covered = new Set(claims.flatMap((c) => c.aspect));
  const missing: L10n[] = [];
  for (const a of aspects) {
    if (a === "contact" && contacts.length) continue;
    if (a === "procedure" && steps.length) continue;
    // Topic gaps name a specific sub-question the corpus cannot answer, so they surface even if
    // another claim touches the same aspect (e.g. a citizen deadline is not a processing time).
    if (topic.gaps[a]) missing.push(topic.gaps[a]!);
    else if (!covered.has(a) && a !== "contact")
      missing.push({
        ro: `Corpusul nu conține informații despre ${ASPECT_LABEL[a].ro} pentru acest subiect.`,
        ru: `В корпусе нет сведений о «${ASPECT_LABEL[a].ru}» по этой теме.`,
      });
  }
  if (report.dropped.length)
    missing.push({
      ro: `${report.dropped.length} afirmație(i) au fost eliminate deoarece citarea nu a putut fi verificată.`,
      ru: `${report.dropped.length} утверждение(й) удалено, так как цитату не удалось проверить.`,
    });

  const status: AnswerStatus = conflicts.length ? "contradiction" : claims.length === 0 ? "missing" : missing.length ? "partial" : "supported";

  const usedPassages = new Set(valid.flatMap((c) => c.citations.map((x) => x.passageId)));
  const passages: Record<string, Passage> = {};
  const docs: Record<string, SourceDoc> = {};
  for (const pid of usedPassages) {
    const p = PASSAGE_BY_ID.get(pid)!;
    passages[pid] = p;
    docs[p.docId] = DOC_BY_ID.get(p.docId)!;
  }

  const sp = topic.servicePage && validIds.has(topic.servicePage.factId)
    ? { url: topic.servicePage.url, label: topic.servicePage.label, claimId: topic.servicePage.factId }
    : undefined;

  return {
    ...base,
    status,
    topicId: topic.id,
    topicTitle: topic.title,
    demoCorpus: topic.kind === "demo",
    summary: summarize(status, topic.title, claims.length, missing.length, conflicts.length),
    claims,
    claimIndex: byId,
    sources: order.map((passageId, i) => ({ n: i + 1, passageId })),
    steps,
    missing,
    conflicts,
    contacts,
    servicePage: sp,
    passages,
    docs,
    validation: report,
  };
}

function missingAnswer(q: string, base: Omit<Answer, "status" | "topicId" | "topicTitle" | "demoCorpus" | "summary" | "claims" | "claimIndex" | "sources" | "steps" | "missing" | "conflicts" | "contacts" | "passages" | "docs" | "validation">): Answer {
  const hint = outOfCorpusHint(q);
  const contactIds = hint?.contactFactIds ?? ["p-ghiseu"];
  const drafted = contactIds.map((id) => factToClaim(FACT_BY_ID.get(id)!));
  const { valid, report } = validateClaims(drafted);
  valid.forEach((c, i) => c.citations.forEach((cit) => (cit.n = i + 1)));
  const passages: Record<string, Passage> = {};
  const docs: Record<string, SourceDoc> = {};
  for (const c of valid)
    for (const cit of c.citations) {
      const p = PASSAGE_BY_ID.get(cit.passageId)!;
      passages[p.id] = p;
      docs[p.docId] = DOC_BY_ID.get(p.docId)!;
    }
  return {
    ...base,
    status: "missing",
    topicId: null,
    topicTitle: null,
    demoCorpus: false,
    summary: {
      ro: "Nu am găsit în corpus niciun pasaj care să răspundă la această întrebare. Nu vom ghici. Mai jos găsiți un contact oficial verificat.",
      ru: "В корпусе не найдено ни одного фрагмента, отвечающего на этот вопрос. Мы не будем гадать. Ниже — проверенный официальный контакт.",
    },
    claims: [],
    claimIndex: Object.fromEntries(valid.map((c) => [c.id, c])),
    sources: valid.flatMap((c) => c.citations.map((cit) => ({ n: cit.n, passageId: cit.passageId }))),
    steps: [],
    missing: [
      {
        ro: "Subiectul întrebării nu este acoperit de sursele indexate (vezi pagina „Despre / acoperire”).",
        ru: "Тема вопроса не охвачена проиндексированными источниками (см. страницу «О проекте / охват»).",
      },
    ],
    conflicts: [],
    contacts: valid,
    passages,
    docs,
    validation: report,
  };
}

function summarize(status: AnswerStatus, title: L10n, nClaims: number, nMissing: number, nConflicts: number): L10n {
  switch (status) {
    case "supported":
      return {
        ro: `Răspuns susținut de surse: ${nClaims} afirmații, fiecare cu citat exact. Subiect: ${title.ro}.`,
        ru: `Ответ подтверждён источниками: ${nClaims} утверждений, у каждого — точная цитата. Тема: ${title.ru}.`,
      };
    case "partial":
      return {
        ro: `Răspuns parțial: ${nClaims} puncte sunt susținute de surse, ${nMissing} lipsesc din corpus. Subiect: ${title.ro}.`,
        ru: `Частичный ответ: ${nClaims} пунктов подтверждены источниками, ${nMissing} отсутствуют в корпусе. Тема: ${title.ru}.`,
      };
    case "contradiction":
      return {
        ro: `Atenție: ${nConflicts} posibilă contradicție între surse. Nu alegem noi care sursă are prioritate — cereți confirmare oficială.`,
        ru: `Внимание: ${nConflicts} возможное противоречие между источниками. Мы не решаем, какой источник приоритетнее, — запросите официальное подтверждение.`,
      };
    default:
      return { ro: "Nu am găsit informații susținute în corpus.", ru: "В корпусе нет подтверждённых сведений." };
  }
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

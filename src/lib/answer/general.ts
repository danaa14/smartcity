import "server-only";
import { complete, completeStream } from "../ai/client";
import { AI } from "../ai/config";
import type { L10n, Lang } from "../corpus/types";
import type { WebResult } from "../web/search";
import type { Answer } from "./types";

/**
 * The corpus covers a few dozen municipal pages. Everything else a resident asks about —
 * the Contravention Code, a fine, an inheritance, a building permit, or just "salut" — is
 * answered here from the model's own knowledge and labelled as unverified. Cited corpus
 * answers keep their verbatim guarantee; this path never claims a source.
 */
const PERSONA: Record<Lang, string> = {
  ro: [
    "Ești „Chișinău, pe fir”, asistentul digital al locuitorilor municipiului Chișinău.",
    "",
    "DOMENIUL TĂU (răspunzi pe larg, nu refuzi): legislația Republicii Moldova, primăria și serviciile municipale, administrația publică centrală și locală, actele și procedurile administrative, taxele și impozitele, contravențiile și amenzile, drepturile și obligațiile cetățeanului, locuirea și utilitățile, transportul, educația, sănătatea publică, asistența socială.",
    "",
    "CUM RĂSPUNZI:",
    "- Răspunde direct și practic. Spune ce are de făcut omul: pașii, actele necesare, termenul și instituția responsabilă.",
    "- Ești un ghid care explică regulile, nu un avocat care reprezintă pe cineva. O întrebare juridică NU se refuză: explic-o clar, apoi spune ce depinde de cazul concret și unde se confirmă.",
    "- Nu inventa niciodată numere de articole, sume, taxe sau termene. Dacă nu le știi exact, spune deschis că cifra trebuie confirmată la instituție și explică restul.",
    "- Dacă regula s-a putut schimba recent, spune-o într-o propoziție scurtă.",
    "- Nu pretinde că citezi o sursă: fără „[1]”, fără „conform sursei”, fără linkuri inventate.",
    "- Conversație obișnuită (salut, mulțumesc, cine ești, o adunare simplă): răspunde natural, scurt și prietenos, fără disclaimere.",
    "",
    "CE REFUZI (scurt, politicos, cu o alternativă utilă): scrierea de cod sau teme/eseuri, texte de marketing, diagnostic ori tratament medical individual (dar poți explica cum se ajunge la medic sau la serviciul de urgență), și orice ar ajuta pe cineva să eludeze legea.",
    "",
    "FORMAT: text simplu, fără titluri markdown și fără „Răspuns:”. Sub 200 de cuvinte, dacă o listă de pași nu e mai clară. Răspunde ÎNTOTDEAUNA în limba utilizatorului.",
  ].join("\n"),
  ru: [
    "Ты — «Кишинэу, на связи», цифровой помощник жителей муниципия Кишинэу.",
    "",
    "ТВОЯ ОБЛАСТЬ (отвечаешь по существу, не отказываешь): законодательство Республики Молдова, примэрия и муниципальные услуги, центральная и местная публичная администрация, документы и административные процедуры, налоги и сборы, правонарушения и штрафы, права и обязанности гражданина, жильё и коммунальные услуги, транспорт, образование, общественное здравоохранение, социальная помощь.",
    "",
    "КАК ОТВЕЧАТЬ:",
    "- Отвечай прямо и практично. Скажи, что человеку делать: шаги, нужные документы, срок и ответственное учреждение.",
    "- Ты проводник, объясняющий правила, а не адвокат, представляющий кого-то. Юридический вопрос НЕ отклоняется: объясни его ясно, затем скажи, что зависит от конкретного случая и где это подтвердить.",
    "- Никогда не выдумывай номера статей, суммы, сборы или сроки. Если не знаешь точно — прямо скажи, что цифру нужно подтвердить в учреждении, и объясни остальное.",
    "- Если правило могло недавно измениться, скажи это одним предложением.",
    "- Не делай вид, что цитируешь источник: без «[1]», без «согласно источнику», без выдуманных ссылок.",
    "- Обычный разговор (привет, спасибо, кто ты, простой пример на сложение): отвечай естественно, коротко и дружелюбно, без оговорок.",
    "",
    "В ЧЁМ ОТКАЗЫВАЕШЬ (коротко, вежливо, с полезной альтернативой): написание кода, сочинений и домашних заданий, маркетинговых текстов, индивидуальная медицинская диагностика или лечение (но можешь объяснить, как попасть к врачу или вызвать скорую), и всё, что помогает обойти закон.",
    "",
    "ФОРМАТ: простой текст, без markdown-заголовков и без «Ответ:». Менее 200 слов, если список шагов не яснее. Всегда отвечай на языке пользователя.",
  ].join("\n"),
};

const LABEL: L10n = {
  ro: "Răspuns formulat de modelul AI din cunoștințe generale, NU dintr-o sursă indexată. Nu are citat verificabil — confirmați cifrele și termenele la instituția responsabilă înainte de a acționa.",
  ru: "Ответ сформулирован ИИ-моделью из общих знаний, а НЕ из индексированного источника. Проверяемой цитаты нет — подтвердите суммы и сроки в ответственном учреждении, прежде чем действовать.",
};

const SUMMARY: L10n = {
  ro: "Răspuns general, fără sursă indexată.",
  ru: "Общий ответ, без индексированного источника.",
};

/** A document the user reviewed and redacted in their browser, carried for follow-up questions. */
export interface DocContext {
  name: string;
  text: string;
}

const DOC_RULE: Record<Lang, string> = {
  ro: "Utilizatorul a atașat documentul de mai jos. Datele personale au fost deja înlocuite cu etichete ca [NUME_1] — tratează-le ca valori completate și nu cere datele reale. Când răspunzi despre document, citează scurt fragmentul relevant din el; nu inventa clauze care nu apar în text. Dacă întrebarea nu se referă la document, ignoră-l.",
  ru: "Пользователь приложил документ ниже. Личные данные уже заменены метками вроде [NUME_1] — считай их заполненными значениями и не запрашивай настоящие. Отвечая о документе, коротко цитируй нужный фрагмент из него; не выдумывай пункты, которых нет в тексте. Если вопрос не о документе, игнорируй его.",
};

const DOC_MAX = 12000;

function prompt(question: string, history: string, lang: Lang, doc?: DocContext): string {
  const parts: string[] = [];
  if (doc?.text.trim()) parts.push(`${DOC_RULE[lang]}\n\n--- ${doc.name} ---\n${doc.text.slice(0, DOC_MAX)}\n--- sfârșit / конец ---`);
  if (history) parts.push(history);
  parts.push(`User: ${question}`);
  return parts.join("\n\n");
}

/** The answer renders as plain text, so leftover markdown emphasis would show as literal asterisks. */
function stripMarkdown(s: string): string {
  return s
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/__([\s\S]+?)__/g, "$1")
    .replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|[.,;:!?)]|$)/g, "$1$2")
    .replace(/^\s*[*+]\s+/gm, "— ")
    .replace(/^\s*-\s+/gm, "— ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Reasoning tokens come out of this budget before any visible text does — a 200-word reply can
 * sit behind 1500+ tokens of thinking. Sized for the worst case; unused budget is not billed.
 */
const BUDGET = 8000;

/** Streams the conversational/general answer token by token. */
export function streamGeneral(question: string, lang: Lang, history = "", signal?: AbortSignal, doc?: DocContext) {
  return completeStream(PERSONA[lang], prompt(question, history, lang, doc), sessionOf(question), { maxTokens: BUDGET, signal });
}

/** Non-streaming variant, for the JSON API and the phone demo. */
export function askGeneral(question: string, lang: Lang, history = "", signal?: AbortSignal, doc?: DocContext): Promise<string> {
  return complete(PERSONA[lang], prompt(question, history, lang, doc), sessionOf(question), { maxTokens: BUDGET, signal });
}

function sessionOf(question: string): string {
  return "pefir-general-" + Math.abs([...question].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36);
}

/** Wraps generated prose in the Answer envelope the UI already understands. */
export function proseAnswer(question: string, lang: Lang, text: string, web?: WebResult[]): Answer {
  const prose = stripMarkdown(text);
  return {
    question,
    questionLang: lang,
    kind: "prose",
    prose,
    unverified: !isSmallTalk(question) && !isRefusal(prose),
    status: "missing",
    topicId: null,
    topicTitle: null,
    demoCorpus: false,
    summary: SUMMARY,
    claims: [],
    claimIndex: {},
    sources: [],
    steps: [],
    missing: [],
    conflicts: [],
    contacts: [],
    requestedAspects: [],
    passages: {},
    docs: {},
    validation: { checked: 0, passed: 0, dropped: [] },
    engine: { mode: "general", model: AI.model, label: LABEL, retrieval: { topicScore: 0, candidates: [] } },
    generatedAt: new Date().toISOString(),
    web: web?.length && !isRefusal(prose) ? web : undefined,
  };
}

/**
 * Short social turns ("salut", "mersi") should not drag in official web links or a
 * verify-before-acting warning — they are not factual claims.
 */
export function isSmallTalk(question: string): boolean {
  const q = question.trim();
  return q.length <= 24 && q.split(/\s+/).length <= 3 && !/\d/.test(q);
}

// Allows the pronoun forms the model actually uses: "Nu pot", "Nu te pot", "Nu vă pot ajuta".
// `\b` is ASCII-only in JS, so the Cyrillic branch needs an explicit letter guard instead.
const REFUSAL = /^(nu(\s+\S+){0,2}\s+pot\b|nu scriu|nu generez|nu ofer|nu sunt (construit|specializat)|îmi pare rău|imi pare rau|regret|(я\s+)?не(\s+\S+){0,2}\s+могу(?![а-яё])|не пишу|не генерирую|я не (создан|специализирован)|извините|к сожалению)/i;

/**
 * "I can't write code" asserts nothing to verify, so the warning badge would be noise.
 * Deliberately narrow — it must open the first sentence, stay short and cite no figures —
 * because wrongly hiding the badge on a real answer is the costly mistake.
 */
function isRefusal(text: string): boolean {
  const t = text.trim();
  return t.length < 600 && !/\d/.test(t) && REFUSAL.test(t);
}

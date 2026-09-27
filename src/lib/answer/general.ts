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
import { ASSISTANT_GUIDELINES } from "./guidelines";
import { humanize } from "./tone";

const PERSONA: Record<Lang, string> = {
  ro: [
    "Ești „Chișinău, pe fir”, asistentul de suport al locuitorilor din municipiul Chișinău. Vorbești ca un om de la relații cu publicul care chiar vrea să ajute: cald, clar, fără limbaj de lemn.",
    "",
    "CU CE AJUȚI (răspunzi pe larg, nu refuzi): legislația Republicii Moldova, primăria și serviciile municipale, administrația publică centrală și locală, actele și procedurile administrative, taxele și impozitele, contravențiile și amenzile, drepturile și obligațiile cetățeanului, locuirea și utilitățile, transportul, educația, sănătatea publică, asistența socială.",
    "",
    "CUM VORBEȘTI:",
    "- Ca într-o conversație, nu ca într-un raport. Te adresezi cu „dumneavoastră”, dar pe un ton prietenos și firesc.",
    "- Intră direct în subiect și pornește de la situația omului: „Pentru situația dumneavoastră, aveți nevoie de…”, „Iată ce aveți de făcut:”, „Pe scurt: …”. Dacă sunt mai mulți pași, numerotează-i scurt.",
    "- Nu spune de unde vine informația: fără „Conform Anexei…”, „Potrivit sursei…”, „Documentul prevede…”, fără „[1]” și fără linkuri inventate. Spune lucrurile direct, ca cineva care le știe. (Excepție: documentul atașat de om — din el poți cita.)",
    "- Fără formule birocratice sau robotice: „Vă informăm că”, „În conformitate cu”, „Ca asistent AI…”, „Sper că aceste informații vă sunt utile”. Nu repeta întrebarea înapoi.",
    "- Când situația e neplăcută, arată scurt că înțelegi („Înțeleg, e neplăcut.”), fără exagerări.",
    "- Dacă îți lipsește un detaliu care schimbă răspunsul, pune o singură întrebare scurtă.",
    "- Încheie, când are sens, cu pasul următor sau o ofertă de ajutor firească („Dacă vreți, vă spun și ce acte vă trebuie.”), nu cu formule standard.",
    "",
    "CE NU INVENTEZI:",
    "- Ești un ghid care explică regulile, nu un avocat care reprezintă pe cineva. O întrebare juridică NU se refuză: explic-o clar, apoi spune ce depinde de cazul concret și unde se confirmă.",
    "- Nu inventa niciodată numere de articole, sume, taxe sau termene. Dacă nu știi cifra exactă, spune-o firesc („Suma exactă v-o confirmă la ghișeu.”) și explică restul.",
    "- Dacă regula s-a putut schimba recent, spune-o într-o propoziție scurtă.",
    "- Conversație obișnuită (salut, mulțumesc, cine ești, o adunare simplă): răspunde natural, scurt și prietenos. La un salut, salută înapoi și întreabă cu ce problemă concretă poți ajuta; nu enumera ce știi să faci și nu vorbi despre surse, anexe sau despre cum funcționezi. Dacă ești întrebat, spune sincer că ești un asistent virtual.",
    "",
    "CE REFUZI (scurt, prietenos, fără morală, cu o alternativă utilă): scrierea de cod sau teme/eseuri, texte de marketing, diagnostic ori tratament medical individual (dar poți explica cum se ajunge la medic sau la serviciul de urgență), și orice ar ajuta pe cineva să eludeze legea.",
    "",
    "FORMAT: text simplu, fără titluri markdown și fără „Răspuns:”. Sub 200 de cuvinte, dacă o listă de pași nu e mai clară. Răspunde ÎNTOTDEAUNA în limba română — este limba aleasă pe platformă —, chiar dacă omul scrie în altă limbă sau mesajele anterioare sunt în altă limbă.",
  ].join("\n"),
  ru: [
    "Ты — «Кишинэу, на связи», помощник службы поддержки жителей муниципия Кишинэу. Говоришь как сотрудник, который искренне хочет помочь: тепло, понятно, без канцелярита.",
    "",
    "С ЧЕМ ПОМОГАЕШЬ (отвечаешь по существу, не отказываешь): законодательство Республики Молдова, примэрия и муниципальные услуги, центральная и местная публичная администрация, документы и административные процедуры, налоги и сборы, правонарушения и штрафы, права и обязанности гражданина, жильё и коммунальные услуги, транспорт, образование, общественное здравоохранение, социальная помощь.",
    "",
    "КАК ГОВОРИШЬ:",
    "- Как в живом разговоре, а не как в отчёте. Обращаешься на «вы», но дружелюбно и просто.",
    "- Сразу переходи к делу и отталкивайся от ситуации человека: «В вашем случае понадобится…», «Вот что нужно сделать:», «Коротко: …». Если шагов несколько, коротко пронумеруй их.",
    "- Не говори, откуда информация: без «Согласно приложению…», «Согласно источнику…», «В документе указано…», без «[1]» и без выдуманных ссылок. Говори прямо, как человек, который это знает. (Исключение: документ, который приложил человек, — из него можно цитировать.)",
    "- Без канцелярских и роботизированных оборотов: «Информируем вас, что», «В соответствии с», «Как ИИ-ассистент…», «Надеюсь, эта информация была полезной». Не пересказывай вопрос.",
    "- Если ситуация неприятная, коротко покажи, что понимаешь («Понимаю, это неприятно.»), без перебора.",
    "- Если не хватает детали, от которой зависит ответ, задай один короткий вопрос.",
    "- Не используй о себе глаголы прошедшего времени с родом («нашёл/нашла») — говори «сейчас подскажу», «вот что нужно».",
    "- Когда уместно, заканчивай следующим шагом или естественным предложением помощи («Если хотите, подскажу, какие документы понадобятся.»), а не шаблонной фразой.",
    "",
    "ЧЕГО НЕ ВЫДУМЫВАЕШЬ:",
    "- Ты проводник, объясняющий правила, а не адвокат, представляющий кого-то. Юридический вопрос НЕ отклоняется: объясни его ясно, затем скажи, что зависит от конкретного случая и где это подтвердить.",
    "- Никогда не выдумывай номера статей, суммы, сборы или сроки. Если не знаешь точную цифру, скажи это естественно («Точную сумму подтвердят в окошке.») и объясни остальное.",
    "- Если правило могло недавно измениться, скажи это одним предложением.",
    "- Обычный разговор (привет, спасибо, кто ты, простой пример на сложение): отвечай естественно, коротко и дружелюбно. На приветствие поздоровайся и спроси, с какой конкретной проблемой помочь; не перечисляй, что умеешь, и не рассказывай об источниках, приложениях или о том, как ты работаешь. Если спросят, честно скажи, что ты виртуальный помощник.",
    "",
    "В ЧЁМ ОТКАЗЫВАЕШЬ (коротко, дружелюбно, без нравоучений, с полезной альтернативой): написание кода, сочинений и домашних заданий, маркетинговых текстов, индивидуальная медицинская диагностика или лечение (но можешь объяснить, как попасть к врачу или вызвать скорую), и всё, что помогает обойти закон.",
    "",
    "ФОРМАТ: простой текст, без markdown-заголовков и без «Ответ:». Менее 200 слов, если список шагов не яснее. Всегда отвечай на русском — это язык, выбранный на платформе, — даже если человек пишет на другом языке или предыдущие сообщения были на другом языке.",
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

const REPLY_IN: Record<Lang, string> = {
  ro: "(Răspunde în limba română.)",
  ru: "(Ответь на русском языке.)",
};

function prompt(question: string, history: string, lang: Lang, doc?: DocContext): string {
  const parts: string[] = [];
  if (doc?.text.trim()) parts.push(`${DOC_RULE[lang]}\n\n--- ${doc.name} ---\n${doc.text.slice(0, DOC_MAX)}\n--- sfârșit / конец ---`);
  if (history) parts.push(history);
  parts.push(`User: ${question}`);
  // The history may still be in the previous language after a switch; the reminder sits last so it wins.
  parts.push(REPLY_IN[lang]);
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
  return completeStream(PERSONA[lang] + "\n" + ASSISTANT_GUIDELINES, prompt(question, history, lang, doc), sessionOf(question), { maxTokens: BUDGET, signal });
}

/** Non-streaming variant, for the JSON API and the phone demo. */
export function askGeneral(question: string, lang: Lang, history = "", signal?: AbortSignal, doc?: DocContext): Promise<string> {
  return complete(PERSONA[lang] + "\n" + ASSISTANT_GUIDELINES, prompt(question, history, lang, doc), sessionOf(question), { maxTokens: BUDGET, signal });
}

function sessionOf(question: string): string {
  return "pefir-general-" + Math.abs([...question].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36);
}

/** Wraps generated prose in the Answer envelope the UI already understands. */
export function proseAnswer(question: string, lang: Lang, text: string, web?: WebResult[]): Answer {
  const draft = humanize(stripMarkdown(text));
  // An uncited numbered procedure is easy to mistake for verified instructions.
  // Concrete routes use the cited action-guide path; otherwise show the gap plainly.
  const unlinkedProcedure = /(?:^|\n)\s*1[.)]\s/u.test(draft) && /(?:^|\n)\s*2[.)]\s/u.test(draft);
  const prose = unlinkedProcedure
    ? lang === "ru"
      ? "Точный порядок действий по этой процедуре я не могу подтвердить официальным источником. Шаги и нужные документы лучше проверить на странице ответственного учреждения ниже."
      : "Pașii exacți pentru această procedură nu îi am confirmați dintr-o sursă oficială. Ordinea și actele necesare le găsiți pe pagina instituției responsabile, mai jos."
    : draft;
  return {
    question,
    questionLang: lang,
    kind: "prose",
    prose,
    // A refusal or apology may still contain factual advice. Only an exact
    // social exchange is exempt from the unverified label.
    unverified: !(isSmallTalk(question) && isSmallTalk(prose)),
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
  const q = question.toLowerCase().trim().replace(/[!?.,]+$/g, "");
  return /^(salut|bună|buna|bună ziua|buna ziua|bună seara|buna seara|hei|hello|hi|mersi|mulțumesc|multumesc|merci|pa|привет|здравствуйте|спасибо|добрый день|пока)$/.test(q);
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

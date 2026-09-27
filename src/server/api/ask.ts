import { NextResponse } from "next/server";
import { answerWithModel } from "@/lib/answer/withModel";
import { fastContactAnswer } from "@/lib/answer/fastContacts";
import { actionGuide } from "@/lib/answer/actionGuides";
import { withActionPlan } from "@/lib/answer/actionPlan";
import { answerQuestion } from "@/lib/answer/pipeline";
import { askGeneral, proseAnswer, streamGeneral, type DocContext } from "@/lib/answer/general";
import { withWebFallback, officialFallbackLinks } from "@/lib/web/search";
import { retrieve } from "@/lib/retrieval";
import { logReview } from "@/lib/feedback";
import { logAsk } from "@/lib/staff/events";
import { AI } from "@/lib/ai/config";
import type { Lang } from "@/lib/corpus/types";
import type { Answer } from "@/lib/answer/types";
import { contextualQuestion, refersToDocument, sanitizeHistory } from "@/lib/chat/context";
import { detectRules } from "@/lib/scan/pii";
import { detectLang } from "@/lib/text";

export const runtime = "nodejs";

interface Turn {
  role: "user" | "assistant";
  content: string;
}

const MAX_QUESTION = 500;
const MAX_DOC = 40_000;
const RATE_LIMIT = 30;

/**
 * Same safety net as /api/scan/review: the browser is supposed to have redacted the document
 * already, so a structured identifier arriving here means the client gate was bypassed.
 */
const LEAKS: RegExp[] = [
  /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/u,
  /\bMD\d{2}\s?(?:[A-Z0-9]{2,4}\s?){4,6}/,
  /\b[0-2]\d{12}\b/,
  /\b(?:\d{4}[\s-]?){3}\d{4}\b/,
];

function documentOf(raw: unknown): DocContext | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const { name, text } = raw as { name?: unknown; text?: unknown };
  if (typeof text !== "string" || !text.trim()) return undefined;
  const body = text.slice(0, MAX_DOC);
  if (LEAKS.some((re) => re.test(body))) {
    console.warn("[ask] document dropped: unredacted identifier");
    return undefined;
  }
  return { name: typeof name === "string" ? name.slice(0, 120) : "document", text: body };
}
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(k);
  return recent.length > RATE_LIMIT;
}

/** Prior turns only (the current question is sent separately), so follow-ups keep their subject. */
function historyOf(turns: Turn[]): string {
  return turns
    .slice(-6)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 400)}`)
    .join("\n");
}

const PHASES: Record<Lang, { search: string; verify: string; think: string; document: string }> = {
  ro: { search: "Caut în sursele indexate…", verify: "Verific citările…", think: "Formulez răspunsul…", document: "Recitesc documentul tău…" },
  ru: { search: "Ищу в индексированных источниках…", verify: "Проверяю цитаты…", think: "Формулирую ответ…", document: "Перечитываю ваш документ…" },
};

function offline(lang: Lang): string {
  return lang === "ru"
    ? "Модель сейчас не отвечает. Попробуйте ещё раз через несколько секунд."
    : "Modelul nu răspunde chiar acum. Încercați din nou peste câteva secunde.";
}

export async function POST(req: Request) {
  // Checked first: a flood of malformed requests should be cut off just as early as valid ones.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (rateLimited(ip)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = (await req.json().catch(() => null)) as { question?: unknown; lang?: unknown; history?: unknown; document?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) return NextResponse.json({ error: "empty_question" }, { status: 400 });
  if (question.length > MAX_QUESTION) return NextResponse.json({ error: "too_long" }, { status: 400 });

  const uiLang: Lang = body?.lang === "ru" ? "ru" : "ro";
  const hasCyrillic = /[\u0400-\u04FF]/.test(question);
  const lang: Lang = hasCyrillic ? detectLang(question) : uiLang;
  const turns = sanitizeHistory(body?.history);
  if (detectRules(question).length || turns.some((turn) => detectRules(turn.content).length)) {
    return NextResponse.json({ error: "pii_leak" }, { status: 422 });
  }
  const history = historyOf(turns);
  const query = contextualQuestion(question, turns, lang);
  const doc = documentOf(body?.document);
  const wantsStream = (req.headers.get("accept") ?? "").includes("text/event-stream");

  const execution = { signal: AbortSignal.any([req.signal, AbortSignal.timeout(45_000)]) };
  return wantsStream ? streamed(execution, question, lang, history, doc, query) : json(execution, question, lang, history, doc, query);
}

/**
 * A cited corpus answer when the corpus reaches the question, otherwise labelled prose.
 * An active personal document uses the document-aware path so a coincidental corpus
 * keyword cannot replace analysis of the actual uploaded clauses.
 */
async function resolve(req: Pick<Request, "signal">, question: string, lang: Lang, history: string, doc?: DocContext, query = question): Promise<Answer> {
  if (!doc || !refersToDocument(question)) {
    const guide = actionGuide(query, lang);
    if (guide) return { ...guide, question };
    const direct = fastContactAnswer(query, lang);
    if (direct) return { ...direct, question };
  }
  const grounded = !(doc && refersToDocument(question)) && retrieve(query).grounded;
  if (grounded) {
    const corpus = await answerWithModel(query, lang, req.signal);
    if (corpus) return withWebFallback({ ...corpus, question }, query);
    // A plausible passage match is not permission to replace missing evidence with
    // an uncited model answer. Return the explicit gap and official next action.
    return withWebFallback(answerQuestion(question, lang, { includeDemo: false, forceMissing: true }), query);
  }
  if (!AI.enabled) return withWebFallback(answerQuestion(question, lang, { includeDemo: false, forceMissing: true }), query);
  const text = await askGeneral(question, lang, history, req.signal, doc);
  return proseAnswer(question, lang, text, officialFallbackLinks(query));
}

async function json(req: Pick<Request, "signal">, question: string, lang: Lang, history: string, doc?: DocContext, query = question) {
  try {
    const answer = withActionPlan(await resolve(req, question, lang, history, doc, query));
    await record(answer, question, lang);
    return NextResponse.json(answer);
  } catch (e) {
    console.error(`[ask] failed: ${e instanceof Error ? e.message.slice(0, 160) : String(e)}`);
    return NextResponse.json({ error: "upstream", message: offline(lang) }, { status: 502 });
  }
}

function streamed(req: Pick<Request, "signal">, question: string, lang: Lang, history: string, doc?: DocContext, query = question) {
  const enc = new TextEncoder();
  const phases = PHASES[lang];
  const t0 = Date.now();
  let open = true;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: object) => {
        if (!open) return;
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`)); }
        catch { open = false; }
      };
      const close = () => {
        if (open) controller.close();
        open = false;
      };

      try {
        if (!doc || !refersToDocument(question)) {
          const guide = actionGuide(query, lang);
          if (guide) {
            const answer = withActionPlan({ ...guide, question });
            send({ type: "answer", answer });
            await record(answer, question, lang);
            return close();
          }
          const direct = fastContactAnswer(query, lang);
          if (direct) {
            const answer = withActionPlan({ ...direct, question });
            send({ type: "answer", answer });
            await record(answer, question, lang);
            return close();
          }
        }
        const grounded = !(doc && refersToDocument(question)) && retrieve(query).grounded;
        if (grounded) {
          send({ type: "phase", label: phases.search });
          const ticker = setInterval(() => send({ type: "phase", label: phases.verify }), 6000);
          let corpus: Answer | null;
          try {
            corpus = await answerWithModel(query, lang, req.signal);
          } finally {
            clearInterval(ticker);
          }
          if (corpus) {
            const answer = withActionPlan(await withWebFallback({ ...corpus, question }, query));
            console.log(`[ask] corpus ms=${Date.now() - t0} status=${answer.status} claims=${answer.claims.length}`);
            send({ type: "answer", answer });
            await record(answer, question, lang);
            return close();
          }
          const answer = withActionPlan(await withWebFallback(answerQuestion(question, lang, { includeDemo: false, forceMissing: true }), query));
          send({ type: "answer", answer });
          await record(answer, question, lang);
          return close();
        }

        if (!AI.enabled) {
          const answer = withActionPlan(await withWebFallback(answerQuestion(question, lang, { includeDemo: false, forceMissing: true }), query));
          send({ type: "answer", answer });
          await record(answer, question, lang);
          return close();
        }

        // Fetch official links alongside the stream so they cost no extra wait.
        const web = officialFallbackLinks(query);
        send({ type: "phase", label: doc ? phases.document : phases.think });

        let text = "";
        for await (const chunk of streamGeneral(question, lang, history, req.signal, doc)) {
          text += chunk;
          send({ type: "chunk", text: chunk });
        }
        // The provider intermittently returns an empty stream; one non-streamed retry
        // beats showing the user an apology.
        if (!text.trim()) text = await askGeneral(question, lang, history, req.signal, doc).catch(() => "");
        if (!text.trim()) {
          send({ type: "error", message: offline(lang) });
          return close();
        }

        const answer = withActionPlan(proseAnswer(question, lang, text, web));
        console.log(`[ask] prose ms=${Date.now() - t0} chars=${text.length} web=${answer.web?.length ?? 0}`);
        send({ type: "answer", answer });
        await record(answer, question, lang);
        close();
      } catch (e) {
        if (req.signal.aborted) {
          send({ type: "error", message: offline(lang) });
          return close();
        }
        console.error(`[ask] stream failed: ${e instanceof Error ? e.message.slice(0, 160) : String(e)}`);
        send({ type: "error", message: offline(lang) });
        close();
      }
    },
    cancel() { open = false; },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive" },
  });
}

/** Documentation repair loop: gaps and uncovered questions become review items. */
async function record(answer: Answer, question: string, lang: Lang) {
  await logAsk({
    lang,
    kind: answer.kind,
    status: answer.status,
    topicId: answer.topicId,
    topicScore: answer.engine.retrieval.topicScore,
    engine: answer.engine.mode,
    claims: answer.claims.length,
    cited: answer.sources.map((s) => s.passageId),
  }).catch(() => {});

  if (answer.kind === "corpus" && answer.status === "supported") return;
  await logReview({
    kind: answer.kind === "prose" ? "unanswered" : answer.status === "partial" ? "partial" : answer.status === "contradiction" ? "conflict" : "unanswered",
    lang,
    question,
    topicId: answer.topicId,
    answerStatus: answer.status,
    missing: answer.missing.map((m) => m.ro),
    conflictGroup: answer.conflicts[0]?.group,
  }).catch(() => {});
}

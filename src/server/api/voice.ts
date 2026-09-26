import { NextResponse } from "next/server";
import { DOCS, DOC_BY_ID } from "@/lib/corpus/docs";
import { decomposeQuestion, officialNextSteps, searchPassages } from "@/lib/retrieval";
import { isCitizenAnswerSource } from "@/lib/corpus/sources";
import type { Lang, Passage } from "@/lib/corpus/types";

export const runtime = "nodejs";

const MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1";
const TOKEN_LIMIT = 8;
// The evaluation intentionally makes 99 source lookups; retain practical abuse protection
// while allowing that local regression run to exercise every case from one client.
const SEARCH_LIMIT = 120;
const WINDOW_MS = 10 * 60_000;
const tokenHits = new Map<string, number[]>();
const searchHits = new Map<string, number[]>();
// Only actual pages and documents are citizen-answer sources. Annex 1 is a directory;
// the Annex PDF itself and all fictitious/demo records must never answer service questions.
const CITIZEN_SOURCE_IDS = DOCS
  .filter(isCitizenAnswerSource)
  .map((doc) => doc.id);

function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function limited(store: Map<string, number[]>, key: string, limit: number): boolean {
  const now = Date.now();
  const recent = (store.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  store.set(key, recent);
  if (store.size > 5000) for (const [id, times] of store) if (!times.some((time) => now - time < WINDOW_MS)) store.delete(id);
  return recent.length > limit;
}

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function ready() {
  return NextResponse.json(
    { ready: Boolean(process.env.OPENAI_API_KEY) && CITIZEN_SOURCE_IDS.length > 0 },
    { headers: { "cache-control": "no-store" } },
  );
}

const INSTRUCTIONS = (lang: Lang) => `You are the municipal assistant's live voice interface. The website language is ${lang === "ru" ? "Russian" : "Romanian"}; speak and transcribe only in this language. For every factual municipal question, call searchMunicipalDocuments before answering. Use only relevant official page/document passages returned by that tool. Annex 1 is a directory, not service guidance. The tool separates multi-part questions and lists any missingParts: state those gaps clearly and never imply the whole question is answered. If evidence is missing or unrelated, abstain from that part; do not guess. Never invent a procedure, deadline, fee, contact, or requirement. Briefly name each source title when answering. The UI shows source links and exact passages.`;
const TRANSCRIPTION_PROMPT: Record<Lang, string> = {
  ro: "Întrebări despre servicii municipale în Chișinău. Păstrează exact numele străzilor și instituțiilor (Pretura, AGSV, Apă-Canal, EXDRUPO), datele, sumele și numerele documentelor.",
  ru: "Вопросы о муниципальных услугах Кишинёва. Точно сохраняй названия улиц и учреждений (Претура, AGSV, Apă-Canal, EXDRUPO), даты, суммы и номера документов.",
};

const TOOLS = [{
  type: "function",
  name: "searchMunicipalDocuments",
  description: "Search the indexed official municipal pages and documents linked from Annex 1. Annex 1 itself is a directory, not service guidance. Use for every factual municipal question.",
  parameters: {
    type: "object",
    properties: { query: { type: "string", description: "The user's short municipal information question." } },
    required: ["query"],
    additionalProperties: false,
  },
}];

export async function token(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  if (limited(tokenHits, clientKey(req), TOKEN_LIMIT)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "voice_not_configured" }, { status: 503 });

  const body = await req.json().catch(() => null) as { lang?: unknown } | null;
  const lang: Lang = body?.lang === "ru" ? "ru" : "ro";

  try {
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: MODEL,
          instructions: INSTRUCTIONS(lang),
          tools: TOOLS,
          tool_choice: "auto",
          audio: {
            input: {
              transcription: { model: "gpt-4o-mini-transcribe", language: lang, prompt: TRANSCRIPTION_PROMPT[lang] },
              turn_detection: { type: "server_vad", threshold: 0.65, prefix_padding_ms: 300, silence_duration_ms: 700, create_response: false, interrupt_response: false },
              noise_reduction: { type: "near_field" },
            },
            output: { voice: "marin" },
          },
        },
      }),
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(`[voice] token provider returned ${response.status}`);
      return NextResponse.json({ error: "voice_unavailable" }, { status: 502 });
    }
    const data = await response.json() as { value?: string; expires_at?: number; client_secret?: { value?: string; expires_at?: number } };
    const value = data.value ?? data.client_secret?.value;
    if (!value) return NextResponse.json({ error: "voice_unavailable" }, { status: 502 });
    return NextResponse.json({ value, expires_at: data.expires_at ?? data.client_secret?.expires_at }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "voice_unavailable" }, { status: 502 });
  }
}

export async function search(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  if (limited(searchHits, clientKey(req), SEARCH_LIMIT)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  if (!CITIZEN_SOURCE_IDS.length) return NextResponse.json({ error: "source_unavailable" }, { status: 503 });

  const body = await req.json().catch(() => null) as { query?: unknown; lang?: unknown } | null;
  const query = typeof body?.query === "string" ? body.query.trim().slice(0, 300) : "";
  if (!query) return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  const lang: Lang = body?.lang === "ru" ? "ru" : "ro";
  const informationNeeds = decomposeQuestion(query);
  const missingParts: string[] = [];
  const deduped = new Map<string, { passage: Passage; score: number; questionPart: string }>();
  for (const questionPart of informationNeeds) {
    const hits = searchPassages(questionPart, 8, CITIZEN_SOURCE_IDS)
      .filter(({ coverage, score }) => coverage >= 0.16 && score > 0)
      .slice(0, 2);
    if (!hits.length) missingParts.push(questionPart);
    for (const hit of hits) {
      const existing = deduped.get(hit.passage.id);
      if (!existing || hit.score > existing.score) deduped.set(hit.passage.id, { passage: hit.passage, score: hit.score, questionPart });
    }
  }
  const results = [...deduped.values()].slice(0, 8).map(({ passage, score, questionPart }) => {
      const doc = DOC_BY_ID.get(passage.docId)!;
      return {
        chunkId: passage.id,
        sourceType: "official",
        questionPart,
        document: doc.title,
        url: doc.url,
        agency: doc.publisher,
        language: doc.lang,
        publicationDate: doc.publishedAt ?? doc.revisedAt ?? null,
        lastCheckedAt: doc.lastCheckedAt ?? doc.retrievedAt,
        currentness: doc.status === "declared_in_force" ? "declared-current" : "unverified",
        statusNote: doc.statusNote[lang],
        page: passage.page,
        section: passage.section,
        locator: passage.locator[lang],
        passage: passage.text,
        score,
      };
    });
  const fallback = lang === "ru"
    ? "В проиндексированных официальных источниках не найден релевантный фрагмент. Позвоните в Единое окно по номеру, указанному на экране."
    : "În sursele oficiale indexate nu am găsit un pasaj relevant. Sună la Ghișeul Unic folosind numărul afișat pe ecran.";
  const missingNextSteps = missingParts.flatMap((part) => officialNextSteps(part, lang));
  const nextSteps = missingParts.length
    ? [...new Map(missingNextSteps.map((step) => [`${step.url}\0${step.title}`, step] as const)).values()]
    : results.length ? [] : officialNextSteps(query, lang);
  return NextResponse.json({ results, fallback, missingParts, nextSteps }, { headers: { "cache-control": "no-store" } });
}

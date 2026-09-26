import { NextResponse } from "next/server";
import { DOC_BY_ID } from "@/lib/corpus/docs";
import { searchPassages } from "@/lib/retrieval";
import type { Lang } from "@/lib/corpus/types";

export const runtime = "nodejs";

const SOURCE_ID = "voice-annex-source-list";
const MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1";
const TOKEN_LIMIT = 8;
const SEARCH_LIMIT = 50;
const WINDOW_MS = 10 * 60_000;
const tokenHits = new Map<string, number[]>();
const searchHits = new Map<string, number[]>();

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
    { ready: Boolean(process.env.OPENAI_API_KEY) && DOC_BY_ID.has(SOURCE_ID) },
    { headers: { "cache-control": "no-store" } },
  );
}

const INSTRUCTIONS = `You are the municipal assistant's live voice interface. The only approved factual source is Annex 1 — List of Data Sources. It contains categories and web addresses, not the rules or service details published on those websites. For every factual municipal question, call searchMunicipalDocuments before answering. Use only the exact passage returned by that tool. If there are no relevant passages, say in the user's language that the available official document does not contain enough information to answer. Never use general knowledge, infer facts from a URL, or invent a process, deadline, fee, contact, or requirement. Be concise and conversational. Reply in the same language as the user, Romanian or Russian. The UI displays each tool result with its page and exact passage; do not invent page numbers or citations.`;

const TOOLS = [{
  type: "function",
  name: "searchMunicipalDocuments",
  description: "Search only the approved Annex 1 PDF, which lists municipal source categories and URLs. Use for every factual municipal question.",
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

  try {
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: MODEL,
          instructions: INSTRUCTIONS,
          tools: TOOLS,
          tool_choice: "auto",
          audio: {
            input: {
              transcription: { model: "gpt-4o-mini-transcribe" },
              turn_detection: { type: "server_vad", interrupt_response: true },
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
  if (!DOC_BY_ID.has(SOURCE_ID)) return NextResponse.json({ error: "source_unavailable" }, { status: 503 });

  const body = await req.json().catch(() => null) as { query?: unknown; lang?: unknown } | null;
  const query = typeof body?.query === "string" ? body.query.trim().slice(0, 300) : "";
  if (!query) return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  const lang: Lang = body?.lang === "ru" ? "ru" : "ro";
  const results = searchPassages(query, 12, [SOURCE_ID])
    .filter(({ coverage, score }) => coverage >= 0.16 && score > 0)
    .slice(0, 4)
    .map(({ passage, score }) => ({
      chunkId: passage.id,
      document: "1790246023182_Annex_1__List_of_Data_Sources.pdf",
      page: passage.page,
      section: passage.section,
      passage: passage.text,
      score,
    }));
  const fallback = lang === "ru"
    ? "В имеющемся официальном документе недостаточно информации, чтобы ответить на этот вопрос."
    : "Documentul oficial disponibil nu conține suficiente informații pentru a răspunde la această întrebare.";
  return NextResponse.json({ results, fallback }, { headers: { "cache-control": "no-store" } });
}

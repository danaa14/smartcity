import "server-only";
import { createHash } from "node:crypto";
import { complete, ModelError } from "../ai/client";
import { AI } from "../ai/config";
import { PASSAGE_BY_ID } from "../corpus/passages";
import { DOC_BY_ID } from "../corpus/docs";
import type { Aspect, L10n, Passage } from "../corpus/types";
import type { Claim } from "./types";

export interface LlmDraft {
  claims: Claim[];
  missing: L10n[];
}

const ASPECTS: Aspect[] = ["procedure", "documents", "cost", "time", "contact", "obligation", "validity", "channel"];

const SYSTEM = `You answer questions from residents of Chișinău using ONLY the numbered source passages provided.
Rules:
- Every claim must be supported by an EXACT, verbatim, contiguous quote copied character-for-character from one of the passages (keep diacritics and punctuation). Never paraphrase inside "quote".
- The claim must restate only what its cited quote explicitly says. Do not infer, combine unrelated facts, or add context from memory. If the connection is not clear from the quote itself, put that information need under "missing".
- Never state a fee, deadline, document, right or obligation that is not in the passages. If the passages do not answer part of the question, list that part under "missing".
- If the passages are about a DIFFERENT subject than the question, return {"claims":[],"missing":[...]}. A related-sounding passage is not an answer; never pad the reply with facts the user did not ask about.
- Do not decide which of two conflicting sources prevails.
- Write each claim in both Romanian ("ro") and Russian ("ru"); short, plain language, max 2 sentences.
- Passages marked DEMO are fictional; if you use them, start both claim texts with "[DEMO] ".
Return ONLY JSON, no markdown:
{"claims":[{"ro":"...","ru":"...","aspect":["documents"],"cites":[{"passageId":"...","quote":"..."}]}],"missing":[{"ro":"...","ru":"..."}]}
Allowed aspect values: ${ASPECTS.join(", ")}. Use at most 6 claims.`;

function formatPassages(ids: string[]): string {
  return ids
    .map((id) => {
      const p = PASSAGE_BY_ID.get(id)!;
      const d = DOC_BY_ID.get(p.docId)!;
      return `[${p.id}]${d.kind === "demo" ? " (DEMO)" : ""} ${d.title} — ${p.locator.ro}\n${p.text}`;
    })
    .join("\n\n");
}

function parseJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  return JSON.parse(t.slice(start, end + 1));
}

/** Asks the model to draft claims over candidate passages. Output is untrusted until validated. */
export async function draftWithModel(question: string, candidateIds: string[], signal?: AbortSignal): Promise<LlmDraft> {
  const ids = candidateIds.filter((id) => PASSAGE_BY_ID.has(id)).slice(0, 8);
  const session = "pefir-" + createHash("sha256").update(question).digest("hex").slice(0, 16);
  // Reasoning tokens are drawn from this budget before the JSON is written; 2500 left the
  // model cutting off mid-object on multi-claim answers.
  const raw = await complete(SYSTEM, `Question: ${question}\n\nPassages:\n${formatPassages(ids)}`, session, { maxTokens: 8000, signal });
  let data: { claims?: unknown[]; missing?: unknown[] };
  try {
    data = parseJson(raw) as typeof data;
  } catch {
    throw new ModelError("upstream", "model returned non-JSON output");
  }
  const allowed = new Set(ids);
  const claims: Claim[] = (Array.isArray(data.claims) ? data.claims : []).slice(0, 6).flatMap((c, i) => {
    const x = c as { ro?: string; ru?: string; aspect?: string[]; cites?: { passageId?: string; quote?: string }[] };
    if (typeof x.ro !== "string" || typeof x.ru !== "string" || !Array.isArray(x.cites)) return [];
    const cites = x.cites
      .filter((q) => typeof q.passageId === "string" && typeof q.quote === "string" && allowed.has(q.passageId))
      .map((q) => ({ n: 0, passageId: q.passageId!, quote: q.quote! }));
    const demo = cites.some((q) => DOC_BY_ID.get(PASSAGE_BY_ID.get(q.passageId)!.docId)?.kind === "demo");
    return [{
      id: `llm-${i + 1}`,
      text: { ro: x.ro.slice(0, 600), ru: x.ru.slice(0, 600) },
      citations: cites,
      aspect: (x.aspect ?? []).filter((a): a is Aspect => ASPECTS.includes(a as Aspect)),
      demo,
    }];
  });
  const missing: L10n[] = (Array.isArray(data.missing) ? data.missing : []).slice(0, 4).flatMap((m) => {
    const x = m as { ro?: string; ru?: string };
    return typeof x.ro === "string" && typeof x.ru === "string" ? [{ ro: x.ro.slice(0, 300), ru: x.ru.slice(0, 300) }] : [];
  });
  return { claims, missing };
}

export const MODEL_LABEL = (): L10n => ({
  ro: `Răspuns redactat de modelul ${AI.model} din pasajele corpusului. Verificarea automată confirmă că citatul apare exact în pasaj; verificați extrasul pentru a confirma că susține afirmația.`,
  ru: `Ответ составлен моделью ${AI.model} по фрагментам корпуса. Автоматическая проверка подтверждает точное совпадение цитаты; проверьте отрывок, чтобы убедиться, что он подтверждает утверждение.`,
});

export function fallbackLabel(code: string): L10n {
  const why: Record<string, L10n> = {
    training_not_allowed: {
      ro: "contul OpenCode nu permite modele care se antrenează pe date (setare de confidențialitate)",
      ru: "аккаунт OpenCode не разрешает модели, обучающиеся на данных (настройка конфиденциальности)",
    },
    timeout: { ro: "modelul nu a răspuns la timp", ru: "модель не ответила вовремя" },
  };
  const r = why[code] ?? { ro: "modelul nu a fost disponibil", ru: "модель была недоступна" };
  return {
    ro: `Modelul AI nu a putut fi folosit (${r.ro}). Afișăm răspunsul determinist din afirmații verificate — aceleași citări exacte.`,
    ru: `Не удалось использовать ИИ-модель (${r.ru}). Показан детерминированный ответ из проверенных утверждений — с теми же точными цитатами.`,
  };
}

export type { Passage };

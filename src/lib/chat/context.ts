import { detectAspects, rankTopics } from "../retrieval";
import { normalize } from "../text";
import type { Lang } from "../corpus/types";

export interface HistoryTurn { role: "user" | "assistant"; content: string }

export function sanitizeHistory(raw: unknown): HistoryTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(-12).flatMap((turn) => {
    if (!turn || typeof turn !== "object" ||
      !["user", "assistant"].includes(turn.role) || typeof turn.content !== "string") return [];
    return [{ role: turn.role as HistoryTurn["role"], content: turn.content.slice(0, 1200) }];
  });
}

// Exact subject-free phrases only: a new named service must never inherit the old topic.
// Normalize both sides, including Russian й, just as the retrieval index does.
const FOLLOW_UPS = new Set([
  "cât costă", "cât durează", "în cât timp", "ce acte", "ce acte îmi trebuie",
  "ce acte sunt necesare", "ce documente", "ce documente îmi trebuie",
  "ce documente sunt necesare", "unde depun", "unde depun cererea", "unde plătesc",
  "pot online", "se poate online", "pot depune online", "care este termenul",
  "care e termenul", "care este programul", "care e programul", "unde mă adresez",
  "сколько стоит", "сколько времени", "какие документы", "какие документы нужны",
  "как долго", "куда подать", "куда подать заявление", "куда обратиться",
  "можно онлайн", "можно ли онлайн", "какой срок",
].map(normalize));

function isFollowUp(question: string): boolean {
  return FOLLOW_UPS.has(normalize(question).replace(/^(?:si|dar|а|и) /u, ""));
}

export function contextualQuestion(question: string, history: HistoryTurn[], lang: Lang): string {
  if (!isFollowUp(question)) return question;
  for (const turn of [...history].reverse()) {
    if (turn.role !== "user" || isFollowUp(turn.content)) continue;
    const topic = rankTopics(turn.content, detectAspects(turn.content))
      .filter((hit) => hit.topic.kind !== "demo")[0];
    if (!topic || topic.specific < 1.5) return question;
    // Avoid turning conjunctions in the topic title into additional information needs.
    const subject = topic.topic.title[lang].replace(/\s+(?:și|и)\s+/gu, " / ");
    return `${question.replace(/[?!]+$/g, "")} (${subject})`;
  }
  return question;
}

export function refersToDocument(question: string): boolean {
  return isFollowUp(question) || /(?:document|contract|clauz|anex|rezili|penalit|acest act|actul|atasat|acesta|aceasta|документ|договор|пункт|прилож|расторж|неустойк|этот|эта)/u.test(normalize(question));
}

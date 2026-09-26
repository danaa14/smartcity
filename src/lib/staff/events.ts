import "server-only";
import { randomUUID } from "node:crypto";
import { collection } from "../store/db";
import type { AnswerStatus } from "../answer/types";
import type { Lang } from "../corpus/types";

/**
 * One row per answered question, successful or not, so the failure counts in
 * `review-items` finally have a denominator.
 *
 * Deliberately holds no question text. Failures already store a redacted question as a
 * review item because a human has to read them to fix the corpus; successes only ever
 * need to be counted, so keeping their wording would widen what is retained for no gain.
 */
export interface AskEvent {
  id: string;
  at: string;
  lang: Lang;
  kind: "corpus" | "prose";
  status: AnswerStatus;
  topicId: string | null;
  topicScore: number;
  engine: "deterministic-demo" | "llm" | "llm-fallback" | "general";
  claims: number;
  /** Passages actually cited, to show which evidence carries real traffic. */
  cited: string[];
}

export const askEvents = collection<AskEvent>("ask-events");

export async function logAsk(event: Omit<AskEvent, "id" | "at">) {
  return askEvents.insert({ ...event, id: randomUUID(), at: new Date().toISOString() });
}

import "server-only";
import { randomUUID } from "node:crypto";
import { collection } from "../store/db";
import { redact } from "../text";
import type { AnswerStatus } from "../answer/types";
import type { Lang } from "../corpus/types";

export type ReviewState = "new" | "in_review" | "resolved" | "dismissed";

export type ReviewKind = "unanswered" | "partial" | "conflict" | "citation_report" | "rating";

export interface ReviewItem {
  id: string;
  kind: ReviewKind;
  createdAt: string;
  state: ReviewState;
  lang: Lang;
  /** Question text with e-mails, phone numbers and IDNPs redacted. */
  question?: string;
  topicId?: string | null;
  answerStatus?: AnswerStatus;
  missing?: string[];
  conflictGroup?: string;
  passageId?: string;
  claimId?: string;
  reportReason?: "wrong_passage" | "outdated" | "misread" | "other";
  useful?: boolean;
  comment?: string;
}

export const reviews = collection<ReviewItem>("review-items");

export async function logReview(item: Omit<ReviewItem, "id" | "createdAt" | "state">) {
  return reviews.insert({
    ...item,
    question: item.question ? redact(item.question) : undefined,
    comment: item.comment ? redact(item.comment) : undefined,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    state: "new",
  });
}

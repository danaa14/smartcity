import type { Aspect, L10n, Lang, Passage, SourceDoc } from "../corpus/types";
import type { WebResult } from "../web/search";

export type AnswerStatus = "supported" | "partial" | "missing" | "contradiction";

export interface Citation {
  n: number;
  passageId: string;
  quote: string;
}

export interface Claim {
  id: string;
  text: L10n;
  citations: Citation[];
  uncertainty?: L10n;
  aspect: Aspect[];
  demo: boolean;
}

export interface Conflict {
  group: string;
  explanation: L10n;
  sides: { claimId: string; value: string; passageId: string; docId: string }[];
}

export interface NextStep {
  text: L10n;
  claimIds: string[];
}

export interface ValidationReport {
  checked: number;
  passed: number;
  dropped: { claimId: string; reason: string }[];
}

/**
 * `corpus` answers carry exact-quote-checked citations. Exact matching does not prove semantic entailment;
 * the displayed source passage remains the evidence a reader can inspect.
 * `prose` answers come from the model's own knowledge when the corpus cannot reach the
 * question; they are never cited and must always render the unverified badge.
 */
export type AnswerKind = "corpus" | "prose";

export interface Answer {
  question: string;
  questionLang: Lang;
  kind: AnswerKind;
  /** Plain-language answer in the asker's language. Only set when kind === "prose". */
  prose?: string;
  /** Prose that asserts facts, so the UI must show the verify-before-acting warning. */
  unverified?: boolean;
  status: AnswerStatus;
  topicId: string | null;
  topicTitle: L10n | null;
  demoCorpus: boolean;
  summary: L10n;
  claims: Claim[];
  /** Every validated claim (direct answer, route steps, contacts) by id. */
  claimIndex: Record<string, Claim>;
  /** Passage numbering used by citation markers: [n] → passage. */
  sources: { n: number; passageId: string }[];
  steps: NextStep[];
  missing: L10n[];
  conflicts: Conflict[];
  contacts: Claim[];
  servicePage?: { url: string; label: L10n; claimId: string };
  requestedAspects: Aspect[];
  passages: Record<string, Passage>;
  docs: Record<string, SourceDoc>;
  validation: ValidationReport;
  engine: { mode: "deterministic-demo" | "llm" | "llm-fallback" | "general"; model?: string; label: L10n; retrieval: { topicScore: number; candidates: { topicId: string; score: number }[] } };
  generatedAt: string;
  /** Web results — set ONLY when the corpus has nothing (status missing). Unverified, never citations. */
  web?: WebResult[];
}

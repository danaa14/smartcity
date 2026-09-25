import type { Aspect, L10n, Lang, Passage, SourceDoc } from "../corpus/types";

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

export interface Answer {
  question: string;
  questionLang: Lang;
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
  engine: { mode: "deterministic-demo" | "llm" | "llm-fallback"; model?: string; label: L10n; retrieval: { topicScore: number; candidates: { topicId: string; score: number }[] } };
  generatedAt: string;
}

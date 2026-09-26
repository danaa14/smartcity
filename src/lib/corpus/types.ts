export type Lang = "ro" | "ru";
export type CorpusLang = Lang | "en";
export type L10n = { ro: string; ru: string };

export type DocStatus =
  | "declared_in_force"
  | "unknown"
  | "superseded"
  | "abrogated"
  | "demo";

export type RelationType =
  | "abrogates"
  | "supersedes"
  | "language_version_of"
  | "possible_conflict_with"
  | "same_page_as"
  | "referenced_by";

export interface DocRelation {
  type: RelationType;
  target: string;
  established: boolean;
  evidencePassageId?: string;
  note: L10n;
}

export interface SourceDoc {
  id: string;
  kind: "real" | "demo";
  title: string;
  titleTranslation?: L10n;
  url: string | null;
  publisher: string;
  annexCategory: string | null;
  annexStartUrl: string | null;
  lang: CorpusLang;
  docType: L10n;
  publishedAt?: string;
  effectiveAt?: string;
  revisedAt?: string;
  retrievedAt: string;
  status: DocStatus;
  statusNote: L10n;
  relations?: DocRelation[];
  notes?: L10n;
  rawFile?: string;
}

export interface Passage {
  id: string;
  docId: string;
  locator: L10n;
  page?: number;
  section?: string;
  text: string;
  lang: CorpusLang;
  unofficialTranslation?: Partial<L10n>;
}

export type Aspect =
  | "procedure"
  | "documents"
  | "cost"
  | "time"
  | "contact"
  | "obligation"
  | "validity"
  | "channel";

export interface Fact {
  id: string;
  topic: string;
  aspects: Aspect[];
  text: L10n;
  /** Passages that support the claim; the first one in the user's language is shown first. */
  cites: { passageId: string; quote: string }[];
  keywords?: string[];
  conflictGroup?: string;
  conflictValue?: string;
  uncertainty?: L10n;
  core?: boolean;
}

export interface GpsStep {
  text: L10n;
  factIds: string[];
}

export interface Topic {
  id: string;
  kind: "real" | "demo";
  title: L10n;
  keywords: string[];
  steps: GpsStep[];
  contactFactIds: string[];
  servicePage?: { url: string; label: L10n; factId: string };
  gaps: Partial<Record<Aspect, L10n>>;
}

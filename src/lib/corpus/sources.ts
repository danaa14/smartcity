import type { SourceDoc } from "./types";

/** Sources eligible to support current citizen answers. Unknown dates remain usable with a caveat. */
export function isCitizenAnswerSource(doc: SourceDoc): boolean {
  return doc.kind === "real" &&
    Boolean(doc.url) &&
    doc.id !== "voice-annex-source-list" &&
    doc.status !== "superseded" &&
    doc.status !== "abrogated" &&
    doc.status !== "demo";
}

export function sourceCurrentness(doc: SourceDoc): "declared-current" | "unverified" {
  return doc.status === "declared_in_force" ? "declared-current" : "unverified";
}

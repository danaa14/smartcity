import { PASSAGE_BY_ID } from "../corpus/passages";
import { DOC_BY_ID } from "../corpus/docs";
import { squash } from "../text";
import type { Claim, ValidationReport } from "./types";

/**
 * A claim is displayed only if every citation resolves to an indexed passage and the quoted
 * span occurs verbatim in it. Demo passages may only support claims explicitly marked [DEMO].
 */
export function validateClaims(claims: Claim[]): { valid: Claim[]; report: ValidationReport } {
  const report: ValidationReport = { checked: claims.length, passed: 0, dropped: [] };
  const valid: Claim[] = [];
  for (const c of claims) {
    const reason = check(c);
    if (reason) report.dropped.push({ claimId: c.id, reason });
    else {
      valid.push(c);
      report.passed++;
    }
  }
  return { valid, report };
}

function check(c: Claim): string | null {
  if (!c.citations.length) return "no citation";
  for (const cit of c.citations) {
    const p = PASSAGE_BY_ID.get(cit.passageId);
    if (!p) return `unknown passage ${cit.passageId}`;
    const doc = DOC_BY_ID.get(p.docId);
    if (!doc) return `unknown document ${p.docId}`;
    if (!squash(p.text).includes(squash(cit.quote))) return `quote not found in ${cit.passageId}`;
    if (doc.kind === "demo" && !(c.demo && c.text.ro.startsWith("[DEMO]") && c.text.ru.startsWith("[DEMO]")))
      return `demo source used for non-demo claim`;
  }
  return null;
}

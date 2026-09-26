import "server-only";
import { createHash } from "node:crypto";
import { complete } from "../ai/client";
import type { L10n } from "../corpus/types";

export type Severity = "ok" | "info" | "warn" | "risk";

export interface ReviewFinding {
  id: string;
  kind: "missing" | "risk" | "unclear" | "good";
  severity: Severity;
  title: L10n;
  explanation: L10n;
  suggestion?: L10n;
  /** Verbatim span from the redacted document; null for things that are absent. Verified server-side. */
  quote: string | null;
  quoteVerified: boolean;
}

export interface DocReview {
  docType: L10n;
  summary: L10n;
  userRole: L10n | null;
  verdict: "looks_complete" | "needs_attention" | "high_risk";
  findings: ReviewFinding[];
  checklist: { item: L10n; present: boolean; quote: string | null; quoteVerified: boolean }[];
  model: string;
}

const SYSTEM = `You are a careful personal assistant helping a resident of Moldova understand a document (contract, sale agreement, lease, terms and conditions, application form, invoice...).
Personal data has been replaced with tags like [NUME_1], [IDNP_1], [ADRESĂ_1]. Treat tags as filled-in values; never ask for or guess the real data.
Tasks:
1. Identify the document type and, if stated, the user's likely role (e.g. seller, buyer, tenant, customer).
2. Checklist: the essential elements this type of document normally contains (parties, object, price, payment terms, dates, signatures, duration, termination, liability, dispute resolution...). For each, say whether present.
3. Findings: missing essentials, clauses that are unfavourable or risky for the user (one-sided penalties, automatic renewal, unlimited liability, waiver of rights, hidden fees, unclear deadlines), ambiguities, and a few good points.
4. For each finding give a concrete, practical suggestion.
Rules:
- "quote" must be copied character-for-character from the document text (a short contiguous span, max ~200 chars) or null if the problem is that something is absent.
- Do not claim what Moldovan law says unless it is general common knowledge; phrase legal points cautiously ("verificați cu un jurist"). Never declare the document legally valid or invalid.
- Write every text field in BOTH Romanian ("ro") and Russian ("ru"), plain language.
Return ONLY JSON:
{"docType":{"ro":"","ru":""},"userRole":{"ro":"","ru":""}|null,"summary":{"ro":"","ru":""},"verdict":"looks_complete|needs_attention|high_risk",
"checklist":[{"item":{"ro":"","ru":""},"present":true,"quote":"...or null"}],
"findings":[{"kind":"missing|risk|unclear|good","severity":"ok|info|warn|risk","title":{"ro":"","ru":""},"explanation":{"ro":"","ru":""},"suggestion":{"ro":"","ru":""},"quote":"...or null"}]}
Max 12 checklist items, max 10 findings.`;

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

function isL10n(x: unknown): x is L10n {
  return !!x && typeof (x as L10n).ro === "string" && typeof (x as L10n).ru === "string";
}
const clip = (l: L10n, n = 600): L10n => ({ ro: l.ro.slice(0, n), ru: l.ru.slice(0, n) });

function verify(quote: unknown, doc: string): { quote: string | null; quoteVerified: boolean } {
  if (typeof quote !== "string" || !quote.trim()) return { quote: null, quoteVerified: false };
  const q = quote.slice(0, 300);
  return { quote: q, quoteVerified: norm(doc).includes(norm(q)) };
}

export async function reviewDocument(redactedText: string, userGoal: string): Promise<DocReview> {
  const doc = redactedText.slice(0, 24000);
  const session = "pefir-scan-" + createHash("sha256").update(doc).digest("hex").slice(0, 16);
  const raw = await complete(SYSTEM, `User's goal/context: ${userGoal || "(not stated) — review generally"}\n\nDocument (personal data redacted):\n"""\n${doc}\n"""`, session);
  const t = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));

  const findings: ReviewFinding[] = (Array.isArray(j.findings) ? j.findings : []).slice(0, 10).flatMap((f: Record<string, unknown>, i: number) => {
    if (!isL10n(f.title) || !isL10n(f.explanation)) return [];
    const kind = ["missing", "risk", "unclear", "good"].includes(f.kind as string) ? (f.kind as ReviewFinding["kind"]) : "unclear";
    const severity = ["ok", "info", "warn", "risk"].includes(f.severity as string) ? (f.severity as Severity) : "info";
    return [{ id: `f${i + 1}`, kind, severity, title: clip(f.title, 160), explanation: clip(f.explanation), suggestion: isL10n(f.suggestion) ? clip(f.suggestion) : undefined, ...verify(f.quote, doc) }];
  });
  const checklist = (Array.isArray(j.checklist) ? j.checklist : []).slice(0, 12).flatMap((c: Record<string, unknown>) =>
    isL10n(c.item) ? [{ item: clip(c.item, 160), present: !!c.present, ...verify(c.quote, doc) }] : [],
  );
  return {
    docType: isL10n(j.docType) ? clip(j.docType, 120) : { ro: "Document", ru: "Документ" },
    userRole: isL10n(j.userRole) ? clip(j.userRole, 120) : null,
    summary: isL10n(j.summary) ? clip(j.summary, 800) : { ro: "", ru: "" },
    verdict: ["looks_complete", "needs_attention", "high_risk"].includes(j.verdict) ? j.verdict : "needs_attention",
    findings,
    checklist,
    model: "",
  };
}

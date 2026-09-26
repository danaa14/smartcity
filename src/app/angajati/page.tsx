import type { Metadata } from "next";
import { getLang } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { reviews } from "@/lib/feedback";
import { tickets } from "@/lib/tickets/repo";
import { FACTS } from "@/lib/corpus/facts";
import { PASSAGE_BY_ID } from "@/lib/corpus/passages";
import { DOC_BY_ID, DOCS } from "@/lib/corpus/docs";
import { staffSession } from "@/lib/staff/auth";
import { StaffClient, type ConflictCandidate } from "@/components/staff/StaffClient";
import { StaffGate } from "@/components/staff/StaffGate";
import { StaffSignOut } from "@/components/staff/StaffSignOut";

export const metadata: Metadata = { title: "Back office" };
export const dynamic = "force-dynamic";

function corpusConflicts(): ConflictCandidate[] {
  const groups = new Map<string, typeof FACTS>();
  for (const f of FACTS) if (f.conflictGroup) groups.set(f.conflictGroup, [...(groups.get(f.conflictGroup) ?? []), f]);
  return [...groups].map(([group, facts]) => ({
    group,
    sides: facts.map((f) => {
      const p = PASSAGE_BY_ID.get(f.cites[0].passageId)!;
      const d = DOC_BY_ID.get(p.docId)!;
      return { value: f.conflictValue!, quote: f.cites[0].quote, passage: p, doc: { id: d.id, title: d.title, kind: d.kind, publishedAt: d.publishedAt, revisedAt: d.revisedAt } };
    }),
  }));
}

export default async function StaffPage() {
  const session = await staffSession();
  if (session !== "ok") return <StaffGate configured={session === "denied"} />;

  const lang = await getLang();
  const t = (x: { ro: string; ru: string }) => tr(x, lang);
  const [items, tks] = await Promise.all([reviews.all(), tickets.all()]);
  const unknownValidity = DOCS.filter((d) => d.kind === "real" && d.status === "unknown").map((d) => ({ id: d.id, title: d.title, note: d.statusNote }));

  return (
    <div>
      <header className="bo-head">
        <div className="bo-head-row">
          <div>
            <span className="bo-kicker">{t({ ro: "BUCLA DE REPARARE A DOCUMENTAȚIEI", ru: "ПЕТЛЯ ИСПРАВЛЕНИЯ ДОКУМЕНТАЦИИ" })}</span>
            <h1>{t({ ro: "Back office", ru: "Бэк-офис" })}</h1>
          </div>
          <StaffSignOut />
        </div>
        <p>
          {t({
            ro: "Ce nu a putut fi răspuns, ce se contrazice, ce a fost semnalat și ce sesizări au sosit — cu starea fiecărui element.",
            ru: "На что не удалось ответить, что противоречит друг другу, что отмечено и какие обращения поступили — со статусом каждого элемента.",
          })}
        </p>
      </header>
      <StaffClient items={items} tickets={tks} conflicts={corpusConflicts()} unknownValidity={unknownValidity} />
    </div>
  );
}

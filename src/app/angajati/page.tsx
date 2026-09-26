import type { Metadata } from "next";
import { getLang } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { reviews } from "@/lib/feedback";
import { tickets } from "@/lib/tickets/repo";
import { FACTS } from "@/lib/corpus/facts";
import { PASSAGE_BY_ID } from "@/lib/corpus/passages";
import { DOC_BY_ID, DOCS } from "@/lib/corpus/docs";
import { StaffClient, type ConflictCandidate } from "@/components/staff/StaffClient";
import { Notice } from "@/components/ui";

export const metadata: Metadata = { title: "Pentru angajați" };
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
  const lang = await getLang();
  const t = (x: { ro: string; ru: string }) => tr(x, lang);
  const [items, tks] = await Promise.all([reviews.all(), tickets.all()]);
  const unknownValidity = DOCS.filter((d) => d.kind === "real" && d.status === "unknown").map((d) => ({ id: d.id, title: d.title, note: d.statusNote }));

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t({ ro: "Bucla de reparare a documentației", ru: "Петля исправления документации" })}</h1>
        <p className="max-w-3xl text-muted">
          {t({ ro: "Vederea pentru angajați: întrebări fără răspuns, posibile contradicții, citări semnalate, evaluări și tichete demo. Fiecare element poate primi o stare de revizuire.", ru: "Вид для сотрудников: вопросы без ответа, возможные противоречия, отмеченные цитаты, оценки и демо-заявки. Каждому элементу можно назначить статус проверки." })}
        </p>
        <Notice tone="demo" title={t({ ro: "Prototip de flux de lucru", ru: "Прототип рабочего процесса" })}>
          {t({ ro: "Angajații Primăriei NU primesc și NU procesează aceste elemente. Datele provin doar din utilizarea acestui prototip, pe acest computer. Nu există autentificare — într-o implementare reală această pagină ar fi protejată.", ru: "Сотрудники Примэрии НЕ получают и НЕ обрабатывают эти элементы. Данные — только из использования этого прототипа на этом компьютере. Аутентификации нет — в реальном внедрении эта страница была бы защищена." })}
        </Notice>
      </header>
      <StaffClient items={items} tickets={tks} conflicts={corpusConflicts()} unknownValidity={unknownValidity} />
    </div>
  );
}

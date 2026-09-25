import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLang } from "@/lib/i18n/server";
import { fmtDate, tr } from "@/lib/i18n";
import { DOCS, DOC_BY_ID, TARIFF_TIMELINE } from "@/lib/corpus/docs";
import { PASSAGES, PASSAGE_BY_ID } from "@/lib/corpus/passages";
import { FACTS } from "@/lib/corpus/facts";
import { DemoBadge, ExternalLink, Notice, RealBadge } from "@/components/ui";

export function generateStaticParams() {
  return DOCS.map((d) => ({ id: d.id }));
}

export async function generateMetadata(props: PageProps<"/surse/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  return { title: DOC_BY_ID.get(id)?.title ?? "Sursă" };
}

export default async function SourceDetail(props: PageProps<"/surse/[id]">) {
  const { id } = await props.params;
  const d = DOC_BY_ID.get(id);
  if (!d) notFound();
  const lang = await getLang();
  const t = (x: { ro: string; ru: string }) => tr(x, lang);
  const passages = PASSAGES.filter((p) => p.docId === d.id);

  const meta: [string, React.ReactNode][] = [
    [t({ ro: "Emitent / responsabil", ru: "Издатель / ответственный" }), d.publisher],
    [t({ ro: "Tip", ru: "Тип" }), d.docType[lang]],
    [t({ ro: "Limba", ru: "Язык" }), d.lang === "ro" ? "română" : "русский"],
    [t({ ro: "Data publicării", ru: "Дата публикации" }), d.publishedAt ? fmtDate(d.publishedAt, lang) : t({ ro: "neindicată", ru: "не указана" })],
    [t({ ro: "În vigoare din", ru: "Действует с" }), d.effectiveAt ? fmtDate(d.effectiveAt, lang) : t({ ro: "neindicat", ru: "не указано" })],
    [t({ ro: "Revizuire", ru: "Редакция" }), d.revisedAt ? fmtDate(d.revisedAt, lang) : t({ ro: "neindicată", ru: "не указана" })],
    [t({ ro: "Preluat", ru: "Получено" }), fmtDate(d.retrievedAt, lang)],
    [t({ ro: "Categorie Anexa 1", ru: "Категория Приложения 1" }), d.annexCategory ?? "—"],
    [t({ ro: "URL de pornire din anexă", ru: "Стартовый URL из приложения" }), d.annexStartUrl ?? "—"],
  ];

  return (
    <div className="space-y-6">
      <nav aria-label={t({ ro: "Fir de navigare", ru: "Навигационная цепочка" })} className="text-sm">
        <Link href="/surse" className="link">{t({ ro: "Surse", ru: "Источники" })}</Link> <span aria-hidden="true">›</span> <span>{d.id}</span>
      </nav>
      <header className="space-y-2">
        <div className="flex flex-wrap gap-2">{d.kind === "demo" ? <DemoBadge lang={lang} /> : <RealBadge lang={lang} />}</div>
        <h1 lang={d.lang} className="text-2xl font-bold tracking-tight sm:text-3xl">{d.title}</h1>
        {d.titleTranslation && d.titleTranslation[lang] !== d.title && <p className="text-muted">{d.titleTranslation[lang]}</p>}
        {d.url ? (
          <p><ExternalLink href={d.url} lang={lang}>{d.url}</ExternalLink></p>
        ) : (
          <Notice tone="demo" title={t({ ro: "Document fictiv", ru: "Вымышленный документ" })}>{d.statusNote[lang]}</Notice>
        )}
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="pas-h" className="space-y-3">
          <h2 id="pas-h" className="text-xl font-bold">{t({ ro: "Pasaje citabile", ru: "Цитируемые фрагменты" })} ({passages.length})</h2>
          <ol className="space-y-3">
            {passages.map((p) => {
              const usedBy = FACTS.filter((f) => f.cites.some((c) => c.passageId === p.id));
              return (
                <li key={p.id} id={p.id} className="card scroll-mt-4 p-4 target:border-brand target:ring-2 target:ring-brand">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">{p.locator[lang]}</p>
                  <blockquote lang={p.lang} className="mt-1 border-l-4 border-brand pl-3">{p.text}</blockquote>
                  {p.unofficialTranslation?.[lang] && (
                    <p className="mt-2 text-sm text-muted"><span className="font-semibold">{t({ ro: "Traducere neoficială:", ru: "Неофициальный перевод:" })}</span> <span lang={lang}>{p.unofficialTranslation[lang]}</span></p>
                  )}
                  {usedBy.length > 0 && (
                    <p className="mt-2 text-xs text-muted">
                      {t({ ro: "Susține afirmațiile:", ru: "Подтверждает утверждения:" })} {usedBy.map((f) => f.id).join(", ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        <aside className="space-y-4">
          <section aria-labelledby="meta-h" className="card p-4">
            <h2 id="meta-h" className="font-bold">{t({ ro: "Metadate", ru: "Метаданные" })}</h2>
            <dl className="mt-2 space-y-2 text-sm">
              {meta.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted">{k}</dt>
                  <dd className="break-words">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="val-h" className="card p-4">
            <h2 id="val-h" className="font-bold">{t({ ro: "Valabilitate", ru: "Действительность" })}</h2>
            <p className={`mt-1 text-sm ${d.status === "declared_in_force" ? "text-ok" : d.kind === "demo" ? "text-demo" : "text-warn"}`}>
              <span aria-hidden="true">{d.status === "declared_in_force" ? "✓ " : d.kind === "demo" ? "◇ " : "? "}</span>
              {d.statusNote[lang]}
            </p>
            {d.notes && <p className="mt-2 text-sm text-muted">{d.notes[lang]}</p>}
          </section>

          {d.relations && d.relations.length > 0 && (
            <section aria-labelledby="rel-h" className="card p-4">
              <h2 id="rel-h" className="font-bold">{t({ ro: "Relații cu alte documente", ru: "Связи с другими документами" })}</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {d.relations.map((r) => {
                  const target = DOC_BY_ID.get(r.target);
                  return (
                    <li key={r.type + r.target}>
                      <span className="font-semibold">{r.type}</span>{" "}
                      {target ? <Link className="link" href={`/surse/${target.id}`}>{target.title}</Link> : <span>{r.target}</span>}
                      <span className={`block ${r.established ? "text-ok" : "text-warn"}`}>
                        {r.established ? t({ ro: "✓ stabilită în text", ru: "✓ установлено в тексте" }) : t({ ro: "? nestabilită — necesită verificare umană", ru: "? не установлено — нужна проверка человеком" })}
                      </span>
                      <span className="block text-muted">{r.note[lang]}</span>
                      {r.evidencePassageId && PASSAGE_BY_ID.has(r.evidencePassageId) && (
                        <a className="link" href={`#${encodeURIComponent(r.evidencePassageId)}`}>{t({ ro: "vezi pasajul", ru: "см. фрагмент" })}</a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {d.id === "acc-tarif" && (
        <section aria-labelledby="tl-h" className="card p-4 sm:p-5">
          <h2 id="tl-h" className="text-xl font-bold">{t({ ro: "Cronologia versiunilor (din tabelul de istoric al paginii)", ru: "Хронология версий (из таблицы истории на странице)" })}</h2>
          <p className="text-sm text-muted">{t({ ro: "Consumatori casnici, fără TVA, lei/m³. Hotărârea nr. 479 abrogă explicit hotărârea nr. 120 (pct. 5).", ru: "Бытовые потребители, без НДС, лей/м³. Постановление № 479 прямо отменяет № 120 (п. 5)." })}</p>
          <ol className="mt-4 space-y-3 border-l-2 border-brand/40 pl-5">
            {TARIFF_TIMELINE.map((v) => (
              <li key={v.date} className="relative">
                <span aria-hidden="true" className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ${v.current ? "bg-ok" : "bg-line"}`} />
                <p className="font-bold">
                  {fmtDate(v.date, lang)} — {v.act}{" "}
                  {v.current ? (
                    <span className="rounded bg-ok-soft px-1.5 text-xs text-ok">{t({ ro: "✓ declarat în vigoare", ru: "✓ заявлен действующим" })}</span>
                  ) : (
                    <span className="rounded bg-none-soft px-1.5 text-xs text-none">{t({ ro: "versiune anterioară", ru: "предыдущая версия" })}</span>
                  )}
                </p>
                <p className="text-sm">
                  {t({ ro: "Apă potabilă", ru: "Питьевая вода" })}: <strong>{v.potable}</strong> · {t({ ro: "Canalizare", ru: "Канализация" })}: <strong>{v.sewer}</strong>{" "}
                  <a className="link text-xs" href={`#${encodeURIComponent(v.passageId)}`}>{t({ ro: "rândul din tabel", ru: "строка таблицы" })}</a>
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

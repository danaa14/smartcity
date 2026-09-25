import type { Metadata } from "next";
import Link from "next/link";
import { getLang } from "@/lib/i18n/server";
import { fmtDate, tr } from "@/lib/i18n";
import { DOCS } from "@/lib/corpus/docs";
import { PASSAGES } from "@/lib/corpus/passages";
import { INVENTORY, INVENTORY_STATS } from "@/lib/corpus/inventory";
import { searchPassages } from "@/lib/retrieval";
import { DemoBadge, ExternalLink, RealBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Surse" };

export default async function SourcesPage(props: PageProps<"/surse">) {
  const lang = await getLang();
  const t = (x: { ro: string; ru: string }) => tr(x, lang);
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 200) : "";
  const hits = q ? searchPassages(q) : [];
  const cats = [...new Set(INVENTORY.map((r) => r.category))];

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t({ ro: "Sursele asistentului", ru: "Источники помощника" })}</h1>
        <p className="max-w-3xl text-muted">
          {t({ ro: "Asistentul răspunde doar din aceste documente. Sursele reale au fost descărcate și verificate la 25.09.2026; fiecare pasaj citat a fost verificat automat că apare exact în pagina preluată. Documentele DEMO sunt fictive și marcate ca atare.", ru: "Помощник отвечает только по этим документам. Реальные источники загружены и проверены 25.09.2026; каждый цитируемый фрагмент автоматически проверен на точное наличие в загруженной странице. DEMO-документы вымышлены и помечены." })}
        </p>
      </header>

      <form action="/surse" className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="sq" className="field-label">{t({ ro: "Căutați în pasajele indexate", ru: "Поиск по проиндексированным фрагментам" })}</label>
          <input id="sq" name="q" defaultValue={q} className="input" />
        </div>
        <button className="btn btn-primary">{t({ ro: "Caută", ru: "Искать" })}</button>
      </form>
      {q && (
        <section aria-labelledby="hits-h" className="space-y-2">
          <h2 id="hits-h" className="text-lg font-bold">
            {hits.length} {t({ ro: "pasaje pentru", ru: "фрагментов по запросу" })} „{q}”
          </h2>
          {hits.length === 0 && <p className="text-muted">{t({ ro: "Niciun pasaj nu conține acești termeni.", ru: "Ни один фрагмент не содержит этих слов." })}</p>}
          <ul className="space-y-2">
            {hits.map(({ passage: p }) => {
              const d = DOCS.find((x) => x.id === p.docId)!;
              return (
                <li key={p.id} className="card p-3">
                  <Link href={`/surse/${d.id}#${encodeURIComponent(p.id)}`} className="link font-semibold">{d.titleTranslation?.[lang] ?? d.title}</Link>
                  <span className="ml-2 text-sm text-muted">{p.locator[lang]}</span>
                  <p lang={p.lang} className="mt-1 text-sm">{p.text}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="corpus-h" className="space-y-3">
        <h2 id="corpus-h" className="text-xl font-bold">{t({ ro: "Documente în corpus", ru: "Документы в корпусе" })} ({DOCS.length})</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {DOCS.map((d) => (
            <li key={d.id} className="card flex flex-col gap-1.5 p-4">
              <div className="flex flex-wrap gap-1.5">{d.kind === "demo" ? <DemoBadge lang={lang} /> : <RealBadge lang={lang} />}<span className="text-xs text-muted">{d.docType[lang]}</span></div>
              <Link href={`/surse/${d.id}`} className="link font-bold">{d.titleTranslation?.[lang] ?? d.title}</Link>
              <p className="text-sm text-muted">{d.publisher}</p>
              <p className="text-sm">
                {PASSAGES.filter((p) => p.docId === d.id).length} {t({ ro: "pasaje citabile", ru: "цитируемых фрагментов" })} · {t({ ro: "preluat", ru: "получено" })} {fmtDate(d.retrievedAt, lang)}
                {d.status === "declared_in_force" && <> · <span className="font-semibold text-ok">✓ {t({ ro: "declarat în vigoare", ru: "заявлен действующим" })}</span></>}
                {d.status === "unknown" && <> · <span className="text-warn">? {t({ ro: "valabilitate nestabilită", ru: "действительность не установлена" })}</span></>}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="inv-h" className="space-y-3">
        <h2 id="inv-h" className="text-xl font-bold">{t({ ro: "Inventarul surselor din Anexa 1", ru: "Инвентарь источников из Приложения 1" })}</h2>
        <p className="text-muted">
          {INVENTORY_STATS.total} {t({ ro: "URL-uri de pornire verificate", ru: "стартовых URL проверено" })} · {INVENTORY_STATS.accessible} {t({ ro: "accesibile", ru: "доступны" })} ·{" "}
          <strong className="text-ink">{INVENTORY_STATS.processedStartUrls} {t({ ro: "procesate", ru: "обработаны" })}</strong> ({INVENTORY_STATS.processedDocs} {t({ ro: "pagini/documente concrete", ru: "конкретных страниц/документов" })}).{" "}
          {t({ ro: "Un site accesibil nu înseamnă că informația lui a fost ingerată.", ru: "Доступность сайта не означает, что его информация загружена." })}
        </p>
        {cats.map((c) => (
          <details key={c} className="card p-3" open={INVENTORY.some((r) => r.category === c && r.processed.length)}>
            <summary className="cursor-pointer font-bold">
              {c} <span className="font-normal text-muted">({INVENTORY.filter((r) => r.category === c).length} URL · {INVENTORY.filter((r) => r.category === c && r.processed.length).length} {t({ ro: "procesate", ru: "обработано" })})</span>
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[46rem] border-collapse text-sm">
                <caption className="sr-only">{c}</caption>
                <thead>
                  <tr className="border-b border-line text-left">
                    <th scope="col" className="p-2">{t({ ro: "URL de pornire", ru: "Стартовый URL" })}</th>
                    <th scope="col" className="p-2">{t({ ro: "Acces", ru: "Доступ" })}</th>
                    <th scope="col" className="p-2">{t({ ro: "Pagini/documente găsite și procesate", ru: "Найденные и обработанные страницы/документы" })}</th>
                    <th scope="col" className="p-2">{t({ ro: "Note", ru: "Примечания" })}</th>
                  </tr>
                </thead>
                <tbody>
                  {INVENTORY.filter((r) => r.category === c).map((r) => (
                    <tr key={r.startUrl} className="border-b border-line align-top">
                      <td className="p-2">
                        <span className="break-all">{r.startUrl}</span>
                        {r.homeTitle && <span className="block text-xs text-muted">„{r.homeTitle}” · lang={r.htmlLang ?? "—"}</span>}
                      </td>
                      <td className="whitespace-nowrap p-2">
                        {r.accessible ? <span className="text-ok">✓ HTTP 200</span> : <span className="text-bad">✗ {r.httpStatus}</span>}
                        {r.jsOnly && <span className="block text-xs text-warn">{t({ ro: "doar JavaScript", ru: "только JavaScript" })}</span>}
                        <span className="block text-xs text-muted">{r.probedAt}</span>
                      </td>
                      <td className="p-2">
                        {r.processed.length ? (
                          <ul className="space-y-1">
                            {r.processed.map((p) => (
                              <li key={p.docId}>
                                <Link href={`/surse/${p.docId}`} className="link">{p.title}</Link>
                                <span className="block text-xs text-muted">
                                  {p.publisher} · {p.lang.toUpperCase()} · {t({ ro: "citabil pe pasaje", ru: "цитируется по фрагментам" })}
                                  {p.effectiveAt && ` · ${t({ ro: "în vigoare", ru: "действует с" })} ${p.effectiveAt}`}
                                  {p.revisedAt && ` · ${t({ ro: "rev.", ru: "ред." })} ${p.revisedAt}`}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted">{t({ ro: "— neprocesat", ru: "— не обработано" })}</span>
                        )}
                      </td>
                      <td className="p-2 text-muted">{r.note[lang]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
        <p className="text-sm text-muted">
          {t({ ro: "Date brute: ", ru: "Сырые данные: " })}<code>corpus/annex-probe.json</code>, <code>corpus/raw/</code>. {t({ ro: "Export CSV:", ru: "Экспорт CSV:" })}{" "}
          <a className="link" href="/api/inventory">/api/inventory</a>
        </p>
        <p className="text-sm">
          <ExternalLink href="https://www.chisinau.md/ro" lang={lang}>chisinau.md</ExternalLink>
        </p>
      </section>
    </div>
  );
}

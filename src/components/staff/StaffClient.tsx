"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLang } from "../LangProvider";
import { DemoBadge, StatusBadge } from "../ui";
import { Highlight } from "../ask/AnswerView";
import type { ReviewItem, ReviewState } from "@/lib/feedback";
import type { Ticket } from "@/lib/tickets/types";
import { CATEGORIES } from "@/lib/tickets/types";
import type { L10n, Passage } from "@/lib/corpus/types";
import { fmtDateTime } from "@/lib/i18n";

export interface ConflictCandidate {
  group: string;
  sides: { value: string; quote: string; passage: Passage; doc: { id: string; title: string; kind: "real" | "demo"; publishedAt?: string; revisedAt?: string } }[];
}

type Tab = "gaps" | "conflicts" | "citations" | "ratings" | "tickets";

const STATE_LABEL: Record<ReviewState, L10n> = {
  new: { ro: "Nou", ru: "Новый" },
  in_review: { ro: "În verificare", ru: "На проверке" },
  resolved: { ro: "Rezolvat", ru: "Решено" },
  dismissed: { ro: "Respins", ru: "Отклонено" },
};
const REASON: Record<string, L10n> = {
  wrong_passage: { ro: "Pasajul nu susține afirmația", ru: "Фрагмент не подтверждает утверждение" },
  outdated: { ro: "Informație depășită", ru: "Устаревшая информация" },
  misread: { ro: "Interpretare greșită", ru: "Неверное толкование" },
  other: { ro: "Altceva", ru: "Другое" },
};

export function StaffClient({ items: initial, tickets, conflicts, unknownValidity }: { items: ReviewItem[]; tickets: Ticket[]; conflicts: ConflictCandidate[]; unknownValidity: { id: string; title: string; note: L10n }[] }) {
  const { lang, t } = useLang();
  const [items, setItems] = useState(initial);
  const [tab, setTab] = useState<Tab>("gaps");
  const [stateFilter, setStateFilter] = useState<ReviewState | "all">("all");
  const [langFilter, setLangFilter] = useState<"all" | "ro" | "ru">("all");
  const [msg, setMsg] = useState("");

  const byKind = (kinds: ReviewItem["kind"][]) =>
    items.filter((i) => kinds.includes(i.kind) && (stateFilter === "all" || i.state === stateFilter) && (langFilter === "all" || i.lang === langFilter));
  const gaps = byKind(["unanswered", "partial"]);
  const conflictReports = byKind(["conflict"]);
  const citations = byKind(["citation_report"]);
  const ratings = byKind(["rating"]);

  const stats = useMemo(() => {
    const r = items.filter((i) => i.kind === "rating");
    const useful = r.filter((i) => i.useful).length;
    return { ratings: r.length, useful, pct: r.length ? Math.round((useful / r.length) * 100) : null };
  }, [items]);

  const setState = async (id: string, state: ReviewState) => {
    const r = await fetch("/api/review", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, state }) }).catch(() => null);
    if (r?.ok) {
      setItems((xs) => xs.map((x) => (x.id === id ? { ...x, state } : x)));
      setMsg(t({ ro: `Stare actualizată: ${STATE_LABEL[state].ro}`, ru: `Статус обновлён: ${STATE_LABEL[state].ru}` }));
    } else setMsg(t({ ro: "Actualizarea a eșuat.", ru: "Не удалось обновить." }));
  };

  const tabs: { id: Tab; label: L10n; count: number }[] = [
    { id: "gaps", label: { ro: "Lacune în corpus", ru: "Пробелы в корпусе" }, count: items.filter((i) => (i.kind === "unanswered" || i.kind === "partial") && i.state === "new").length },
    { id: "conflicts", label: { ro: "Contradicții", ru: "Противоречия" }, count: conflicts.length },
    { id: "citations", label: { ro: "Citări semnalate", ru: "Отмеченные цитаты" }, count: items.filter((i) => i.kind === "citation_report" && i.state === "new").length },
    { id: "ratings", label: { ro: "Evaluări", ru: "Оценки" }, count: stats.ratings },
    { id: "tickets", label: { ro: "Tichete demo", ru: "Демо-заявки" }, count: tickets.length },
  ];

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          [t({ ro: "Lacune noi", ru: "Новые пробелы" }), items.filter((i) => (i.kind === "unanswered" || i.kind === "partial") && i.state === "new").length],
          [t({ ro: "Contradicții candidate", ru: "Кандидаты в противоречия" }), conflicts.length],
          [t({ ro: "Citări semnalate", ru: "Отмеченные цитаты" }), items.filter((i) => i.kind === "citation_report").length],
          [t({ ro: "Utilitate", ru: "Полезность" }), stats.pct == null ? "—" : `${stats.pct}% (${stats.useful}/${stats.ratings})`],
        ].map(([k, v]) => (
          <div key={String(k)} className="card p-3">
            <dt className="text-sm text-muted">{k}</dt>
            <dd className="text-2xl font-bold">{v}</dd>
          </div>
        ))}
      </dl>

      <div role="tablist" aria-label={t({ ro: "Categorii de revizuire", ru: "Категории проверки" })} className="flex flex-wrap gap-1 border-b border-line">
        {tabs.map((x) => (
          <button
            key={x.id}
            role="tab"
            id={`tab-${x.id}`}
            aria-selected={tab === x.id}
            aria-controls={`panel-${x.id}`}
            tabIndex={tab === x.id ? 0 : -1}
            onClick={() => setTab(x.id)}
            onKeyDown={(e) => {
              const i = tabs.findIndex((y) => y.id === tab);
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                const n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length].id;
                setTab(n);
                document.getElementById(`tab-${n}`)?.focus();
              }
            }}
            className={`-mb-px min-h-11 rounded-t-lg border border-b-0 px-3 text-sm font-semibold ${tab === x.id ? "border-line bg-white text-brand-dark" : "border-transparent text-muted hover:text-ink"}`}
          >
            {x.label[lang]} <span className="ml-1 rounded-full bg-none-soft px-1.5 text-xs">{x.count}</span>
          </button>
        ))}
      </div>

      {tab !== "conflicts" && tab !== "tickets" && (
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm">
            {t({ ro: "Stare", ru: "Статус" })}
            <select className="input w-auto py-1.5 text-sm" value={stateFilter} onChange={(e) => setStateFilter(e.target.value as ReviewState | "all")}>
              <option value="all">{t({ ro: "Toate", ru: "Все" })}</option>
              {(Object.keys(STATE_LABEL) as ReviewState[]).map((s) => <option key={s} value={s}>{STATE_LABEL[s][lang]}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            {t({ ro: "Limba", ru: "Язык" })}
            <select className="input w-auto py-1.5 text-sm" value={langFilter} onChange={(e) => setLangFilter(e.target.value as "all" | "ro" | "ru")}>
              <option value="all">{t({ ro: "Toate", ru: "Все" })}</option>
              <option value="ro">RO</option>
              <option value="ru">RU</option>
            </select>
          </label>
        </div>
      )}
      <p aria-live="polite" className="sr-only">{msg}</p>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="space-y-3">
        {tab === "gaps" &&
          (gaps.length === 0 ? (
            <Empty text={{ ro: "Nicio întrebare fără răspuns încă. Puneți o întrebare pe „Întreabă primăria” (de ex. despre grădiniță) ca să vedeți cum apare aici.", ru: "Пока нет вопросов без ответа. Задайте вопрос в «Спросить примэрию» (напр. о детском саде), чтобы увидеть, как он появится здесь." }} />
          ) : (
            gaps.map((g) => (
              <article key={g.id} className="card space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {g.answerStatus && <StatusBadge status={g.answerStatus} lang={lang} size="sm" />}
                    <span className="text-xs text-muted">{g.lang.toUpperCase()} · {fmtDateTime(g.createdAt, lang)} · {g.topicId ?? t({ ro: "fără subiect", ru: "без темы" })}</span>
                  </div>
                  <StateControl item={g} onChange={setState} />
                </div>
                <p className="font-semibold">„{g.question}”</p>
                {g.missing && g.missing.length > 0 && (
                  <ul className="list-disc pl-5 text-sm text-muted">{g.missing.map((m, i) => <li key={i}>{m}</li>)}</ul>
                )}
                <p className="text-sm">
                  <span className="font-semibold">{t({ ro: "Acțiune propusă: ", ru: "Предлагаемое действие: " })}</span>
                  {g.kind === "unanswered"
                    ? t({ ro: "identificați documentul oficial care răspunde și adăugați-l în corpus, sau publicați informația.", ru: "найдите официальный документ с ответом и добавьте его в корпус или опубликуйте информацию." })
                    : t({ ro: "completați informația lipsă pe pagina de serviciu (termen, cost, canal).", ru: "дополните недостающую информацию на странице услуги (срок, стоимость, канал)." })}
                </p>
              </article>
            ))
          ))}

        {tab === "conflicts" && (
          <>
            {conflicts.map((c) => (
              <article key={c.group} className="card space-y-3 border-bad p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-bad">⚠ {t({ ro: "Posibilă contradicție:", ru: "Возможное противоречие:" })} {c.group}</h3>
                  {c.sides.some((s) => s.doc.kind === "demo") && <DemoBadge lang={lang} />}
                  <span className="text-sm text-muted">
                    {conflictReports.filter((r) => r.conflictGroup === c.group).length} {t({ ro: "întrebări au declanșat-o", ru: "вопросов её вызвали" })}
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {c.sides.map((s) => (
                    <figure key={s.passage.id} className="rounded-lg bg-paper p-3 text-sm">
                      <figcaption className="mb-1">
                        <Link className="link font-semibold" href={`/surse/${s.doc.id}#${encodeURIComponent(s.passage.id)}`}>{s.doc.title}</Link>
                        <span className="block text-xs text-muted">
                          {s.passage.locator[lang]} · {s.doc.publishedAt && `publ. ${s.doc.publishedAt}`} {s.doc.revisedAt && `rev. ${s.doc.revisedAt}`}
                        </span>
                      </figcaption>
                      <blockquote lang={s.passage.lang} className="border-l-4 border-bad pl-2"><Highlight text={s.passage.text} quote={s.quote} /></blockquote>
                      <p className="mt-1">{t({ ro: "Valoare:", ru: "Значение:" })} <strong>{s.value}</strong></p>
                    </figure>
                  ))}
                </div>
                <p className="text-sm">
                  <span className="font-semibold">{t({ ro: "De decis de un om: ", ru: "Решает человек: " })}</span>
                  {t({ ro: "care document este în vigoare, dacă pagina de ghișeu trebuie corectată și ce relație juridică există între cele două. Sistemul nu presupune că documentul mai nou prevalează.", ru: "какой документ действует, нужно ли исправить страницу окна и каково правовое соотношение документов. Система не предполагает, что новый документ имеет приоритет." })}
                </p>
              </article>
            ))}
            <article className="card p-4">
              <h3 className="font-bold">{t({ ro: "Surse reale cu valabilitate nestabilită", ru: "Реальные источники с неустановленной действительностью" })} ({unknownValidity.length})</h3>
              <p className="text-sm text-muted">{t({ ro: "Nu sunt contradicții, dar paginile nu indică data sau actul de aprobare. Merită confirmate de proprietarul informației.", ru: "Это не противоречия, но на страницах нет даты или акта утверждения. Стоит подтвердить у владельца информации." })}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {unknownValidity.map((u) => (
                  <li key={u.id}><Link href={`/surse/${u.id}`} className="link">{u.title}</Link> — <span className="text-muted">{u.note[lang]}</span></li>
                ))}
              </ul>
            </article>
          </>
        )}

        {tab === "citations" &&
          (citations.length === 0 ? (
            <Empty text={{ ro: "Nicio citare semnalată. Utilizatorii pot semnala din panoul de dovezi al unui răspuns.", ru: "Нет отмеченных цитат. Пользователи могут сообщить из панели доказательств ответа." }} />
          ) : (
            citations.map((c) => (
              <article key={c.id} className="card space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">⚑ {c.reportReason && REASON[c.reportReason][lang]}</span>
                  <StateControl item={c} onChange={setState} />
                </div>
                <p className="text-sm">
                  {t({ ro: "Pasaj:", ru: "Фрагмент:" })}{" "}
                  <Link className="link" href={`/surse/${c.passageId?.split("#")[0]}#${encodeURIComponent(c.passageId ?? "")}`}>{c.passageId}</Link> · {t({ ro: "afirmație:", ru: "утверждение:" })} {c.claimId}
                </p>
                {c.question && <p className="text-sm text-muted">{t({ ro: "Întrebare:", ru: "Вопрос:" })} „{c.question}”</p>}
                {c.comment && <p className="rounded bg-paper p-2 text-sm">„{c.comment}”</p>}
                <p className="text-xs text-muted">{c.lang.toUpperCase()} · {fmtDateTime(c.createdAt, lang)}</p>
              </article>
            ))
          ))}

        {tab === "ratings" &&
          (ratings.length === 0 ? (
            <Empty text={{ ro: "Nicio evaluare încă.", ru: "Оценок пока нет." }} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse bg-white text-sm">
                <caption className="sr-only">{t({ ro: "Evaluări", ru: "Оценки" })}</caption>
                <thead>
                  <tr className="border-b border-line text-left">
                    <th scope="col" className="p-2">{t({ ro: "Util?", ru: "Полезно?" })}</th>
                    <th scope="col" className="p-2">{t({ ro: "Întrebare", ru: "Вопрос" })}</th>
                    <th scope="col" className="p-2">{t({ ro: "Stare răspuns", ru: "Статус ответа" })}</th>
                    <th scope="col" className="p-2">{t({ ro: "Comentariu", ru: "Комментарий" })}</th>
                    <th scope="col" className="p-2">{t({ ro: "Revizuire", ru: "Проверка" })}</th>
                  </tr>
                </thead>
                <tbody>
                  {ratings.map((r) => (
                    <tr key={r.id} className="border-b border-line align-top">
                      <td className="p-2 font-semibold">{r.useful ? `👍 ${t({ ro: "Da", ru: "Да" })}` : `👎 ${t({ ro: "Nu", ru: "Нет" })}`}</td>
                      <td className="p-2">{r.question}</td>
                      <td className="p-2">{r.answerStatus && <StatusBadge status={r.answerStatus} lang={lang} size="sm" />}</td>
                      <td className="p-2">{r.comment ?? "—"}</td>
                      <td className="p-2"><StateControl item={r} onChange={setState} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {tab === "tickets" &&
          (tickets.length === 0 ? (
            <Empty text={{ ro: "Niciun tichet demo.", ru: "Демо-заявок нет." }} />
          ) : (
            <ul className="space-y-2">
              {tickets.map((k) => (
                <li key={k.id} className="card flex flex-wrap items-center gap-3 p-3">
                  <Link href={`/tichet/${k.id}`} className="link font-mono font-bold">{k.id}</Link>
                  <DemoBadge lang={lang} />
                  <span className="text-sm">{CATEGORIES.find((c) => c.id === k.category)?.label[lang]}</span>
                  <span className="text-sm text-muted">{k.location.text}</span>
                  <span className="ml-auto text-xs text-muted">{k.channel === "phone-demo" ? "☏ " : ""}{fmtDateTime(k.createdAt, lang)} · {t({ ro: "netrimis", ru: "не отправлено" })}</span>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </div>
  );
}

function StateControl({ item, onChange }: { item: ReviewItem; onChange: (id: string, s: ReviewState) => void }) {
  const { lang, t } = useLang();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">{t({ ro: "Stare:", ru: "Статус:" })}</span>
      <select value={item.state} onChange={(e) => onChange(item.id, e.target.value as ReviewState)} className="input w-auto py-1.5 text-sm">
        {(Object.keys(STATE_LABEL) as ReviewState[]).map((s) => (
          <option key={s} value={s}>{STATE_LABEL[s][lang]}</option>
        ))}
      </select>
    </label>
  );
}

function Empty({ text }: { text: L10n }) {
  const { lang } = useLang();
  return <p className="rounded-lg border border-dashed border-line bg-white p-4 text-muted">{text[lang]}</p>;
}

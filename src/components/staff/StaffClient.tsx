"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "../LangProvider";
import { Highlight } from "../ask/AnswerView";
import type { ReviewItem, ReviewState } from "@/lib/feedback";
import type { Ticket } from "@/lib/tickets/types";
import { CATEGORIES } from "@/lib/tickets/types";
import type { L10n, Passage } from "@/lib/corpus/types";
import type { StaffMetrics } from "@/lib/staff/metrics";
import { fmtDateTime } from "@/lib/i18n";
import { CoverageSection, EvidenceSection, TicketAnalytics } from "./StaffCharts";

export interface ConflictCandidate {
  group: string;
  sides: { value: string; quote: string; passage: Passage; doc: { id: string; title: string; kind: "real" | "demo"; publishedAt?: string; revisedAt?: string } }[];
}

type Section = "overview" | "coverage" | "gaps" | "conflicts" | "citations" | "ratings" | "tickets" | "evidence";

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
const STATUS_LABEL: Record<string, L10n> = {
  supported: { ro: "Susținut", ru: "Подтверждено" },
  partial: { ro: "Parțial", ru: "Частично" },
  missing: { ro: "Lipsă", ru: "Нет данных" },
  contradiction: { ro: "Contradicție", ru: "Противоречие" },
};

export function StaffClient({ items: initial, tickets, conflicts, unknownValidity, metrics }: { items: ReviewItem[]; tickets: Ticket[]; conflicts: ConflictCandidate[]; unknownValidity: { id: string; title: string; note: L10n }[]; metrics: StaffMetrics }) {
  const { lang, t } = useLang();
  const [items, setItems] = useState(initial);
  const [section, setSection] = useState<Section>("overview");
  const [stateFilter, setStateFilter] = useState<ReviewState | "all">("all");
  const [langFilter, setLangFilter] = useState<"all" | "ro" | "ru">("all");
  const [msg, setMsg] = useState("");

  const byKind = (kinds: ReviewItem["kind"][]) =>
    items.filter((i) => kinds.includes(i.kind) && (stateFilter === "all" || i.state === stateFilter) && (langFilter === "all" || i.lang === langFilter));
  const gaps = byKind(["unanswered", "partial"]);
  const citations = byKind(["citation_report"]);
  const ratings = byKind(["rating"]);
  const conflictReports = byKind(["conflict"]);

  const stats = useMemo(() => {
    const r = items.filter((i) => i.kind === "rating");
    const useful = r.filter((i) => i.useful).length;
    const openGaps = items.filter((i) => (i.kind === "unanswered" || i.kind === "partial") && i.state === "new").length;
    return { ratings: r.length, useful, pct: r.length ? Math.round((useful / r.length) * 100) : null, openGaps };
  }, [items]);

  const setState = async (id: string, state: ReviewState) => {
    const r = await fetch("/api/review", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, state }) }).catch(() => null);
    if (r?.ok) {
      setItems((xs) => xs.map((x) => (x.id === id ? { ...x, state } : x)));
      setMsg(t({ ro: `Stare actualizată: ${STATE_LABEL[state].ro}`, ru: `Статус обновлён: ${STATE_LABEL[state].ru}` }));
    } else setMsg(t({ ro: "Actualizarea a eșuat.", ru: "Не удалось обновить." }));
  };

  const nav: { id: Section; icon: string; label: L10n; count?: number }[] = [
    { id: "overview", icon: "◧", label: { ro: "Panoramă", ru: "Обзор" } },
    { id: "coverage", icon: "◈", label: { ro: "Acoperire", ru: "Покрытие" } },
    { id: "gaps", icon: "○", label: { ro: "Lacune", ru: "Пробелы" }, count: stats.openGaps },
    { id: "conflicts", icon: "⚠", label: { ro: "Contradicții", ru: "Противоречия" }, count: conflicts.length },
    { id: "citations", icon: "⚑", label: { ro: "Citări", ru: "Цитаты" }, count: items.filter((i) => i.kind === "citation_report" && i.state === "new").length },
    { id: "ratings", icon: "◍", label: { ro: "Evaluări", ru: "Оценки" }, count: stats.ratings },
    { id: "tickets", icon: "▤", label: { ro: "Tichete", ru: "Заявки" }, count: tickets.length },
    { id: "evidence", icon: "◫", label: { ro: "Dovezi", ru: "Доказательства" } },
  ];

  const filtersVisible = section === "gaps" || section === "citations" || section === "ratings";

  return (
    <div className="bo-shell">
      <nav className="bo-side" aria-label={t({ ro: "Secțiuni back office", ru: "Разделы бэк-офиса" })}>
        <span className="bo-side-label">{t({ ro: "SECȚIUNI", ru: "РАЗДЕЛЫ" })}</span>
        {nav.map((n) => (
          <button key={n.id} type="button" aria-current={section === n.id} onClick={() => setSection(n.id)}>
            <span className="bo-side-icon" aria-hidden="true">{n.icon}</span>
            <span>{n.label[lang]}</span>
            {n.count !== undefined && n.count > 0 && <span className="bo-side-count">{n.count}</span>}
          </button>
        ))}
      </nav>

      <div>
        <p aria-live="polite" className="sr-only">{msg}</p>

        {filtersVisible && (
          <div className="bo-filters">
            <label>
              {t({ ro: "STARE", ru: "СТАТУС" })}
              <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value as ReviewState | "all")}>
                <option value="all">{t({ ro: "Toate", ru: "Все" })}</option>
                {(Object.keys(STATE_LABEL) as ReviewState[]).map((s) => <option key={s} value={s}>{STATE_LABEL[s][lang]}</option>)}
              </select>
            </label>
            <label>
              {t({ ro: "LIMBA", ru: "ЯЗЫК" })}
              <select value={langFilter} onChange={(e) => setLangFilter(e.target.value as "all" | "ro" | "ru")}>
                <option value="all">{t({ ro: "Toate", ru: "Все" })}</option>
                <option value="ro">RO</option>
                <option value="ru">RU</option>
              </select>
            </label>
          </div>
        )}

        {section === "overview" && (
          <Overview stats={stats} conflicts={conflicts.length} tickets={tickets} unknownValidity={unknownValidity.length} metrics={metrics} onGo={setSection} />
        )}

        {section === "coverage" && <CoverageSection m={metrics} />}

        {section === "evidence" && <EvidenceSection m={metrics} />}

        {section === "gaps" && (
          <section className="bo-panel">
            <div className="bo-panel-head">
              <div>
                <h2>{t({ ro: "Lacune în corpus", ru: "Пробелы в корпусе" })}</h2>
                <p>{t({ ro: "Întrebări la care prototipul nu a putut răspunde cu o dovadă. Fiecare este o sarcină de documentare.", ru: "Вопросы, на которые прототип не смог ответить с доказательством. Каждый — задача по документации." })}</p>
              </div>
            </div>
            {gaps.length === 0 ? (
              <Empty text={{ ro: "Nicio întrebare fără răspuns încă. Pune o întrebare în conversație ca să vezi cum apare aici.", ru: "Пока нет вопросов без ответа. Задайте вопрос в диалоге, чтобы увидеть, как он появится здесь." }} />
            ) : (
              <div className="bo-rows">
                {gaps.map((g) => (
                  <article key={g.id} className="bo-row">
                    <div className="bo-row-top">
                      {g.answerStatus && <span className={`bo-pill ${g.answerStatus === "partial" ? "in_review" : "new"}`}>{STATUS_LABEL[g.answerStatus]?.[lang] ?? g.answerStatus}</span>}
                      <span className="bo-pill lang">{g.lang.toUpperCase()}</span>
                      <span>{fmtDateTime(g.createdAt, lang)}</span>
                      <span>· {g.topicId ?? t({ ro: "fără subiect", ru: "без темы" })}</span>
                      <span className={`bo-pill ${g.state}`} style={{ marginLeft: "auto" }}>{STATE_LABEL[g.state][lang]}</span>
                    </div>
                    <p className="bo-row-body">„{g.question}”</p>
                    {g.missing && g.missing.length > 0 && (
                      <p className="bo-row-meta">{t({ ro: "Lipsește:", ru: "Отсутствует:" })} {g.missing.join(" · ")}</p>
                    )}
                    <p className="bo-row-meta">
                      <strong>{t({ ro: "Acțiune propusă: ", ru: "Предлагаемое действие: " })}</strong>
                      {g.kind === "unanswered"
                        ? t({ ro: "identifică documentul oficial care răspunde și adaugă-l în corpus, sau publică informația.", ru: "найдите официальный документ с ответом и добавьте его в корпус или опубликуйте информацию." })
                        : t({ ro: "completează informația lipsă pe pagina de serviciu (termen, cost, canal).", ru: "дополните недостающую информацию на странице услуги (срок, стоимость, канал)." })}
                    </p>
                    <StateControl item={g} onChange={setState} />
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {section === "conflicts" && (
          <>
            <section className="bo-panel">
              <div className="bo-panel-head">
                <div>
                  <h2>{t({ ro: "Contradicții candidate", ru: "Кандидаты в противоречия" })}</h2>
                  <p>{t({ ro: "Două documente dau valori diferite pentru aceeași întrebare. Sistemul nu presupune că documentul mai nou prevalează.", ru: "Два документа дают разные значения для одного вопроса. Система не предполагает, что новый документ имеет приоритет." })}</p>
                </div>
              </div>
              {conflicts.length === 0 ? (
                <Empty text={{ ro: "Nicio contradicție detectată în corpus.", ru: "Противоречий в корпусе не обнаружено." }} />
              ) : (
                <div className="bo-rows">
                  {conflicts.map((c) => (
                    <article key={c.group} className="bo-row">
                      <div className="bo-row-top">
                        <span className="bo-pill in_review">⚠ {c.group}</span>
                        {c.sides.some((s) => s.doc.kind === "demo") && <span className="bo-pill demo">DEMO</span>}
                        <span>{conflictReports.filter((r) => r.conflictGroup === c.group).length} {t({ ro: "întrebări au declanșat-o", ru: "вопросов её вызвали" })}</span>
                      </div>
                      <div className="bo-side-by-side" style={{ marginTop: 12 }}>
                        {c.sides.map((s) => (
                          <figure key={s.passage.id} className="bo-side-card">
                            <figcaption>
                              <Link href={`/surse/${s.doc.id}#${encodeURIComponent(s.passage.id)}`} style={{ fontWeight: 600, fontSize: 13, textDecoration: "underline", textUnderlineOffset: 2 }}>{s.doc.title}</Link>
                              <span className="bo-row-meta" style={{ display: "block", marginTop: 4 }}>
                                {s.passage.locator[lang]}
                                {s.doc.publishedAt && ` · publ. ${s.doc.publishedAt}`}
                                {s.doc.revisedAt && ` · rev. ${s.doc.revisedAt}`}
                              </span>
                            </figcaption>
                            <p className="bo-side-value" style={{ margin: "10px 0" }}>{s.value}</p>
                            <blockquote lang={s.passage.lang} className="bo-quote"><Highlight text={s.passage.text} quote={s.quote} /></blockquote>
                          </figure>
                        ))}
                      </div>
                      <p className="bo-row-meta">
                        <strong>{t({ ro: "De decis de un om: ", ru: "Решает человек: " })}</strong>
                        {t({ ro: "care document este în vigoare, dacă pagina de ghișeu trebuie corectată și ce relație juridică există între cele două.", ru: "какой документ действует, нужно ли исправить страницу окна и каково правовое соотношение документов." })}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="bo-panel">
              <div className="bo-panel-head">
                <div>
                  <h2>{t({ ro: "Valabilitate nestabilită", ru: "Действительность не установлена" })} ({unknownValidity.length})</h2>
                  <p>{t({ ro: "Nu sunt contradicții, dar paginile nu indică data sau actul de aprobare. Merită confirmate de proprietarul informației.", ru: "Это не противоречия, но на страницах нет даты или акта утверждения. Стоит подтвердить у владельца информации." })}</p>
                </div>
              </div>
              <div className="bo-rows">
                {unknownValidity.map((u) => (
                  <article key={u.id} className="bo-row">
                    <Link href={`/surse/${u.id}`} style={{ fontWeight: 600, fontSize: 14, textDecoration: "underline", textUnderlineOffset: 2 }}>{u.title}</Link>
                    <p className="bo-row-meta">{u.note[lang]}</p>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {section === "citations" && (
          <section className="bo-panel">
            <div className="bo-panel-head">
              <div>
                <h2>{t({ ro: "Citări semnalate", ru: "Отмеченные цитаты" })}</h2>
                <p>{t({ ro: "Cititorii au marcat aceste pasaje ca nepotrivite pentru afirmația pe care o susțineau.", ru: "Читатели отметили эти фрагменты как не подходящие для утверждения, которое они подтверждали." })}</p>
              </div>
            </div>
            {citations.length === 0 ? (
              <Empty text={{ ro: "Nicio citare semnalată. Utilizatorii pot semnala din panoul de dovezi al unui răspuns.", ru: "Нет отмеченных цитат. Пользователи могут сообщить из панели доказательств ответа." }} />
            ) : (
              <div className="bo-rows">
                {citations.map((c) => (
                  <article key={c.id} className="bo-row">
                    <div className="bo-row-top">
                      <span className="bo-pill in_review">⚑ {c.reportReason && REASON[c.reportReason][lang]}</span>
                      <span className="bo-pill lang">{c.lang.toUpperCase()}</span>
                      <span>{fmtDateTime(c.createdAt, lang)}</span>
                      <span className={`bo-pill ${c.state}`} style={{ marginLeft: "auto" }}>{STATE_LABEL[c.state][lang]}</span>
                    </div>
                    <p className="bo-row-meta" style={{ marginTop: 10 }}>
                      {t({ ro: "Pasaj:", ru: "Фрагмент:" })}{" "}
                      <Link href={`/surse/${c.passageId?.split("#")[0]}#${encodeURIComponent(c.passageId ?? "")}`} style={{ textDecoration: "underline", textUnderlineOffset: 2 }}>{c.passageId}</Link>
                      {c.claimId && ` · ${t({ ro: "afirmație:", ru: "утверждение:" })} ${c.claimId}`}
                    </p>
                    {c.question && <p className="bo-row-body">„{c.question}”</p>}
                    {c.comment && <p className="bo-quote" style={{ marginTop: 9 }}>„{c.comment}”</p>}
                    <StateControl item={c} onChange={setState} />
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {section === "ratings" && (
          <section className="bo-panel">
            <div className="bo-panel-head">
              <div>
                <h2>{t({ ro: "Evaluări", ru: "Оценки" })}</h2>
                <p>{t({ ro: "Ce au spus cititorii despre utilitatea răspunsului primit.", ru: "Что читатели сказали о полезности полученного ответа." })}</p>
              </div>
              {stats.pct != null && <p style={{ fontSize: 13, color: "#7b8172" }}>{stats.pct}% {t({ ro: "utile", ru: "полезных" })} ({stats.useful}/{stats.ratings})</p>}
            </div>
            {ratings.length === 0 ? (
              <Empty text={{ ro: "Nicio evaluare încă.", ru: "Оценок пока нет." }} />
            ) : (
              <div className="bo-rows">
                {ratings.map((r) => (
                  <article key={r.id} className="bo-row">
                    <div className="bo-row-top">
                      <span className={`bo-pill ${r.useful ? "resolved" : "dismissed"}`}>{r.useful ? t({ ro: "Util", ru: "Полезно" }) : t({ ro: "Nu a ajutat", ru: "Не помогло" })}</span>
                      {r.answerStatus && <span className="bo-pill lang">{STATUS_LABEL[r.answerStatus]?.[lang] ?? r.answerStatus}</span>}
                      <span>{fmtDateTime(r.createdAt, lang)}</span>
                      <span className={`bo-pill ${r.state}`} style={{ marginLeft: "auto" }}>{STATE_LABEL[r.state][lang]}</span>
                    </div>
                    {r.question && <p className="bo-row-body">„{r.question}”</p>}
                    {r.comment && <p className="bo-quote" style={{ marginTop: 9 }}>„{r.comment}”</p>}
                    <StateControl item={r} onChange={setState} />
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {section === "tickets" && (
          <>
          <TicketAnalytics m={metrics.tickets} />
          <section className="bo-panel">
            <div className="bo-panel-head">
              <div>
                <h2>{t({ ro: "Tichete demo", ru: "Демо-заявки" })}</h2>
                <p>{t({ ro: "Sesizări create în acest prototip. Nu au fost trimise nicăieri.", ru: "Обращения, созданные в этом прототипе. Никуда не отправлены." })}</p>
              </div>
            </div>
            {tickets.length === 0 ? (
              <Empty text={{ ro: "Niciun tichet demo.", ru: "Демо-заявок нет." }} />
            ) : (
              <div className="bo-rows">
                {tickets.map((k) => (
                  <article key={k.id} className="bo-row">
                    <div className="bo-row-top">
                      <span className="bo-pill demo">DEMO</span>
                      <span className={`bo-pill ${(k.status ?? "active") === "done" ? "resolved" : "new"}`}>
                        {(k.status ?? "active") === "done" ? t({ ro: "Rezolvat", ru: "Решено" }) : t({ ro: "Activ", ru: "Активно" })}
                      </span>
                      <span>{k.channel === "phone-demo" ? "☏ " : ""}{fmtDateTime(k.createdAt, lang)}</span>
                      <span style={{ marginLeft: "auto" }}>{t({ ro: "netrimis", ru: "не отправлено" })}</span>
                    </div>
                    <p className="bo-row-body">
                      <Link href={`/tichet/${k.id}`} style={{ fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 }}>
                        {k.title || CATEGORIES.find((c) => c.id === k.category)?.label[lang]}
                      </Link>
                    </p>
                    <p className="bo-row-meta">{k.city || "Chișinău"} · {k.location.text || t({ ro: "fără locație", ru: "без места" })} · <span style={{ fontFamily: "ui-monospace, monospace" }}>{k.id}</span></p>
                    <TicketStatusControl ticket={k} />
                  </article>
                ))}
              </div>
            )}
          </section>
          </>
        )}
      </div>
    </div>
  );
}

function Overview({ stats, conflicts, tickets, unknownValidity, metrics, onGo }: { stats: { openGaps: number; ratings: number; useful: number; pct: number | null }; conflicts: number; tickets: Ticket[]; unknownValidity: number; metrics: StaffMetrics; onGo: (s: Section) => void }) {
  const { t } = useLang();
  const openTickets = tickets.filter((k) => (k.status ?? "active") !== "done").length;
  const { coverage, corpus, questions } = metrics;
  const unmatchedPct = questions.logged ? Math.round((coverage.unmatched / questions.logged) * 100) : 0;

  return (
    <>
      <dl className="bo-tiles">
        <Tile label={{ ro: "Lacune noi", ru: "Новые пробелы" }} value={stats.openGaps} note={{ ro: "întrebări fără dovadă", ru: "вопросов без доказательства" }} alert={stats.openGaps > 0} />
        <Tile label={{ ro: "Fără subiect", ru: "Без темы" }} value={`${unmatchedPct}%`} note={{ ro: `${coverage.unmatched} întrebări nu au nimerit nimic`, ru: `${coverage.unmatched} вопросов ни во что не попали` }} alert={unmatchedPct > 50} />
        <Tile label={{ ro: "Contradicții", ru: "Противоречия" }} value={conflicts} note={{ ro: "grupuri de valori divergente", ru: "групп расходящихся значений" }} alert={conflicts > 0} />
        <Tile label={{ ro: "Valabilitate nestabilită", ru: "Действительность не установлена" }} value={unknownValidity} note={{ ro: `din ${corpus.realDocs} surse reale`, ru: `из ${corpus.realDocs} реальных источников` }} />
        <Tile label={{ ro: "Utilitate", ru: "Полезность" }} value={stats.pct == null ? "—" : `${stats.pct}%`} note={{ ro: `${stats.useful} din ${stats.ratings} evaluări`, ru: `${stats.useful} из ${stats.ratings} оценок` }} />
        <Tile label={{ ro: "Tichete deschise", ru: "Открытые заявки" }} value={openTickets} note={{ ro: `din ${tickets.length} în total`, ru: `из ${tickets.length} всего` }} />
      </dl>

      <section className="bo-panel">
        <div className="bo-panel-head">
          <div>
            <h2>{t({ ro: "Ce cere atenție", ru: "Что требует внимания" })}</h2>
            <p>{t({ ro: "Bucla de reparare a documentației: fiecare gol pe care cititorii îl găsesc devine o sarcină aici.", ru: "Петля исправления документации: каждый пробел, найденный читателями, становится задачей здесь." })}</p>
          </div>
        </div>
        <div className="bo-rows">
          <Jump onGo={onGo} to="coverage" n={coverage.unmatched} title={{ ro: "Întrebări în afara corpusului", ru: "Вопросы вне корпуса" }} body={{ ro: `${corpus.passages} pasaje indexate susțin doar ${corpus.facts} afirmații, pe ${corpus.topics} subiecte. Restul întrebărilor nu au unde ateriza.`, ru: `${corpus.passages} проиндексированных фрагментов подкрепляют лишь ${corpus.facts} утверждений по ${corpus.topics} темам. Остальным вопросам некуда приземлиться.` }} />
          <Jump onGo={onGo} to="gaps" n={stats.openGaps} title={{ ro: "Lacune de completat", ru: "Пробелы для заполнения" }} body={{ ro: "Întrebări reale la care corpusul nu are nimic de citat.", ru: "Реальные вопросы, на которые в корпусе нечего процитировать." }} />
          <Jump onGo={onGo} to="conflicts" n={conflicts} title={{ ro: "Contradicții de arbitrat", ru: "Противоречия для разрешения" }} body={{ ro: "Două documente, două valori. Trebuie decis care este în vigoare.", ru: "Два документа, два значения. Нужно решить, какой действует." }} />
          <Jump onGo={onGo} to="tickets" n={openTickets} title={{ ro: "Tichete deschise", ru: "Открытые заявки" }} body={{ ro: "Sesizări demo care nu au fost încă marcate rezolvate.", ru: "Демо-обращения, ещё не отмеченные решёнными." }} />
        </div>
      </section>

      <section className="bo-panel">
        <div className="bo-note">
          <span className="bo-note-icon" aria-hidden="true">◇</span>
          <div>
            <strong>{t({ ro: "Prototip de flux de lucru", ru: "Прототип рабочего процесса" })}</strong>
            {t({
              ro: "Angajații Primăriei nu primesc și nu procesează aceste elemente. Datele provin doar din utilizarea acestui prototip, pe acest computer.",
              ru: "Сотрудники Примэрии не получают и не обрабатывают эти элементы. Данные — только из использования этого прототипа на этом компьютере.",
            })}
          </div>
        </div>
      </section>
    </>
  );
}

function Tile({ label, value, note, alert }: { label: L10n; value: number | string; note?: L10n; alert?: boolean }) {
  const { lang } = useLang();
  return (
    <div className={`bo-tile${alert ? " alert" : ""}`}>
      <dt>{label[lang]}</dt>
      <dd>
        {value}
        {note && <span className="bo-tile-note">{note[lang]}</span>}
      </dd>
    </div>
  );
}

function Jump({ onGo, to, n, title, body }: { onGo: (s: Section) => void; to: Section; n: number; title: L10n; body: L10n }) {
  const { lang, t } = useLang();
  return (
    <article className="bo-row">
      <div className="bo-row-top">
        <span className={`bo-pill ${n > 0 ? "in_review" : "resolved"}`}>{n}</span>
        <strong style={{ fontSize: 14, color: "#252923" }}>{title[lang]}</strong>
      </div>
      <p className="bo-row-meta">{body[lang]}</p>
      <div className="bo-row-actions">
        <button type="button" onClick={() => onGo(to)}>{t({ ro: "Deschide", ru: "Открыть" })} →</button>
      </div>
    </article>
  );
}

function TicketStatusControl({ ticket }: { ticket: Ticket }) {
  const { t } = useLang();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const status = ticket.status ?? "active";
  const update = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/tickets/${ticket.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: status === "done" ? "active" : "done" }) });
      if (!r.ok) throw new Error("update_failed");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="bo-row-actions">
      <button type="button" disabled={busy} onClick={() => void update()}>
        {busy ? "…" : status === "done" ? t({ ro: "Redeschide", ru: "Открыть снова" }) : t({ ro: "Marchează rezolvat", ru: "Отметить решённой" })}
      </button>
    </div>
  );
}

function StateControl({ item, onChange }: { item: ReviewItem; onChange: (id: string, s: ReviewState) => void }) {
  const { lang } = useLang();
  return (
    <div className="bo-row-actions">
      {(Object.keys(STATE_LABEL) as ReviewState[]).map((s) => (
        <button key={s} type="button" aria-pressed={item.state === s} onClick={() => onChange(item.id, s)}>
          {STATE_LABEL[s][lang]}
        </button>
      ))}
    </div>
  );
}

function Empty({ text }: { text: L10n }) {
  const { lang } = useLang();
  return (
    <p className="bo-empty">
      <span aria-hidden="true">○</span>
      <br />
      {text[lang]}
    </p>
  );
}

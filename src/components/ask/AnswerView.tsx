"use client";

import { Fragment, useId, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { useLang } from "../LangProvider";
import type { Answer, Claim } from "@/lib/answer/types";
import { DemoBadge, ExternalLink, Notice, StatusBadge } from "../ui";
import { SourcePanel } from "./SourcePanel";
import { Feedback } from "./Feedback";
import { useMediaQuery } from "../useMediaQuery";

export interface Selection {
  passageId: string;
  claimId: string;
  quote: string;
}

export function AnswerView({ answer, headingRef, onFollowUp, compact = false }: { compact?: boolean; answer: Answer; headingRef: RefObject<HTMLHeadingElement | null>; onFollowUp: (q: string) => void }) {
  const { lang, t } = useLang();
  const screenWide = useMediaQuery("(min-width: 1024px)");
  const wide = screenWide && !compact;
  const uid = useId();
  const [showDetails, setShowDetails] = useState(false);
  const [sel, setSel] = useState<Selection | null>(null);
  const [xray, setXray] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);

  // Preselect the first citation on wide screens so the evidence is visible immediately.
  const first = answer.claims[0] ?? answer.contacts[0];
  const defaultSel = wide && first ? { passageId: first.citations[0].passageId, claimId: first.id, quote: first.citations[0].quote } : null;
  const current = sel ?? defaultSel;

  const open = (s: Selection, trigger: HTMLElement) => {
    lastTrigger.current = trigger;
    setSel(s);
    if (!wide) dialogRef.current?.showModal();
    else document.getElementById(`${uid}-source-panel`)?.focus();
  };

  const closeDialog = () => {
    dialogRef.current?.close();
    lastTrigger.current?.focus();
  };

  const markers = (claim: Claim) => (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-baseline">
      {claim.citations.map((c, i) => {
        const p = answer.passages[c.passageId];
        const d = answer.docs[p.docId];
        const active = current?.passageId === c.passageId && current.claimId === claim.id;
        return (
          <button
            key={`${claim.id}:${i}`}
            type="button"
            onClick={(e) => open({ passageId: c.passageId, claimId: claim.id, quote: c.quote }, e.currentTarget)}
            aria-pressed={active}
            aria-label={`${t({ ro: "Dovada", ru: "Доказательство" })} ${c.n}: ${d.titleTranslation?.[lang] ?? d.title}, ${p.locator[lang]}${d.kind === "demo" ? " (DEMO)" : ""}`}
            className={`min-h-7 min-w-7 rounded border px-1.5 text-xs font-bold ${active ? "border-brand bg-brand text-white" : d.kind === "demo" ? "border-demo bg-demo-soft text-demo" : "border-brand bg-brand-soft text-brand-dark hover:bg-brand hover:text-white"}`}
          >
            {c.n}
            {p.lang !== lang && <span className="ml-0.5 font-normal opacity-80">{p.lang.toUpperCase()}</span>}
          </button>
        );
      })}
    </span>
  );

  const claimBody = (claim: Claim) => (
    <>
      <span>{claim.text[lang]}</span>
      {markers(claim)}
      {claim.uncertainty && (
        <span className="mt-1 flex gap-1.5 text-sm text-warn">
          <span aria-hidden="true">!</span>
          <span>
            <span className="font-semibold">{t({ ro: "Incertitudine: ", ru: "Неопределённость: " })}</span>
            {claim.uncertainty[lang]}
          </span>
        </span>
      )}
      {xray &&
        claim.citations.map((c, i) => (
          <span key={`${claim.id}:${i}`} className="mt-1.5 block border-l-4 border-mark bg-[#fffbe6] px-2 py-1 text-sm" lang={answer.passages[c.passageId].lang}>
            <span className="font-semibold">[{c.n}]</span> „<mark>{c.quote}</mark>”
          </span>
        ))}
    </>
  );

  const panel = current && <SourcePanel panelId={`${uid}-source-panel`} answer={answer} sel={current} question={answer.question} onClose={wide ? undefined : closeDialog} />;

  // Answers from the model's own knowledge have no passages to cite, so none of the
  // evidence machinery below applies — they render as plain prose with a clear warning.
  if (answer.kind === "prose") {
    return (
      <article aria-labelledby={`${uid}-ans-h`} className="prose-answer">
        <h2 id={`${uid}-ans-h`} ref={headingRef} tabIndex={-1} className="sr-only">
          {t({ ro: "Răspuns general", ru: "Общий ответ" })}
        </h2>
        {answer.unverified && (
          <p className="unverified-badge">
            <span aria-hidden="true">⚠</span>
            {t({ ro: "Fără sursă indexată · verificați înainte de a acționa", ru: "Без индексированного источника · проверьте, прежде чем действовать" })}
          </p>
        )}
        {answer.prose?.split(/\n{2,}/).map((para, i) => (
          <p key={i} className="prose-paragraph">{para}</p>
        ))}
        {!!answer.web?.length && (
          <div className="prose-links">
            <span>{t({ ro: "Verificați la:", ru: "Проверьте на:" })}</span>
            {answer.web.map((r) => (
              <ExternalLink key={r.url} href={r.url} lang={lang}>{new URL(r.url).hostname.replace(/^www\./, "")}</ExternalLink>
            ))}
          </div>
        )}
        {answer.unverified && <Feedback answer={answer} />}
      </article>
    );
  }

  return (
    <div className={compact ? "compact-answer" : "grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]"}>
      <article aria-labelledby={`${uid}-ans-h`} className="space-y-4">
        <div className="card space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={answer.status} lang={lang} />
            {answer.demoCorpus && <DemoBadge lang={lang} />}
            {answer.topicTitle && <span className="text-sm text-muted">{answer.topicTitle[lang]}</span>}
          </div>
          <h2 id={`${uid}-ans-h`} ref={headingRef} tabIndex={-1} className="text-lg font-bold sm:text-xl">
            {compact ? (answer.topicTitle?.[lang] ?? t({ ro: "Hai să găsim o altă cale", ru: "Попробуем другой вопрос" })) : answer.summary[lang]}
          </h2>
          {answer.demoCorpus && (
            <Notice tone="demo" title={t({ ro: "Corpus DEMO fictiv", ru: "Вымышленный DEMO-корпус" })}>
              {t({ ro: "Acest răspuns folosește documente inventate pentru a demonstra detectarea contradicțiilor. Nu sunt reguli reale ale Primăriei.", ru: "Этот ответ использует придуманные документы для демонстрации обнаружения противоречий. Это не реальные правила Примэрии." })}
            </Notice>
          )}
          {answer.questionLang !== lang && (
            <p className="text-sm text-muted">
              {t({ ro: "Limba a fost schimbată: explicațiile sunt traduse, citările și numerotarea au rămas aceleași.", ru: "Язык изменён: пояснения переведены, цитаты и нумерация остались прежними." })}
            </p>
          )}

          {answer.claims.length > 0 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold">{t({ ro: "Ce spun sursele", ru: "Что говорят источники" })}</h3>
                {!compact && <button type="button" className="btn btn-quiet min-h-9 px-2 text-sm" aria-pressed={xray} onClick={() => setXray((x) => !x)}>
                  <span aria-hidden="true">{xray ? "◉" : "○"}</span>
                  {t({ ro: "Radiografie: arată citatele sub fiecare afirmație", ru: "Рентген: показать цитаты под каждым утверждением" })}
                </button>}
              </div>
              <ul className="space-y-2">
                {answer.claims.map((c) => (
                  <li key={c.id} className={`rounded-lg border p-3 ${current?.claimId === c.id ? "border-brand bg-brand-soft/60" : "border-line"}`}>
                    {claimBody(c)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {answer.conflicts.map((cf) => (
          <section key={cf.group} aria-labelledby={`${uid}-cf-${cf.group}`} className="card border-bad p-4 sm:p-5">
            <h3 id={`${uid}-cf-${cf.group}`} className="flex items-center gap-2 font-bold text-bad">
              <span aria-hidden="true">⚠</span>
              {t({ ro: "Posibilă contradicție între surse", ru: "Возможное противоречие между источниками" })}
            </h3>
            <p className="mt-1 text-sm">{cf.explanation[lang]}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {cf.sides.map((s, i) => {
                const p = answer.passages[s.passageId];
                const d = answer.docs[s.docId];
                const claim = answer.claimIndex[s.claimId];
                return (
                  <figure key={s.passageId} className="rounded-lg border border-line bg-paper p-3">
                    <figcaption className="mb-2 space-y-1 text-sm">
                      <span className="block font-bold">
                        {t({ ro: "Sursa", ru: "Источник" })} {String.fromCharCode(65 + i)}: {d.titleTranslation?.[lang] ?? d.title}
                      </span>
                      <span className="flex flex-wrap gap-1.5">
                        {d.kind === "demo" && <DemoBadge lang={lang} />}
                        <span className="text-muted">{p.locator[lang]}</span>
                      </span>
                      <span className="block text-muted">
                        {d.publishedAt && <>{t({ ro: "Publicat", ru: "Опубликовано" })}: {d.publishedAt} · </>}
                        {d.revisedAt && <>{t({ ro: "Actualizat", ru: "Обновлено" })}: {d.revisedAt}</>}
                      </span>
                    </figcaption>
                    <blockquote lang={p.lang} className="border-l-4 border-bad pl-2 text-sm">
                      <Highlight text={p.text} quote={claim.citations[0].quote} />
                    </blockquote>
                    <p className="mt-2 text-sm">
                      <span className="font-semibold">{t({ ro: "Valoare: ", ru: "Значение: " })}</span>
                      <span className="rounded bg-bad-soft px-1 font-bold text-bad">{s.value}</span>
                    </p>
                  </figure>
                );
              })}
            </div>
            <Notice tone="info" title={t({ ro: "Ce puteți face", ru: "Что можно сделать" })}>
              {t({ ro: "Nu planificați pe baza niciuneia dintre valori până nu primiți confirmare oficială. Cazul a fost adăugat automat în lista de verificare pentru angajați (prototip).", ru: "Не планируйте, опираясь на любое из значений, пока не получите официальное подтверждение. Случай автоматически добавлен в список проверки для сотрудников (прототип)." })}
            </Notice>
          </section>
        ))}

        {compact && (answer.steps.length > 0 || answer.contacts.length > 0 || answer.servicePage) && <button type="button" className="answer-details-toggle" aria-expanded={showDetails} onClick={() => setShowDetails((v) => !v)}>{showDetails ? t({ ro: "Mai puține detalii −", ru: "Меньше деталей −" }) : t({ ro: "Pașii următori și contacte +", ru: "Следующие шаги и контакты +" })}</button>}

        {(!compact || showDetails) && answer.steps.length > 0 && (
          <section aria-labelledby={`${uid}-gps-h`} className="card p-4 sm:p-5">
            <h3 id={`${uid}-gps-h`} className="flex items-center gap-2 font-bold">
              <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full bg-brand text-sm text-white">➜</span>
              {t({ ro: "Traseul dvs. — pașii următori", ru: "Ваш маршрут — следующие шаги" })}
            </h3>
            <p className="text-sm text-muted">{t({ ro: "Fiecare pas are dovada lui. Pașii fără dovadă nu sunt afișați.", ru: "У каждого шага есть доказательство. Шаги без доказательства не показываются." })}</p>
            <ol className="mt-3 space-y-0">
              {answer.steps.map((s, i) => (
                <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < answer.steps.length - 1 && <span aria-hidden="true" className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 bg-brand/30" />}
                  <span aria-hidden="true" className="z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-brand bg-white font-bold text-brand">{i + 1}</span>
                  <div className="pt-1">
                    <span className="sr-only">{t({ ro: "Pasul", ru: "Шаг" })} {i + 1}: </span>
                    <span>{s.text[lang]}</span>
                    {s.claimIds.map((id) => answer.claimIndex[id] && <Fragment key={id}>{markers(answer.claimIndex[id])}</Fragment>)}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {answer.missing.length > 0 && (
          <section aria-labelledby={`${uid}-miss-h`} className="card border-none p-4 sm:p-5">
            <h3 id={`${uid}-miss-h`} className="flex items-center gap-2 font-bold">
              <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full bg-none-soft">∅</span>
              {t({ ro: "Ce nu am putut confirma", ru: "Что не удалось подтвердить" })}
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              {answer.missing.map((m, i) => (
                <li key={i}>{m[lang]}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-muted">
              {t({ ro: "Nu completăm golurile prin presupuneri. Întrebarea (fără date personale) a fost adăugată în lista de lacune pentru angajați (prototip).", ru: "Мы не заполняем пробелы догадками. Вопрос (без личных данных) добавлен в список пробелов для сотрудников (прототип)." })}
            </p>
          </section>
        )}

        {(!compact || showDetails) && (answer.servicePage || answer.contacts.length > 0) && (
          <section aria-labelledby={`${uid}-where-h`} className="card p-4 sm:p-5">
            <h3 id={`${uid}-where-h`} className="font-bold">{t({ ro: "Unde mergeți / pe cine sunați", ru: "Куда обратиться / куда звонить" })}</h3>
            {answer.servicePage && (
              <p className="mt-2">
                <ExternalLink href={answer.servicePage.url} lang={lang} className="btn btn-secondary">
                  {answer.servicePage.label[lang]}
                </ExternalLink>
              </p>
            )}
            {answer.contacts.length > 0 && (
              <ul className="mt-3 space-y-2">
                {answer.contacts.map((c) => (
                  <li key={c.id} className="rounded-lg border border-line p-3">
                    {claimBody(c)}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted">{t({ ro: "Contactele sunt citate de pe paginile oficiale; verificați programul înainte de deplasare.", ru: "Контакты процитированы с официальных страниц; уточните режим работы перед визитом." })}</p>
          </section>
        )}

        {answer.web && answer.web.length > 0 && (
          <section aria-labelledby={`${uid}-web-h`} className="card p-4 sm:p-5">
            <h3 id={`${uid}-web-h`} className="flex items-center gap-2 font-bold">
              <span aria-hidden="true">🌐</span>
              {t({ ro: "De pe web — nu e în corpus", ru: "Из интернета — нет в корпусе" })}
            </h3>
            <p className="mt-1 text-sm text-muted">
              {t({ ro: "Aceste rezultate NU sunt verificate ca sursele de mai sus. Deschideți pagina și verificați înainte de a vă baza pe ele.", ru: "Эти результаты НЕ проверены, в отличие от источников выше. Откройте страницу и проверьте, прежде чем полагаться на них." })}
            </p>
            <ul className="mt-3 space-y-2">
              {answer.web.map((w) => (
                <li key={w.url} className="rounded-lg border border-line p-3">
                  <ExternalLink href={w.url} lang={lang} className="font-semibold">
                    {w.title}
                  </ExternalLink>
                  {w.snippet && <p className="mt-1 text-sm text-muted">{w.snippet}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <FollowUps answer={answer} onFollowUp={onFollowUp} />

        <Feedback answer={answer} />

        <details className="rounded-lg border border-line bg-white p-3 text-sm">
          <summary className="cursor-pointer font-semibold">{t({ ro: "Cum a fost produs acest răspuns", ru: "Как получен этот ответ" })}</summary>
          <div className="mt-2 space-y-1 text-muted">
            <p>{answer.engine.label[lang]}</p>
            <p>
              {t({ ro: "Validare citări:", ru: "Проверка цитат:" })} {answer.validation.passed}/{answer.validation.checked}{" "}
              {t({ ro: "afirmații confirmate (citatul există exact în pasajul indexat).", ru: "утверждений подтверждено (цитата точно найдена в проиндексированном фрагменте)." })}
              {answer.validation.dropped.length > 0 && ` ${t({ ro: "Eliminate:", ru: "Удалено:" })} ${answer.validation.dropped.length}.`}
            </p>
            <p>
              {t({ ro: "Căutare: subiecte candidate", ru: "Поиск: темы-кандидаты" })} —{" "}
              {answer.engine.retrieval.candidates.length ? answer.engine.retrieval.candidates.map((c) => `${c.topicId} (${c.score})`).join(", ") : "—"}
            </p>
          </div>
        </details>
      </article>

      {wide ? (
        <aside aria-label={t({ ro: "Panoul surselor", ru: "Панель источников" })} className="lg:sticky lg:top-4 lg:self-start">
          {panel ?? (
            <div className="card p-4 text-sm text-muted">{t({ ro: "Apăsați un număr [1] pentru a vedea pasajul exact.", ru: "Нажмите номер [1], чтобы увидеть точный фрагмент." })}</div>
          )}
        </aside>
      ) : (
        <dialog
          ref={dialogRef}
          aria-label={t({ ro: "Dovada", ru: "Доказательство" })}
          onClose={() => lastTrigger.current?.focus()}
          className="m-0 mt-auto max-h-[88vh] w-full max-w-none rounded-t-2xl p-0 backdrop:bg-black/40"
        >
          {panel}
        </dialog>
      )}
    </div>
  );
}

function FollowUps({ answer, onFollowUp }: { answer: Answer; onFollowUp: (q: string) => void }) {
  const uid = useId();
  const { lang, t } = useLang();
  const map: Record<string, { ro: string; ru: string }[]> = {
    "water-contract": [
      { ro: "Cât costă apa potabilă?", ru: "Сколько стоит питьевая вода?" },
      { ro: "Cum transmit indicii contorului?", ru: "Как передать показания счётчика?" },
    ],
    "water-tariff": [{ ro: "Ce acte îmi trebuie pentru contractul de apă la apartament?", ru: "Какие документы нужны для договора на воду в квартире?" }],
    petition: [{ ro: "În cât timp răspunde primăria la o petiție?", ru: "За какой срок примэрия отвечает на петицию?" }],
    trees: [{ ro: "Cum depun o petiție la primărie?", ru: "Как подать петицию в примэрию?" }],
  };
  const list = answer.topicId ? map[answer.topicId] : undefined;
  if (!list && answer.status !== "missing") return null;
  return (
    <section aria-labelledby={`${uid}-fu-h`} className="space-y-2">
      <h3 id={`${uid}-fu-h`} className="font-bold">{answer.status === "missing" ? t({ ro: "Ce pot verifica în schimb", ru: "Что я могу проверить вместо этого" }) : t({ ro: "Întrebări înrudite", ru: "Связанные вопросы" })}</h3>
      <ul className="flex flex-wrap gap-2">
        {(list ?? [
          { ro: "Cum depun o petiție la primărie?", ru: "Как подать петицию в примэрию?" },
          { ro: "Ce acte îmi trebuie pentru contractul de apă la apartament?", ru: "Какие документы нужны для договора на воду в квартире?" },
        ]).map((q) => (
          <li key={q.ro}>
            <button type="button" onClick={() => onFollowUp(q[lang])} className="rounded-full border border-brand bg-white px-3 py-1.5 text-sm text-brand hover:bg-brand-soft">
              {q[lang]}
            </button>
          </li>
        ))}
        <li>
          <Link href="/surse" className="inline-block rounded-full border border-line bg-white px-3 py-1.5 text-sm text-muted hover:border-brand">
            {t({ ro: "Răsfoiți toate sursele", ru: "Все источники" })}
          </Link>
        </li>
      </ul>
    </section>
  );
}

export function Highlight({ text, quote }: { text: string; quote: string }) {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  const full = norm(text);
  const q = norm(quote);
  const i = full.indexOf(q);
  if (i < 0) return <>{full}</>;
  return (
    <>
      {full.slice(0, i)}
      <mark>{full.slice(i, i + q.length)}</mark>
      {full.slice(i + q.length)}
    </>
  );
}

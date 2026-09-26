"use client";

import Link from "next/link";
import { useLang } from "../LangProvider";
import type { StaffMetrics } from "@/lib/staff/metrics";
import type { L10n } from "@/lib/corpus/types";

/** ro: 1 zi / 2 zile. ru: 1 день / 2–4 дня / 5 дней, also for 11–14 and numbers ending in 0 or 5–9. */
function plural(n: number, lang: "ro" | "ru", forms: { ro: [string, string]; ru: [string, string, string] }): string {
  if (lang === "ro") return `${n} ${n === 1 ? forms.ro[0] : forms.ro[1]}`;
  const teen = n % 100 >= 11 && n % 100 <= 14;
  const last = n % 10;
  const form = teen || last === 0 || last >= 5 ? forms.ru[2] : last === 1 ? forms.ru[0] : forms.ru[1];
  return `${n} ${form}`;
}

const DAYS = { ro: ["zi", "zile"] as [string, string], ru: ["день", "дня", "дней"] as [string, string, string] };
const CITES = { ro: ["citare", "citări"] as [string, string], ru: ["цитирование", "цитирования", "цитирований"] as [string, string, string] };

export function Bars({ rows, tone = "ok", total }: { rows: { label: L10n | string; count: number }[]; tone?: "ok" | "warn" | "bad" | "flat"; total?: number }) {
  const { lang } = useLang();
  const max = total ?? Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="bo-bars">
      {rows.map((r, i) => (
        <div className="bo-bar" key={i}>
          <span className="bo-bar-label">{typeof r.label === "string" ? r.label : r.label[lang]}</span>
          <span className="bo-bar-track">
            <span className={`bo-bar-fill ${tone}`} style={{ width: `${Math.round((r.count / max) * 100)}%` }} />
          </span>
          <span className="bo-bar-value">{r.count}</span>
        </div>
      ))}
    </div>
  );
}

export function DayChart({ data, label }: { data: { day: string; count: number }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <figure className="bo-days" aria-label={label}>
      {data.map((d) => (
        <span className="bo-day" key={d.day} title={`${d.day}: ${d.count}`}>
          <span className="bo-day-bar" style={{ height: `${Math.max(2, Math.round((d.count / max) * 100))}%` }} />
          <span className="bo-day-tick">{d.day.slice(8)}</span>
        </span>
      ))}
      <figcaption className="sr-only">{data.map((d) => `${d.day}: ${d.count}`).join(", ")}</figcaption>
    </figure>
  );
}

export function Funnel({ steps }: { steps: { label: L10n; value: number; note: L10n }[] }) {
  const { lang } = useLang();
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <ol className="bo-funnel">
      {steps.map((s, i) => (
        <li key={i}>
          <span className="bo-funnel-head">
            <strong>{s.value}</strong>
            <span>{s.label[lang]}</span>
          </span>
          <span className="bo-funnel-track">
            <span className="bo-funnel-fill" style={{ width: `${Math.max(3, Math.round((s.value / max) * 100))}%` }} />
          </span>
          <span className="bo-funnel-note">{s.note[lang]}</span>
        </li>
      ))}
    </ol>
  );
}

export function CoverageSection({ m }: { m: StaffMetrics }) {
  const { t } = useLang();
  const { corpus, coverage, questions, traffic } = m;
  const unmatchedPct = questions.logged ? Math.round((coverage.unmatched / questions.logged) * 100) : 0;

  return (
    <>
      <section className="bo-panel">
        <div className="bo-panel-head">
          <div>
            <h2>{t({ ro: "Trafic real", ru: "Реальный трафик" })}</h2>
            <p>{t({ ro: "Fiecare întrebare pusă, reușită sau nu. Fără textul întrebării — doar subiectul, starea și motorul.", ru: "Каждый заданный вопрос, удачный или нет. Без текста вопроса — только тема, статус и движок." })}</p>
          </div>
          {traffic.answeredPct != null && <p className="bo-big">{traffic.answeredPct}%</p>}
        </div>
        {traffic.total === 0 ? (
          <div className="bo-note">
            <span className="bo-note-icon" aria-hidden="true">i</span>
            <div>
              <strong>{t({ ro: "Încă nicio întrebare înregistrată", ru: "Пока ни одного записанного вопроса" })}</strong>
              {t({
                ro: "Înregistrarea completă tocmai a fost pornită. Până se adună trafic, panourile de mai jos arată doar eșecurile salvate anterior.",
                ru: "Полная запись только что включена. Пока трафик не накопится, панели ниже показывают только ранее сохранённые неудачи.",
              })}
            </div>
          </div>
        ) : (
          <>
            <div className="bo-split">
              <div>
                <h3 className="bo-sub">{t({ ro: "Stare răspuns", ru: "Статус ответа" })}</h3>
                <Bars rows={traffic.byStatus} tone="ok" total={traffic.total} />
              </div>
              <div>
                <h3 className="bo-sub">{t({ ro: "Motor", ru: "Движок" })}</h3>
                <Bars rows={traffic.byEngine} tone="flat" total={traffic.total} />
              </div>
            </div>
            <p className="bo-row-meta" style={{ marginTop: 12 }}>
              {traffic.total} {t({ ro: "întrebări", ru: "вопросов" })}
              {traffic.fallbackPct != null && ` · ${traffic.fallbackPct}% ${t({ ro: "au căzut pe rezervă", ru: "ушли на резерв" })}`}
              {traffic.weakMatches > 0 && ` · ${traffic.weakMatches} ${t({ ro: "potriviri slabe de subiect", ru: "слабых совпадений темы" })}`}
            </p>
            <h3 className="bo-sub" style={{ marginTop: 18 }}>{t({ ro: "Ultimele 14 zile", ru: "Последние 14 дней" })}</h3>
            <DayChart data={traffic.byDay} label={t({ ro: "Întrebări pe zi", ru: "Вопросы по дням" })} />
          </>
        )}
      </section>

      <section className="bo-panel">
        <div className="bo-panel-head">
          <div>
            <h2>{t({ ro: "De la sursă la răspuns", ru: "От источника к ответу" })}</h2>
            <p>{t({ ro: "Cât din materialul indexat ajunge efectiv să susțină un răspuns. Îngustarea de la pasaje la afirmații este munca de extragere care încă nu s-a făcut.", ru: "Какая часть проиндексированного материала действительно подкрепляет ответ. Сужение от фрагментов к утверждениям — это работа по извлечению, которая ещё не сделана." })}</p>
          </div>
        </div>
        <Funnel
          steps={[
            { label: { ro: "Documente", ru: "Документы" }, value: corpus.docs, note: { ro: `${corpus.realDocs} reale · ${corpus.demoDocs} demo`, ru: `${corpus.realDocs} реальных · ${corpus.demoDocs} демо` } },
            { label: { ro: "Pasaje indexate", ru: "Проиндексированные фрагменты" }, value: corpus.passages, note: { ro: `${corpus.citedPassages} sunt citate de o afirmație`, ru: `${corpus.citedPassages} процитированы утверждением` } },
            { label: { ro: "Afirmații verificabile", ru: "Проверяемые утверждения" }, value: corpus.facts, note: { ro: "fiecare cu citat verbatim", ru: "каждое с дословной цитатой" } },
            { label: { ro: "Subiecte cu răspuns", ru: "Темы с ответом" }, value: corpus.topics, note: { ro: "tot ce poate fi întrebat azi", ru: "всё, что можно спросить сегодня" } },
          ]}
        />
      </section>

      <section className="bo-panel">
        <div className="bo-panel-head">
          <div>
            <h2>{t({ ro: "Cerere față de acoperire", ru: "Спрос против покрытия" })}</h2>
            <p>{t({ ro: "Câte întrebări au nimerit fiecare subiect, și cu câte afirmații este susținut subiectul.", ru: "Сколько вопросов попало в каждую тему и сколькими утверждениями тема подкреплена." })}</p>
          </div>
        </div>

        {coverage.unmatched > 0 && (
          <div className="bo-note" style={{ marginBottom: 15 }}>
            <span className="bo-note-icon" aria-hidden="true">!</span>
            <div>
              <strong>{coverage.unmatched} {t({ ro: "întrebări nu au nimerit niciun subiect", ru: "вопросов не попали ни в одну тему" })} ({unmatchedPct}%)</strong>
              {t({
                ro: "Acestea nu sunt goluri într-un subiect existent — sunt subiecte care nu există deloc în corpus. Ele nu apar în graficul de mai jos.",
                ru: "Это не пробелы внутри существующей темы — это темы, которых в корпусе нет вовсе. В графике ниже они не отражены.",
              })}
            </div>
          </div>
        )}

        <div className="bo-split">
          <div>
            <h3 className="bo-sub">
              {traffic.total > 0 ? t({ ro: "Întrebări care au ajuns la subiect", ru: "Вопросов, дошедших до темы" }) : t({ ro: "Întrebări eșuate pe subiect", ru: "Неудавшихся вопросов по теме" })}
            </h3>
            <Bars rows={coverage.topics.map((x) => ({ label: x.label, count: traffic.total > 0 ? x.asked : x.questions }))} tone="warn" />
          </div>
          <div>
            <h3 className="bo-sub">{t({ ro: "Afirmații care susțin subiectul", ru: "Утверждений в поддержку темы" })}</h3>
            <Bars rows={coverage.topics.map((x) => ({ label: x.label, count: x.facts }))} tone="ok" />
          </div>
        </div>
      </section>

      <section className="bo-panel">
        <div className="bo-panel-head">
          <div>
            <h2>{t({ ro: "Semnale din întrebări", ru: "Сигналы из вопросов" })}</h2>
            <p>{t({ ro: "Din elementele înregistrate pentru revizuire.", ru: "Из элементов, записанных для проверки." })}</p>
          </div>
        </div>
        <div className="bo-note" style={{ marginBottom: 15 }}>
          <span className="bo-note-icon" aria-hidden="true">i</span>
          <div>
            <strong>{t({ ro: "Numărător fără numitor", ru: "Числитель без знаменателя" })}</strong>
            {t({
              ro: "Se înregistrează doar întrebările care au eșuat. Răspunsurile reușite nu sunt numărate, deci procentele de mai jos descriu eșecurile între ele, nu rata de succes a sistemului.",
              ru: "Записываются только неудавшиеся вопросы. Успешные ответы не учитываются, поэтому проценты ниже описывают соотношение неудач, а не долю успеха системы.",
            })}
          </div>
        </div>
        <div className="bo-split">
          <div>
            <h3 className="bo-sub">{t({ ro: "Stare răspuns", ru: "Статус ответа" })}</h3>
            <Bars rows={questions.byStatus} tone="warn" />
          </div>
          <div>
            <h3 className="bo-sub">{t({ ro: "Limbă", ru: "Язык" })}</h3>
            <Bars rows={questions.byLang} tone="flat" />
          </div>
        </div>
        <h3 className="bo-sub" style={{ marginTop: 18 }}>{t({ ro: "Ultimele 14 zile", ru: "Последние 14 дней" })}</h3>
        <DayChart data={questions.byDay} label={t({ ro: "Întrebări pe zi", ru: "Вопросы по дням" })} />
      </section>
    </>
  );
}

export function TicketAnalytics({ m }: { m: StaffMetrics["tickets"] }) {
  const { t } = useLang();
  const agreement = m.classifier.suggested ? Math.round((m.classifier.kept / m.classifier.suggested) * 100) : null;

  return (
    <section className="bo-panel">
      <div className="bo-panel-head">
        <div>
          <h2>{t({ ro: "Cum arată sesizările", ru: "Как выглядят обращения" })}</h2>
          <p>{t({ ro: "Calculat din tichetele existente, fără urmărire suplimentară.", ru: "Рассчитано по существующим заявкам, без дополнительного отслеживания." })}</p>
        </div>
      </div>
      <div className="bo-split">
        <div>
          <h3 className="bo-sub">{t({ ro: "Categorie", ru: "Категория" })}</h3>
          <Bars rows={m.byCategory} tone="ok" />
        </div>
        <div>
          <h3 className="bo-sub">{t({ ro: "Vechimea celor deschise", ru: "Возраст открытых" })}</h3>
          {m.ageBuckets.length ? <Bars rows={m.ageBuckets} tone="warn" /> : <p className="bo-row-meta">{t({ ro: "Niciun tichet deschis.", ru: "Нет открытых заявок." })}</p>}
        </div>
        <div>
          <h3 className="bo-sub">{t({ ro: "Sursa locației", ru: "Источник места" })}</h3>
          <Bars rows={m.locationSource} tone="flat" />
        </div>
        <div>
          <h3 className="bo-sub">{t({ ro: "Categoria propusă automat", ru: "Категория, предложенная автоматически" })}</h3>
          {agreement == null ? (
            <p className="bo-row-meta">{t({ ro: "Nicio propunere înregistrată.", ru: "Предложений не записано." })}</p>
          ) : (
            <>
              <p className="bo-big">{agreement}%</p>
              <p className="bo-row-meta">
                {t({ ro: "păstrată de om", ru: "сохранено человеком" })} — {m.classifier.kept}/{m.classifier.suggested}
                {m.classifier.changed > 0 && ` · ${m.classifier.changed} ${t({ ro: "corectate", ru: "исправлено" })}`}
              </p>
            </>
          )}
        </div>
      </div>
      <h3 className="bo-sub" style={{ marginTop: 18 }}>{t({ ro: "Ultimele 14 zile", ru: "Последние 14 дней" })}</h3>
      <DayChart data={m.byDay} label={t({ ro: "Tichete pe zi", ru: "Заявки по дням" })} />
      <p className="bo-row-meta" style={{ marginTop: 12 }}>
        {m.withGps}/{m.total} {t({ ro: "cu coordonate", ru: "с координатами" })} · {m.withMedia}/{m.total} {t({ ro: "cu fișier atașat", ru: "с вложением" })}
      </p>
    </section>
  );
}

export function EvidenceSection({ m }: { m: StaffMetrics }) {
  const { lang, t } = useLang();
  return (
    <>
      <section className="bo-panel">
        <div className="bo-panel-head">
          <div>
            <h2>{t({ ro: "Coadă de reverificare", ru: "Очередь на перепроверку" })}</h2>
            <p>{t({ ro: "Sursele ordonate după cât de des sunt citate înmulțit cu vechimea copiei locale. Un document mult folosit și vechi este cel mai costisitor dacă s-a schimbat între timp.", ru: "Источники отсортированы по частоте цитирования, умноженной на возраст локальной копии. Часто используемый и старый документ обходится дороже всего, если он успел измениться." })}</p>
          </div>
        </div>
        <div className="bo-rows">
          {m.evidence.recheck.map((d) => (
            <article key={d.id} className="bo-row">
              <div className="bo-row-top">
                <span className={`bo-pill ${d.status === "declared_in_force" ? "resolved" : "new"}`}>
                  {d.status === "declared_in_force" ? t({ ro: "În vigoare declarat", ru: "Заявлено действующим" }) : t({ ro: "Valabilitate nestabilită", ru: "Действительность не установлена" })}
                </span>
                <span>{d.uses > 0 ? plural(d.uses, lang, CITES) : t({ ro: "necitat încă", ru: "ещё не цитировался" })}</span>
                <span style={{ marginLeft: "auto" }}>{t({ ro: "copie din", ru: "копия от" })} {d.retrievedAt} · {plural(d.ageDays, lang, DAYS)}</span>
              </div>
              <p className="bo-row-body">
                <Link href={`/surse/${d.id}`} style={{ fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 }}>{d.title}</Link>
              </p>
            </article>
          ))}
        </div>
        <p className="bo-row-meta" style={{ marginTop: 12 }}>
          {m.evidence.unusedPassages}/{m.corpus.passages} {t({ ro: "pasaje nu au fost citate niciodată într-un răspuns.", ru: "фрагментов ни разу не цитировались в ответе." })}
        </p>
      </section>

      <section className="bo-panel">
        <div className="bo-panel-head">
          <div>
            <h2>{t({ ro: "Pasaje semnalate", ru: "Отмеченные фрагменты" })}</h2>
            <p>{t({ ro: "Un pasaj semnalat de mai multe ori este de obicei decupat greșit, nu citit greșit.", ru: "Фрагмент, отмеченный несколько раз, обычно неверно вырезан, а не неверно прочитан." })}</p>
          </div>
        </div>
        {m.evidence.flaggedPassages.length === 0 ? (
          <p className="bo-empty"><span aria-hidden="true">○</span><br />{t({ ro: "Niciun pasaj semnalat.", ru: "Отмеченных фрагментов нет." })}</p>
        ) : (
          <Bars rows={m.evidence.flaggedPassages.map((p) => ({ label: p.passageId, count: p.count }))} tone="bad" />
        )}
      </section>

      <section className="bo-panel">
        <div className="bo-panel-head">
          <div>
            <h2>{t({ ro: "Unde stau pasajele", ru: "Где находятся фрагменты" })}</h2>
            <p>{t({ ro: "Documentele care aduc cel mai mult material indexat.", ru: "Документы, дающие больше всего проиндексированного материала." })}</p>
          </div>
        </div>
        <Bars rows={m.evidence.topDocs.map((d) => ({ label: d.title, count: d.passages }))} tone="flat" />
      </section>
    </>
  );
}

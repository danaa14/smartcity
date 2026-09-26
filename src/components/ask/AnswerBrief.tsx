"use client";

import Link from "next/link";
import { useLang } from "../LangProvider";
import type { Answer } from "@/lib/answer/types";
import { DemoBadge, ExternalLink, StatusBadge } from "../ui";

const L = {
  evidence: { ro: "Dovada", ru: "Доказательство" },
  route: { ro: "Traseul pașilor", ru: "Маршрут шагов" },
  sources: { ro: "Sursele folosite", ru: "Использованные источники" },
  conflicts: { ro: "Contradicții", ru: "Противоречия" },
  openSource: { ro: "Deschide sursa", ru: "Открыть источник" },
  confirm: { ro: "Nu planificați pe baza valorilor conflictuale până nu primiți confirmare oficială.", ru: "Не планируйте, опираясь на противоречивые значения, до официального подтверждения." },
} as const;

export function AnswerBrief({ answer }: { answer: Answer }) {
  const { lang, t } = useLang();
  const first = answer.sources[0] ? answer.passages[answer.sources[0].passageId] : undefined;
  const doc = first ? answer.docs[first.docId] : undefined;
  const claims = answer.claims.length ? answer.claims : answer.contacts;
  const shown = claims.slice(0, 3);

  return (
    <div className="pf-brief card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={answer.status} lang={lang} size="sm" />
        {answer.demoCorpus && <DemoBadge lang={lang} />}
        {answer.topicTitle && <span className="text-sm text-muted">{answer.topicTitle[lang]}</span>}
      </div>

      {shown.length > 0 && (
        <div className="space-y-2">
          {shown.map((c) => (
            <p key={c.id} className="leading-snug">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-brand align-middle" aria-hidden="true" />
              <span className="font-semibold">{c.text[lang]}</span>
            </p>
          ))}
          {claims.length > shown.length && (
            <p className="text-xs text-muted">
              + {claims.length - shown.length} {t({ ro: "mai multe puncte în „Dovada”", ru: "ещё пунктов в «Доказательстве»" })}
            </p>
          )}
        </div>
      )}

      {answer.status !== "supported" && answer.claims.length > 0 && answer.missing[0] && (
        <p className="text-sm text-muted">
          <span className="font-bold">{t({ ro: "Lipsă: ", ru: "Нет данных: " })}</span>
          {answer.missing[0][lang]}
        </p>
      )}

      {answer.conflicts.length > 0 && (
        <p className="text-sm font-semibold text-bad">
          <span aria-hidden="true">⚠ </span>{answer.conflicts[0].explanation[lang]}
        </p>
      )}

      {doc && (
        <p className="text-sm">
          {doc.url ? (
            <ExternalLink href={doc.url} lang={lang} className="link">
              {t(L.openSource)}: {doc.titleTranslation?.[lang] ?? doc.title}
            </ExternalLink>
          ) : (
            <Link href={`/surse/${doc.id}`} className="link">
              {t(L.openSource)}: {doc.titleTranslation?.[lang] ?? doc.title}
            </Link>
          )}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {answer.claims.length + answer.contacts.length > 0 && (
          <Fold label={t(L.evidence)} icon="❝">
            <ul className="space-y-2">
              {(answer.claims.length ? answer.claims : answer.contacts).map((c) => (
                <li key={c.id} className="rounded-lg border border-line bg-paper p-2.5 text-sm">
                  <p className="font-medium leading-snug">{c.text[lang]}</p>
                  {c.citations.map((cit) => {
                    const p = answer.passages[cit.passageId];
                    const d = answer.docs[p.docId];
                    return (
                      <blockquote key={`${c.id}:${cit.n}`} lang={p.lang} className="mt-1.5 border-l-2 border-brand pl-2 text-xs text-muted">
                        „{cit.quote}”
                        <span className="mt-0.5 block font-semibold">
                          {d.titleTranslation?.[lang] ?? d.title} — {p.locator[lang]}
                        </span>
                      </blockquote>
                    );
                  })}
                </li>
              ))}
            </ul>
          </Fold>
        )}
        {answer.steps.length > 0 && (
          <Fold label={t(L.route)} icon="➜">
            <ol className="space-y-1.5">
              {answer.steps.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand text-[10px] font-bold text-white">{i + 1}</span>
                  <span className="leading-snug">{s.text[lang]}</span>
                </li>
              ))}
            </ol>
          </Fold>
        )}
        {Object.keys(answer.docs).length > 0 && (
          <Fold label={t(L.sources)} icon="☰">
            <ul className="space-y-1.5 text-sm">
              {Object.values(answer.docs).map((d) => (
                <li key={d.id} className="flex flex-col gap-0.5">
                  <span className="font-semibold">{d.titleTranslation?.[lang] ?? d.title}</span>
                  <span className="text-xs text-muted">
                    {d.publishedAt ? `${t({ ro: "Publicat", ru: "Опубликовано" })}: ${d.publishedAt} · ` : ""}
                    {d.kind === "demo" ? "DEMO — fictiv · " : ""}
                    {d.url ? (
                      <ExternalLink href={d.url} lang={lang} className="link">
                        {t({ ro: "pagina oficială", ru: "официальная страница" })}
                      </ExternalLink>
                    ) : (
                      <Link href={`/surse/${d.id}`} className="link">{t({ ro: "fișa sursei", ru: "карточка источника" })}</Link>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Fold>
        )}
        {answer.conflicts.length > 0 && (
          <Fold label={t(L.conflicts)} icon="⚠">
            <div className="space-y-2 text-sm">
              {answer.conflicts.map((cf) => (
                <div key={cf.group} className="rounded-lg border border-bad bg-bad-soft p-2.5">
                  <p className="font-semibold text-bad">{cf.explanation[lang]}</p>
                  <p className="mt-1 text-muted">{t(L.confirm)}</p>
                </div>
              ))}
            </div>
          </Fold>
        )}
      </div>
    </div>
  );
}

function Fold({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  return (
    <details className="pf-fold-wrap group min-w-0">
      <summary className="flex w-max cursor-pointer list-none items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold text-brand hover:border-brand hover:bg-brand-soft [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="text-xs">{icon}</span>
        {label}
        <span aria-hidden="true" className="pf-chev text-[10px] text-muted">▸</span>
      </summary>
      <div className="pf-fold mt-2">
        <div className="min-w-0 rounded-lg border border-line bg-white p-3">{children}</div>
      </div>
    </details>
  );
}
"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useLang } from "../LangProvider";
import type { Answer } from "@/lib/answer/types";
import { fmtDate } from "@/lib/i18n";
import { DemoBadge, ExternalLink, RealBadge } from "../ui";
import { Highlight, type Selection } from "./AnswerView";

export function SourcePanel({ answer, sel, question, onClose, panelId = "source-panel" }: { panelId?: string; answer: Answer; sel: Selection; question: string; onClose?: () => void }) {
  const { lang, t } = useLang();
  const p = answer.passages[sel.passageId];
  const d = answer.docs[p.docId];
  const n = answer.sources.find((s) => s.passageId === sel.passageId)?.n;
  const translation = p.unofficialTranslation?.[lang];

  return (
    <div id={panelId} tabIndex={-1} className="card max-h-[85vh] space-y-3 overflow-y-auto p-4" aria-live="polite">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            {t({ ro: "Dovada", ru: "Доказательство" })} [{n}]
          </p>
          <h3 className="font-bold leading-snug">{d.titleTranslation?.[lang] ?? d.title}</h3>
          {d.titleTranslation && d.title !== d.titleTranslation[lang] && (
            <p lang={d.lang} className="text-sm text-muted">
              {t({ ro: "Titlu original:", ru: "Оригинальное название:" })} {d.title}
            </p>
          )}
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="btn btn-secondary min-h-10 shrink-0 px-3">
            {t({ ro: "Închide", ru: "Закрыть" })}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">{d.kind === "demo" ? <DemoBadge lang={lang} /> : <RealBadge lang={lang} />}</div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted">{t({ ro: "Emitent", ru: "Издатель" })}</dt>
        <dd>{d.publisher}</dd>
        <dt className="text-muted">{t({ ro: "Locație", ru: "Место" })}</dt>
        <dd>{p.locator[lang]}</dd>
        {d.publishedAt && (
          <>
            <dt className="text-muted">{t({ ro: "Publicat", ru: "Опубликовано" })}</dt>
            <dd>{fmtDate(d.publishedAt, lang)}</dd>
          </>
        )}
        {d.effectiveAt && (
          <>
            <dt className="text-muted">{t({ ro: "În vigoare din", ru: "Действует с" })}</dt>
            <dd>{fmtDate(d.effectiveAt, lang)}</dd>
          </>
        )}
        {d.revisedAt && (
          <>
            <dt className="text-muted">{t({ ro: "Revizuit", ru: "Пересмотрено" })}</dt>
            <dd>{fmtDate(d.revisedAt, lang)}</dd>
          </>
        )}
        <dt className="text-muted">{t({ ro: "Preluat", ru: "Получено" })}</dt>
        <dd>{fmtDate(d.retrievedAt, lang)}</dd>
        <dt className="text-muted">{t({ ro: "Verificat ultima dată", ru: "Последняя проверка" })}</dt>
        <dd>{fmtDate(d.lastCheckedAt ?? d.retrievedAt, lang)}</dd>
      </dl>

      {d.status !== "declared_in_force" && d.kind === "real" && (
        <p className="rounded-lg bg-warn-soft p-2 text-sm text-warn" role="note">
          {d.statusNote[lang]}
        </p>
      )}

      <div className="rounded-lg bg-paper p-3">
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
          {t({ ro: "Textul original", ru: "Оригинальный текст" })} ({p.lang === "ro" ? "română" : p.lang === "ru" ? "русский" : "English"}) — {t({ ro: "fragment din sursă", ru: "фрагмент источника" })}
        </p>
        <blockquote lang={p.lang} className="border-l-4 border-[#d9b400] pl-3">
          <Highlight text={p.text} quote={sel.quote} />
        </blockquote>
      </div>

      {translation && (
        <div className="rounded-lg border border-dashed border-line p-3">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
            {t({ ro: "Traducere neoficială (prototip)", ru: "Неофициальный перевод (прототип)" })}
          </p>
          <p lang={lang} className="text-sm">{translation}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {d.url ? (
          <ExternalLink href={d.url} lang={lang} className="btn btn-primary min-h-10 text-sm">
            {t({ ro: "Deschide pagina originală", ru: "Открыть оригинал" })}
          </ExternalLink>
        ) : (
          <span className="text-sm text-demo">{t({ ro: "Document fictiv — nu are URL.", ru: "Вымышленный документ — URL нет." })}</span>
        )}
        <Link href={`/surse/${d.id}#${encodeURIComponent(p.id)}`} className="btn btn-secondary min-h-10 text-sm">
          {t({ ro: "Documentul în corpus", ru: "Документ в корпусе" })}
        </Link>
      </div>

      <CitationReport passageId={p.id} claimId={sel.claimId} question={question} />
    </div>
  );
}

function CitationReport({ passageId, claimId, question }: { passageId: string; claimId: string; question: string }) {
  const { lang, t } = useLang();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const uid = useId();
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState("");

  const reasons = [
    { v: "wrong_passage", l: { ro: "Pasajul nu susține afirmația", ru: "Фрагмент не подтверждает утверждение" } },
    { v: "outdated", l: { ro: "Informația pare depășită", ru: "Информация кажется устаревшей" } },
    { v: "misread", l: { ro: "Afirmația interpretează greșit pasajul", ru: "Утверждение неверно толкует фрагмент" } },
    { v: "other", l: { ro: "Altceva", ru: "Другое" } },
  ];

  if (state === "sent")
    return (
      <p role="status" className="rounded-lg bg-ok-soft p-2 text-sm font-semibold text-ok">
        <span aria-hidden="true">✓ </span>
        {t({ ro: "Mulțumim. Semnalarea a fost salvată local pentru revizuire (prototip).", ru: "Спасибо. Сообщение сохранено локально для проверки (прототип)." })}
      </p>
    );

  return (
    <div className="border-t border-line pt-3">
      <button type="button" className="btn btn-quiet min-h-9 px-2 text-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true">⚑</span>
        {t({ ro: "Semnalează o citare greșită sau depășită", ru: "Сообщить о неверной или устаревшей цитате" })}
      </button>
      {open && (
        <form
          className="mt-2 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!reason) {
              setErr(t({ ro: "Alegeți un motiv.", ru: "Выберите причину." }));
              return;
            }
            setErr("");
            setState("sending");
            const r = await fetch("/api/feedback", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ type: "citation", passageId, claimId, reason, comment, question, lang }),
            }).catch(() => null);
            setState(r?.ok ? "sent" : "error");
          }}
        >
          <fieldset>
            <legend className="field-label text-sm">{t({ ro: "Ce nu este în regulă?", ru: "Что не так?" })}</legend>
            {reasons.map((r) => (
              <label key={r.v} className="flex min-h-9 items-center gap-2 text-sm">
                <input type="radio" name={`reason-${passageId}`} value={r.v} checked={reason === r.v} onChange={() => setReason(r.v)} className="h-4 w-4" />
                {r.l[lang]}
              </label>
            ))}
          </fieldset>
          {err && <p role="alert" className="text-sm font-semibold text-bad">{err}</p>}
          <label className="field-label text-sm" htmlFor={`cm-${uid}-${passageId}`}>
            {t({ ro: "Comentariu (opțional)", ru: "Комментарий (необязательно)" })}
          </label>
          <textarea id={`cm-${uid}-${passageId}`} className="input text-sm" rows={2} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className="btn btn-secondary min-h-10 text-sm" disabled={state === "sending"}>
            {state === "sending" ? t({ ro: "Se trimite…", ru: "Отправка…" }) : t({ ro: "Trimite semnalarea", ru: "Отправить" })}
          </button>
          {state === "error" && <p role="alert" className="text-sm text-bad">{t({ ro: "Nu s-a salvat. Încercați din nou.", ru: "Не сохранено. Попробуйте ещё раз." })}</p>}
        </form>
      )}
    </div>
  );
}

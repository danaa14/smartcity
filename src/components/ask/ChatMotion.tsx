"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLang } from "../LangProvider";
import type { Answer } from "@/lib/answer/types";
import type { L10n } from "@/lib/i18n";

function useReducedMotion() {
  return (
  useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(prefers-reduced-motion: reduce)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  ));
}

function Spinner() {
  return <span aria-hidden="true" className="pf-spin inline-block h-3.5 w-3.5 rounded-full border-2 border-brand border-t-transparent" />;
}

function Check() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="pf-check h-3.5 w-3.5 text-ok">
      <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface Step {
  label: L10n;
  detail?: L10n;
}

/** Steps derived from the real answer object; nothing is shown as done before the answer exists. */
function stepsFor(a: Answer): Step[] {
  const cand = a.engine.retrieval.candidates;
  const passages = Object.keys(a.passages).length;
  const docs = Object.keys(a.docs).length;
  const v = a.validation;
  const out: Step[] = [
    {
      label: { ro: "Căutare în corpus", ru: "Поиск по корпусу" },
      detail: cand.length
        ? { ro: `subiect: ${a.topicTitle?.ro ?? "—"}`, ru: `тема: ${a.topicTitle?.ru ?? "—"}` }
        : { ro: "niciun subiect potrivit", ru: "подходящей темы нет" },
    },
    {
      label: { ro: "Pasaje citite", ru: "Прочитано фрагментов" },
      detail: { ro: `${passages} pasaje din ${docs} documente`, ru: `${passages} фрагментов из ${docs} документов` },
    },
  ];
  if (a.engine.mode === "llm")
    out.push({ label: { ro: "Redactare cu modelul", ru: "Составление моделью" }, detail: { ro: a.engine.model ?? "", ru: a.engine.model ?? "" } });
  out.push({
    label: { ro: "Verificare citate", ru: "Проверка цитат" },
    detail: {
      ro: `${v.passed}/${v.checked} confirmate verbatim${v.dropped.length ? `, ${v.dropped.length} eliminate` : ""}`,
      ru: `${v.passed}/${v.checked} подтверждено дословно${v.dropped.length ? `, ${v.dropped.length} удалено` : ""}`,
    },
  });
  if (a.conflicts.length) out.push({ label: { ro: "Contradicție detectată", ru: "Обнаружено противоречие" }, detail: { ro: `${a.conflicts.length} grup(uri)`, ru: `${a.conflicts.length} групп(а)` } });
  if (a.missing.length) out.push({ label: { ro: "Lacune marcate", ru: "Отмечены пробелы" }, detail: { ro: `${a.missing.length} puncte lipsă`, ru: `${a.missing.length} пунктов нет` } });
  if (a.steps.length) out.push({ label: { ro: "Traseu construit", ru: "Маршрут построен" }, detail: { ro: `${a.steps.length} pași`, ru: `${a.steps.length} шагов` } });
  return out;
}

const PENDING: L10n[] = [
  { ro: "Caut în surse", ru: "Ищу в источниках" },
  { ro: "Citesc pasajele", ru: "Читаю фрагменты" },
  { ro: "Verific citatele", ru: "Проверяю цитаты" },
];

/** Shown while waiting. Only the current activity is animated; no step is claimed as finished. */
export function ToolTracePending({ startedAt }: { startedAt: number }) {
  const { t } = useLang();
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const secs = Math.max(0, Math.floor((now - startedAt) / 1000));
  const phase = Math.min(PENDING.length - 1, Math.floor(secs / 3));
  return (
    <div className="pf-bot-in w-full max-w-md space-y-2" aria-hidden="true">
      <div className="flex items-center gap-2 text-sm">
        <Spinner />
        <span className="pf-shimmer-text font-semibold">{t(PENDING[phase])}…</span>
        <span className="ml-auto tabular-nums text-xs text-muted">{secs}s</span>
      </div>
      <div className="space-y-1.5 pl-5">
        <div className="pf-skeleton h-3 w-11/12" />
        <div className="pf-skeleton h-3 w-9/12" />
        <div className="pf-skeleton h-3 w-10/12" />
      </div>
    </div>
  );
}

/** ChatGPT-style collapsible "worked for Ns" tool trace, built from the answer's real metadata. */
export function ToolTrace({ answer, durationMs, animate }: { answer: Answer; durationMs?: number; animate: boolean }) {
  const { t } = useLang();
  const reduce = useReducedMotion();
  const steps = stepsFor(answer);
  const [shown, setShown] = useState(animate && !reduce ? 0 : steps.length);
  const [open, setOpen] = useState(animate);
  const closeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (shown >= steps.length) {
      if (animate) closeTimer.current = window.setTimeout(() => setOpen(false), 1400);
      return () => window.clearTimeout(closeTimer.current);
    }
    const id = window.setTimeout(() => setShown((s) => s + 1), 170);
    return () => window.clearTimeout(id);
  }, [shown, steps.length, animate]);

  const secs = durationMs != null ? Math.max(1, Math.round(durationMs / 1000)) : null;
  const engine = answer.engine.mode === "llm" ? answer.engine.model : answer.engine.mode === "llm-fallback" ? t({ ro: "mod determinist (model indisponibil)", ru: "детерминированный режим (модель недоступна)" }) : t({ ro: "mod determinist", ru: "детерминированный режим" });

  return (
    <div className="mb-2 text-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          window.clearTimeout(closeTimer.current);
          setOpen((o) => !o);
        }}
        className="group inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-white px-3 text-muted hover:border-brand hover:text-brand"
      >
        {shown < steps.length ? <Spinner /> : <Check />}
        <span className="font-semibold">
          {secs != null ? t({ ro: `Lucrat ${secs}s`, ru: `Работал ${secs} с` }) : t({ ro: "Pașii de lucru", ru: "Шаги работы" })} · {steps.length} {t({ ro: "instrumente", ru: "инструментов" })}
        </span>
        <span className="hidden text-xs sm:inline">· {engine}</span>
        <span aria-hidden="true" className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      <div className="pf-collapse" data-open={open}>
        <div>
          <ol className="mt-2 space-y-1.5 border-l-2 border-line pl-4">
            {steps.slice(0, shown).map((s, i) => (
              <li key={i} className="pf-bot-in flex items-baseline gap-2">
                <Check />
                <span className="font-medium text-ink">{t(s.label)}</span>
                {s.detail && <span className="text-muted">— {t(s.detail)}</span>}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

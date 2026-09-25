"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "../LangProvider";
import type { Answer } from "@/lib/answer/types";
import { EXAMPLES } from "@/lib/corpus/examples";
import { fmtDate, type Lang } from "@/lib/i18n";
import { AnswerView } from "./AnswerView";
import { DemoBadge, StatusBadge } from "../ui";

const HISTORY_KEY = "pefir_history";

export function AskClient({ initialQuestion, coverage }: { initialQuestion: string; lang: Lang; coverage: { real: number; demo: number; retrievedAt: string } }) {
  const { lang, t } = useLang();
  const router = useRouter();
  const [question, setQuestion] = useState(initialQuestion);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const resultRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const asked = useRef<string | null>(null);

  const ask = useCallback(
    async (q: string) => {
      const text = q.trim();
      if (!text) {
        setError(t({ ro: "Scrieți o întrebare (de exemplu: „Ce acte trebuie pentru contractul de apă?”).", ru: "Напишите вопрос (например: «Какие документы нужны для договора на воду?»)." }));
        inputRef.current?.focus();
        return;
      }
      setError(null);
      setLoading(true);
      setAnnounce(t({ ro: "Se caută în surse…", ru: "Идёт поиск по источникам…" }));
      try {
        const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: text, lang }) });
        if (!res.ok) throw new Error(String(res.status));
        const a = (await res.json()) as Answer;
        setAnswer(a);
        asked.current = text;
        setAnnounce(`${t({ ro: "Răspuns gata.", ru: "Ответ готов." })} ${a.summary[lang]}`);
        try {
          const prev: string[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
          localStorage.setItem(HISTORY_KEY, JSON.stringify([text, ...prev.filter((x) => x !== text)].slice(0, 5)));
        } catch {}
        const url = `/intreaba?q=${encodeURIComponent(text)}`;
        window.history.replaceState(null, "", url);
        requestAnimationFrame(() => resultRef.current?.focus());
      } catch {
        setError(t({ ro: "Nu am putut obține răspunsul. Întrebarea a rămas în câmp — încercați din nou.", ru: "Не удалось получить ответ. Вопрос остался в поле — попробуйте ещё раз." }));
        setAnnounce("");
      } finally {
        setLoading(false);
      }
    },
    [lang, t],
  );

  useEffect(() => {
    if (initialQuestion && asked.current !== initialQuestion) void ask(initialQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t({ ro: "Întreabă primăria", ru: "Спросить примэрию" })}</h1>
        <p className="text-sm text-muted">
          <span aria-hidden="true">◉ </span>
          {t({ ro: "Corpus:", ru: "Корпус:" })} {coverage.real} {t({ ro: "surse reale", ru: "реальных источников" })} + {coverage.demo} DEMO ·{" "}
          {t({ ro: "preluat la", ru: "получено" })} {fmtDate(coverage.retrievedAt, lang)} ·{" "}
          <Link href="/surse" className="link">{t({ ro: "vezi sursele", ru: "источники" })}</Link>
        </p>
      </div>

      <form
        className="card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
        noValidate
      >
        <label htmlFor="q" className="field-label text-lg">
          {t({ ro: "Întrebarea dvs.", ru: "Ваш вопрос" })}
        </label>
        <span id="q-hint" className="field-hint">
          {t({ ro: "Scrieți în română sau rusă. Nu includeți date personale (IDNP, telefon).", ru: "Пишите на румынском или русском. Не указывайте личные данные (IDNP, телефон)." })}
        </span>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <textarea
            ref={inputRef}
            id="q"
            rows={2}
            maxLength={500}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(question);
              }
            }}
            aria-describedby={`q-hint${error ? " q-err" : ""}`}
            aria-invalid={!!error || undefined}
            className="input min-h-14 resize-y text-lg"
          />
          <button type="submit" className="btn btn-primary min-w-32 text-lg" disabled={loading} aria-describedby="q-hint">
            {loading ? (
              <>
                <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {t({ ro: "Caut…", ru: "Ищу…" })}
              </>
            ) : (
              t({ ro: "Întreabă", ru: "Спросить" })
            )}
          </button>
        </div>
        {error && (
          <p id="q-err" role="alert" className="mt-2 font-semibold text-bad">
            <span aria-hidden="true">⚠ </span>
            {error}
          </p>
        )}
      </form>

      <p aria-live="polite" className="sr-only">{announce}</p>

      {answer ? (
        <AnswerView
          key={answer.generatedAt}
          answer={answer}
          headingRef={resultRef}
          onFollowUp={(q) => {
            setQuestion(q);
            void ask(q);
          }}
        />
      ) : (
        !loading && <Examples onPick={(q) => { setQuestion(q); router.replace(`/intreaba?q=${encodeURIComponent(q)}`); void ask(q); }} />
      )}
    </div>
  );
}

function Examples({ onPick }: { onPick: (q: string) => void }) {
  const { lang, t } = useLang();
  return (
    <section aria-labelledby="ex-h" className="space-y-3">
      <h2 id="ex-h" className="text-lg font-bold">{t({ ro: "Întrebări-exemplu (legate de sursele indexate)", ru: "Примеры вопросов (по проиндексированным источникам)" })}</h2>
      <p className="text-sm text-muted">
        {t({ ro: "Fiecare exemplu arată ce stare de răspuns veți vedea. Exemplul cu terasa folosește documente DEMO fictive, ca să arate o contradicție.", ru: "У каждого примера указано, какое состояние ответа вы увидите. Пример с террасой использует вымышленные DEMO-документы, чтобы показать противоречие." })}
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {EXAMPLES.map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => onPick(e.q[lang])} className="card flex h-full w-full flex-col items-start gap-2 p-3 text-left hover:border-brand hover:bg-brand-soft">
              <span className="font-semibold">{e.q[lang]}</span>
              <span className="flex flex-wrap gap-1.5">
                <StatusBadge status={e.expected} lang={lang} size="sm" />
                {e.demo && <DemoBadge lang={lang} />}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

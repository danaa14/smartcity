"use client";

import { useId, useState } from "react";
import { useLang } from "../LangProvider";
import type { Answer } from "@/lib/answer/types";

export function Feedback({ answer }: { answer: Answer }) {
  const { lang, t } = useLang();
  const uid = useId();
  const [useful, setUseful] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const send = async (u: boolean, c?: string) => {
    setState("sending");
    const r = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "rating", useful: u, comment: c, question: answer.question, topicId: answer.topicId, status: answer.status, lang }),
    }).catch(() => null);
    setState(r?.ok ? "sent" : "error");
  };

  return (
    <section aria-labelledby={`${uid}-fb-h`} className="card p-4">
      <h3 id={`${uid}-fb-h`} className="font-bold">{t({ ro: "A fost util acest răspuns?", ru: "Был ли этот ответ полезен?" })}</h3>
      {state === "sent" && !comment && useful !== null ? (
        <div className="mt-2 space-y-2">
          <p role="status" className="font-semibold text-ok">
            <span aria-hidden="true">✓ </span>
            {t({ ro: "Mulțumim! Evaluarea a fost salvată.", ru: "Спасибо! Оценка сохранена." })}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const c = (new FormData(e.currentTarget).get("c") as string).trim();
              if (c) {
                setComment(c);
                void send(useful, c);
              }
            }}
            className="space-y-2"
          >
            <label htmlFor={`${uid}-fb-c`} className="field-label text-sm">
              {useful ? t({ ro: "Ce v-a ajutat cel mai mult? (opțional)", ru: "Что помогло больше всего? (необязательно)" }) : t({ ro: "Ce a lipsit sau a fost greșit? (opțional)", ru: "Чего не хватило или что было неверно? (необязательно)" })}
            </label>
            <textarea id={`${uid}-fb-c`} name="c" rows={2} maxLength={1000} className="input text-sm" />
            <button className="btn btn-secondary min-h-10 text-sm">{t({ ro: "Trimite comentariul", ru: "Отправить комментарий" })}</button>
          </form>
        </div>
      ) : state === "sent" ? (
        <p role="status" className="mt-2 font-semibold text-ok">
          <span aria-hidden="true">✓ </span>
          {t({ ro: "Comentariul a fost salvat local pentru echipă (prototip).", ru: "Комментарий сохранён локально для команды (прототип)." })}
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {[true, false].map((u) => (
            <button
              key={String(u)}
              type="button"
              disabled={state === "sending"}
              aria-pressed={useful === u}
              onClick={() => {
                setUseful(u);
                void send(u);
              }}
              className="btn btn-secondary min-w-28"
            >
              <span aria-hidden="true">{u ? "👍" : "👎"}</span>
              {u ? t({ ro: "Da, util", ru: "Да, полезно" }) : t({ ro: "Nu prea", ru: "Не очень" })}
            </button>
          ))}
          {state === "error" && <p role="alert" className="w-full text-sm text-bad">{t({ ro: "Nu s-a salvat. Încercați din nou.", ru: "Не сохранено. Попробуйте ещё раз." })}</p>}
        </div>
      )}
    </section>
  );
}

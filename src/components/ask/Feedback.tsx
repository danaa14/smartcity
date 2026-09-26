"use client";

import { useId, useState } from "react";
import { useLang } from "../LangProvider";
import type { Answer } from "@/lib/answer/types";

export function Feedback({ answer }: { answer: Answer }) {
  const { lang, t } = useLang();
  const uid = useId();
  const [useful, setUseful] = useState<boolean | null>(null);
  const [commented, setCommented] = useState(false);
  const [showComment, setShowComment] = useState(false);
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

  if (state === "sent" && commented)
    return (
      <p role="status" className="feedback-quiet feedback-done">
        <span aria-hidden="true">✓</span>
        {t({ ro: "Mulțumim, comentariul a fost salvat.", ru: "Спасибо, комментарий сохранён." })}
      </p>
    );

  if (state === "sent" && showComment)
    return (
      <form
        className="feedback-quiet feedback-comment"
        onSubmit={(e) => {
          e.preventDefault();
          const c = (new FormData(e.currentTarget).get("c") as string).trim();
          if (!c) return setShowComment(false);
          setCommented(true);
          void send(useful!, c);
        }}
      >
        <label htmlFor={`${uid}-fb-c`}>
          {useful ? t({ ro: "Ce v-a ajutat cel mai mult?", ru: "Что помогло больше всего?" }) : t({ ro: "Ce a lipsit sau a fost greșit?", ru: "Чего не хватило или что было неверно?" })}
        </label>
        <textarea id={`${uid}-fb-c`} name="c" rows={2} maxLength={1000} className="input text-sm" autoFocus />
        <button className="btn btn-quiet min-h-9 px-2 text-xs">{t({ ro: "Trimite", ru: "Отправить" })}</button>
      </form>
    );

  if (state === "sent")
    return (
      <p className="feedback-quiet feedback-done">
        <span role="status">
          <span aria-hidden="true">✓ </span>
          {t({ ro: "Mulțumim.", ru: "Спасибо." })}
        </span>
        <button type="button" onClick={() => setShowComment(true)}>{t({ ro: "Adaugă un comentariu", ru: "Добавить комментарий" })}</button>
      </p>
    );

  return (
    <div className="feedback-quiet" role="group" aria-label={t({ ro: "A fost util acest răspuns?", ru: "Был ли этот ответ полезен?" })}>
      <span>{t({ ro: "Util?", ru: "Полезно?" })}</span>
      {[true, false].map((u) => (
        <button
          key={String(u)}
          type="button"
          disabled={state === "sending"}
          aria-label={u ? t({ ro: "Da, util", ru: "Да, полезно" }) : t({ ro: "Nu prea", ru: "Не очень" })}
          onClick={() => {
            setUseful(u);
            void send(u);
          }}
        >
          <span aria-hidden="true">{u ? "👍" : "👎"}</span>
        </button>
      ))}
      {state === "error" && <span role="alert" className="text-bad">{t({ ro: "Nu s-a salvat.", ru: "Не сохранено." })}</span>}
    </div>
  );
}

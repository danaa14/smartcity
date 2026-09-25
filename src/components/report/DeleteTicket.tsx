"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "../LangProvider";

export function DeleteTicket({ id }: { id: string }) {
  const { t } = useLang();
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [err, setErr] = useState(false);
  const [done, setDone] = useState(false);

  if (done)
    return (
      <p role="status" className="font-semibold text-ok">
        ✓ {t({ ro: "Tichetul și fișierele lui au fost șterse de pe acest computer.", ru: "Заявка и её файлы удалены с этого компьютера." })}
      </p>
    );

  return ask ? (
    <div role="group" aria-label={t({ ro: "Confirmați ștergerea", ru: "Подтвердите удаление" })} className="flex flex-wrap items-center gap-2 rounded-lg border border-bad bg-bad-soft p-2">
      <span className="text-sm font-semibold">{t({ ro: "Ștergeți definitiv tichetul și fișierele?", ru: "Удалить заявку и файлы навсегда?" })}</span>
      <button
        type="button"
        autoFocus
        className="btn min-h-10 bg-bad text-white"
        onClick={async () => {
          const r = await fetch(`/api/tickets/${id}`, { method: "DELETE" }).catch(() => null);
          if (r?.ok) {
            setDone(true);
            setTimeout(() => router.push("/raporteaza"), 1500);
          } else setErr(true);
        }}
      >
        {t({ ro: "Da, șterge", ru: "Да, удалить" })}
      </button>
      <button type="button" className="btn btn-quiet min-h-10" onClick={() => setAsk(false)}>{t({ ro: "Anulează", ru: "Отмена" })}</button>
      {err && <p role="alert" className="w-full text-sm text-bad">{t({ ro: "Ștergerea a eșuat. Încercați din nou.", ru: "Удаление не удалось. Попробуйте снова." })}</p>}
    </div>
  ) : (
    <button type="button" className="btn border border-bad bg-white text-bad hover:bg-bad-soft" onClick={() => setAsk(true)}>
      {t({ ro: "Șterge tichetul și fișierele", ru: "Удалить заявку и файлы" })}
    </button>
  );
}

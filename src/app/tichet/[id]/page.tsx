import type { Metadata } from "next";
import Link from "next/link";
import { getLang } from "@/lib/i18n/server";
import { fmtDateTime, tr } from "@/lib/i18n";
import { tickets } from "@/lib/tickets/repo";
import { CATEGORIES } from "@/lib/tickets/types";
import { Notice } from "@/components/ui";
import { DeleteTicket } from "@/components/report/DeleteTicket";

export const metadata: Metadata = { title: "Tichet demo" };
export const dynamic = "force-dynamic";

export default async function TicketPage(props: PageProps<"/tichet/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const lang = await getLang();
  const t = (x: { ro: string; ru: string }) => tr(x, lang);
  const tk = await tickets.get(id);

  if (!tk)
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold">{t({ ro: "Tichetul nu a fost găsit", ru: "Заявка не найдена" })}</h1>
        <p>{t({ ro: `Nu există tichetul „${id}” pe acest computer. Poate a fost șters.`, ru: `Заявки «${id}» нет на этом компьютере. Возможно, она удалена.` })}</p>
        <Link href="/raporteaza" className="btn btn-primary">{t({ ro: "Raportează o problemă", ru: "Сообщить о проблеме" })}</Link>
      </div>
    );

  const cat = CATEGORIES.find((c) => c.id === tk.category)!;
  const fresh = sp.nou === "1";
  const timeline = [
    { done: true, label: { ro: "Tichet creat și salvat local (demo)", ru: "Заявка создана и сохранена локально (демо)" }, at: tk.createdAt },
    { done: false, label: { ro: "Trimis către Primărie — NU (nu există integrare)", ru: "Отправлено в Примэрию — НЕТ (интеграции нет)" } },
    { done: false, label: { ro: "Înregistrat de o instituție — nu se aplică", ru: "Зарегистрировано учреждением — не применимо" } },
    { done: false, label: { ro: "Soluționat — nu se aplică", ru: "Решено — не применимо" } },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {fresh && (
        <div role="status" className="rounded-xl border-2 border-ok bg-ok-soft p-4">
          <p className="text-lg font-bold text-ok">✓ {t({ ro: "Tichetul demo a fost creat", ru: "Демо-заявка создана" })}</p>
          <p>{t({ ro: "Păstrați numărul pentru a reveni la această pagină.", ru: "Сохраните номер, чтобы вернуться на эту страницу." })}</p>
        </div>
      )}

      <div className="rounded-xl border-2 border-demo bg-demo-soft p-4">
        <p className="text-lg font-bold uppercase tracking-wide text-demo">◇ {t({ ro: "Tichet demo — netrimis la Primărie", ru: "Демо-заявка — не отправлена в Примэрию" })}</p>
        <p className="text-sm">
          {t({ ro: "Nicio instituție nu a primit această sesizare și nimeni nu o procesează. Pentru o sesizare reală folosiți portalul oficial „Sesizează” de pe ", ru: "Ни одно учреждение не получило это обращение, и никто его не обрабатывает. Для реального обращения используйте официальный портал «Sesizează» на " })}
          <a className="link" href="https://www.chisinau.md/ro" target="_blank" rel="noopener noreferrer">chisinau.md ↗</a>.
        </p>
      </div>

      <header>
        <p className="text-sm text-muted">{t({ ro: "Număr tichet", ru: "Номер заявки" })}</p>
        <h1 className="font-mono text-2xl font-bold tracking-wide sm:text-3xl">{tk.id}</h1>
        <p className="text-sm text-muted">{fmtDateTime(tk.createdAt, lang)}</p>
      </header>

      <section aria-labelledby="tl-h" className="card p-4">
        <h2 id="tl-h" className="font-bold">{t({ ro: "Stare", ru: "Статус" })}</h2>
        <ol className="mt-3 space-y-3">
          {timeline.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span aria-hidden="true" className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${s.done ? "bg-ok text-white" : "border-2 border-line text-muted"}`}>{s.done ? "✓" : "–"}</span>
              <span className={s.done ? "font-semibold" : "text-muted"}>
                <span className="sr-only">{s.done ? t({ ro: "Realizat: ", ru: "Выполнено: " }) : t({ ro: "Nerealizat: ", ru: "Не выполнено: " })}</span>
                {s.label[lang]}
                {s.at && <span className="block text-sm font-normal text-muted">{fmtDateTime(s.at, lang)}</span>}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="det-h" className="card p-4">
        <h2 id="det-h" className="font-bold">{t({ ro: "Detalii salvate", ru: "Сохранённые данные" })}</h2>
        <dl className="mt-2 divide-y divide-line">
          {[
            [t({ ro: "Categoria", ru: "Категория" }), `${cat.label[lang]}${tk.categoryChangedByUser ? t({ ro: " (corectată de dvs.)", ru: " (исправлено вами)" }) : tk.categorySuggested ? t({ ro: " (sugestie confirmată)", ru: " (подсказка подтверждена)" }) : ""}`],
            [t({ ro: "Locul", ru: "Место" }), `${tk.location.text}${tk.location.lat != null ? ` · GPS ${tk.location.lat}, ${tk.location.lng}` : ""}`],
            [t({ ro: "Descrierea", ru: "Описание" }), tk.description],
            [t({ ro: "Canal", ru: "Канал" }), tk.channel === "phone-demo" ? t({ ro: "Telefon (demo)", ru: "Телефон (демо)" }) : "Web"],
            [t({ ro: "Adaptor de trimitere", ru: "Адаптер отправки" }), `${tk.submission.adapter} — ${tk.submission.submitted ? "trimis" : t({ ro: "netrimis", ru: "не отправлено" })}`],
          ].map(([k, v]) => (
            <div key={k} className="grid gap-1 py-2 sm:grid-cols-[11rem_1fr]">
              <dt className="font-semibold">{k}</dt>
              <dd className="break-words">{v}</dd>
            </div>
          ))}
        </dl>
        {tk.media.length > 0 && (
          <div className="mt-3 space-y-2">
            <h3 className="font-semibold">{t({ ro: "Fișiere atașate (stocate local)", ru: "Прикреплённые файлы (хранятся локально)" })}</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {tk.media.map((m) => {
                const src = `/api/tickets/${tk.id}/media/${m.file}`;
                return (
                  <li key={m.file} className="rounded border border-line p-2">
                    {m.kind === "photo" && <img src={src} alt={t({ ro: "Fotografie atașată la sesizare", ru: "Фото, приложенное к обращению" })} className="max-h-48 w-full rounded object-contain" />}
                    {m.kind === "video" && <video src={src} controls className="max-h-48 w-full" aria-label={t({ ro: "Video atașat", ru: "Прикреплённое видео" })} />}
                    {m.kind === "audio" && <audio src={src} controls className="w-full" aria-label={t({ ro: "Mesaj vocal atașat", ru: "Прикреплённое голосовое сообщение" })} />}
                    <p className="mt-1 text-xs text-muted">{m.mime} · {Math.round(m.bytes / 1024)} KB</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <Notice tone="info" title={t({ ro: "Ce urmează", ru: "Что дальше" })}>
        {t({ ro: "Dacă problema este reală și urgentă, raportați-o prin canalul oficial al Primăriei. Acest tichet rămâne doar pe computerul care rulează prototipul.", ru: "Если проблема реальная и срочная, сообщите о ней через официальный канал Примэрии. Эта заявка остаётся только на компьютере, где запущен прототип." })}
      </Notice>

      <div className="flex flex-wrap gap-2">
        <Link href="/raporteaza" className="btn btn-secondary">{t({ ro: "Raportează altă problemă", ru: "Сообщить о другой проблеме" })}</Link>
        <DeleteTicket id={tk.id} />
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "../LangProvider";
import { SERVICES, CATEGORIES, type Ticket } from "@/lib/tickets/types";
import { RECIPIENTS } from "@/lib/tickets/recipients";
import { DeleteTicket } from "./DeleteTicket";

export function TicketJourney({ initial, fresh }: { initial: Ticket; fresh: boolean }) {
  const { lang, t } = useLang();
  const [ticket, setTicket] = useState(initial);
  const [refreshError, setRefreshError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [refreshRequest, setRefreshRequest] = useState(0);
  useEffect(() => {
    let active = true;
    let pending = false;
    let controller: AbortController | null = null;
    const refresh = async () => {
      if (document.hidden || pending) return;
      pending = true;
      setRefreshing(true);
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10000);
      try {
        const response = await fetch(`/api/tickets/${initial.id}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("refresh");
        const updated: Ticket = await response.json();
        if (active) { setTicket(updated); setRefreshError(false); setLastChecked(new Date()); }
      } catch { if (active) setRefreshError(true); }
      finally { clearTimeout(timeout); pending = false; if (active) setRefreshing(false); }
    };
    const initialRefresh = setTimeout(() => void refresh(), 0);
    const interval = setInterval(() => void refresh(), 5000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      active = false;
      clearTimeout(initialRefresh); clearInterval(interval); controller?.abort();
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [initial.id, refreshRequest]);
  const service = SERVICES.find(item => item.id === ticket.service)?.label[lang] || RECIPIENTS.find(item => item.id === ticket.recipient)?.label[lang] || SERVICES[0].label[lang];
  const progress = ticket.authorityProgress;
  const steps = [
    { title: t({ ro: "Sesizare înregistrată", ru: "Обращение зарегистрировано" }), text: t({ ro: "Fotografiile și mesajul tău sunt păstrate în tichet.", ru: "Фото и сообщение сохранены в заявке." }), at: ticket.createdAt },
    { title: t({ ro: "Primită de instituție", ru: "Получено учреждением" }), text: ticket.submission.submitted ? service : t({ ro: "În așteptarea conectării cu instituția. Nu a fost trimisă.", ru: "Ожидает подключения к учреждению. Ещё не отправлено." }), at: progress?.receivedAt },
    { title: t({ ro: "Echipa este pe drum", ru: "Команда в пути" }), text: t({ ro: "Aici va apărea confirmarea echipei care intervine.", ru: "Здесь появится подтверждение выезда команды." }), at: progress?.onWayAt },
    { title: t({ ro: "Problema este rezolvată", ru: "Проблема решена" }), text: t({ ro: "Ultimul pas: confirmarea rezolvării.", ru: "Последний шаг — подтверждение решения." }), at: progress?.resolvedAt },
  ];
  const current = Math.max(0, steps.findLastIndex(item => !!item.at));
  return <div className="report-flow ticket-journey">
    <header className="report-intro"><p className="report-eyebrow">{t({ ro: "FIECARE SESIZARE CONTEAZĂ", ru: "КАЖДОЕ ОБРАЩЕНИЕ ВАЖНО" })}</p><h1>{fresh ? t({ ro: "Mulțumim că te implici.", ru: "Спасибо за участие." }) : t({ ro: "Sesizarea ta, pas cu pas.", ru: "Ваше обращение, шаг за шагом." })}</h1><p role={fresh ? "status" : undefined}>{t({ ro: "Urmărește aici ce se întâmplă cu sesizarea ta.", ru: "Следите здесь за ходом вашего обращения." })}</p></header>
    <section className="report-surface"><div className="report-section-head"><div><p className="report-eyebrow">{ticket.id}</p><h2>{ticket.title || ticket.description}</h2><p className="report-muted">{service} · {new Date(ticket.createdAt).toLocaleString(lang === "ru" ? "ru-RU" : "ro-RO")}</p></div><span className="report-leaf" aria-hidden="true">✓</span></div>
      <div className="report-details"><div className="report-note"><strong>{t({ ro: "Tichet demo · salvat local", ru: "Демо-заявка · сохранена локально" })}</strong><p>{t({ ro: "Instituțiile nu sunt conectate la acest prototip. Nicio echipă nu a fost anunțată sau trimisă. Etapele următoare se vor activa doar după confirmări reale.", ru: "Учреждения пока не подключены к прототипу. Команды не оповещены и не направлены. Следующие этапы активируются только после реальных подтверждений." })}</p></div>
        <div className={`ticket-live ${refreshError ? "is-disconnected" : ""}`}>
          <div><p className="ticket-live-label"><span aria-hidden="true" />{refreshError ? t({ ro: "Actualizarea este întreruptă", ru: "Обновление прервано" }) : t({ ro: "Urmărire automată", ru: "Автоматическое отслеживание" })}</p>
          <p className="report-muted">{lastChecked ? `${t({ ro: "Ultima verificare", ru: "Последняя проверка" })}: ${lastChecked.toLocaleTimeString(lang === "ru" ? "ru-RU" : "ro-RO")}` : t({ ro: "Verificăm starea sesizării…", ru: "Проверяем статус обращения…" })}</p>
          <p className="report-muted">{t({ ro: "Se actualizează la fiecare 5 secunde, fără reîncărcarea paginii.", ru: "Обновляется каждые 5 секунд без перезагрузки страницы." })}</p></div>
          <button type="button" className="report-text-button" disabled={refreshing} onClick={() => setRefreshRequest(value => value + 1)}>{refreshing ? t({ ro: "Se verifică…", ru: "Проверяем…" }) : t({ ro: "Actualizează acum ↻", ru: "Обновить сейчас ↻" })}</button>
        </div>
        <div className="ticket-current" role="status" aria-live="polite"><span>{t({ ro: "Starea curentă", ru: "Текущий статус" })}</span><strong>{steps[current].title}</strong></div>
        <ol className="ticket-progress" aria-label={t({ ro: "Evoluția sesizării", ru: "Ход обращения" })}>{steps.map((item, index) => <li key={index} className={item.at ? "is-done" : "is-pending"} aria-current={index === current ? "step" : undefined}><span className="journey-dot" aria-hidden="true">{item.at ? "✓" : `0${index + 1}`}</span><div><h3>{item.title}</h3><p>{item.text}</p>{item.at ? <time>{new Date(item.at).toLocaleString(lang === "ru" ? "ru-RU" : "ro-RO")}</time> : <span className="journey-pending">{t({ ro: "În așteptare", ru: "Ожидается" })}</span>}</div></li>)}</ol>
        {refreshError && <p role="status" className="report-muted">{t({ ro: "Nu am putut actualiza starea. Încercăm din nou automat.", ru: "Не удалось обновить статус. Попробуем снова автоматически." })}</p>}
        {ticket.status === "done" && !progress?.resolvedAt && <p className="report-note">{t({ ro: "Marcat rezolvat în demo. Nu reprezintă o confirmare din partea instituției.", ru: "Отмечено решённым в демо. Это не подтверждение учреждения." })}</p>}
        <details className="ticket-saved-details"><summary>{t({ ro: "Vezi ce ai trimis", ru: "Что вы отправили" })}</summary><p className="report-muted">{CATEGORIES.find(item => item.id === ticket.category)?.label[lang]}{ticket.location.text ? ` · ${ticket.location.text}` : ""}</p>{ticket.description && <p className="report-message">{ticket.description}</p>}{ticket.transcript && <div><h3 className="report-label">{t({ ro: "Mesaj vocal transcris", ru: "Расшифровка сообщения" })}</h3><p className="report-message">{ticket.transcript}</p></div>}<div className="ticket-saved-media">{ticket.media.map(media => { const src = `/api/tickets/${ticket.id}/media/${media.file}`; return <div key={media.file}>{media.kind === "photo" ?
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={t({ ro: "Fotografia sesizării", ru: "Фото обращения" })} /> : media.kind === "video" ? <video controls src={src} /> : <audio controls src={src} />}</div>; })}</div><div className="report-links">{ticket.links?.map(link => /^https?:\/\//i.test(link) && <a key={link} href={link} target="_blank" rel="noopener noreferrer">↗ {link}</a>)}</div></details>
        <div className="report-actions"><Link href="/raporteaza" className="report-primary">{t({ ro: "O nouă sesizare", ru: "Новое обращение" })} ↗</Link><DeleteTicket id={ticket.id} /></div>
      </div>
    </section><p className="report-footer-note">{t({ ro: "Păstrează linkul acestei pagini pentru a reveni la tichet.", ru: "Сохраните ссылку на эту страницу, чтобы вернуться к заявке." })}</p>
  </div>;
}

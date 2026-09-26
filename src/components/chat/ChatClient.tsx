"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "../LangProvider";
import { Icon } from "./Icon";
import type { Answer } from "@/lib/answer/types";
import { AnswerView } from "../ask/AnswerView";
import { EXAMPLES } from "@/lib/corpus/examples";

type Turn = { id: number; question: string; answer?: Answer; failed?: boolean };
type Sheet = "faq" | "call" | "tools";

const FAQ = [
  { q: { ro: "Cu ce mă poate ajuta pe fir?", ru: "Чем поможет «pe fir»?" }, a: { ro: "Găsiți informații despre contractul de apă, petiții, deșeuri și cereri pentru arbori. Fiecare răspuns are surse pe care le puteți verifica. Puteți și scana un document sau pregăti o sesizare demo.", ru: "Здесь можно найти сведения о договорах на воду, петициях, вывозе мусора и заявлениях по деревьям. У ответов есть проверяемые источники. Также можно сканировать документ или подготовить демо-обращение." } },
  { q: { ro: "Sesizarea mea ajunge la Primărie?", ru: "Моё обращение попадёт в примэрию?" }, a: { ro: "Nu încă. Acesta este un prototip independent, nu un serviciu oficial. Sesizările sunt salvate doar pe serverul prototipului, ca tichete demo. Pentru o sesizare reală, folosiți canalele oficiale ale Primăriei.", ru: "Пока нет. Это независимый прототип, а не официальный сервис. Обращения сохраняются только на сервере прототипа как демо-заявки. Для настоящего обращения используйте официальные каналы примэрии." } },
  { q: { ro: "De unde vin răspunsurile?", ru: "Откуда берутся ответы?" }, a: { ro: "Din pagini și documente publicate de instituții, incluse în colecția noastră. Apăsați numărul de lângă o informație pentru a vedea pasajul original. Dacă ceva lipsește sau nu este clar, vă spunem.", ru: "Из опубликованных учреждениями страниц и документов в нашей подборке. Нажмите номер рядом со сведениями, чтобы увидеть оригинальный фрагмент. Если информации недостаточно или она неоднозначна, мы сообщим об этом." } },
  { q: { ro: "Ce documente pot scana?", ru: "Какие документы можно сканировать?" }, a: { ro: "Fotografii JPG, PNG, WEBP, TIFF sau fișiere PDF, până la 10 MB. Se citește doar prima pagină a PDF-ului. Verificarea câmpurilor este disponibilă pentru formularul AGSV inclus în exemplu; pentru alte documente primiți textul recunoscut.", ru: "Фото JPG, PNG, WEBP, TIFF или PDF до 10 МБ. Читается только первая страница PDF. Проверка полей доступна для формы AGSV из примера; для других документов доступен распознанный текст." } },
  { q: { ro: "Trebuie să introduc date personale?", ru: "Нужно вводить личные данные?" }, a: { ro: "Nu cerem nume, telefon sau IDNP. Evitați datele personale în întrebări și fotografii. Documentele scanate sunt șterse după procesare; tichetele demo pot fi șterse din pagina lor. Într-o configurație cu AI extern, întrebarea și sursele sunt trimise furnizorului.", ru: "Мы не запрашиваем имя, телефон или IDNP. Не указывайте личные данные в вопросах и фото. Сканируемые документы удаляются после обработки; демо-заявки можно удалить на их странице. При подключённом внешнем ИИ вопрос и источники передаются провайдеру." } },
];

export function ChatClient({ initialQuestion = "" }: { initialQuestion?: string }) {
  const { lang, t } = useLang();
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<Sheet>("faq");
  const [validation, setValidation] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const initialSent = useRef(false);
  const lastTrigger = useRef<HTMLElement | null>(null);

  const ask = useCallback(async (question: string, retryId?: number) => {
    if (pending.current) return;
    const text = question.trim();
    if (!text) { setValidation(true); input.current?.focus(); return; }
    pending.current = true;
    setBusy(true);
    setValidation(false);
    setDraft("");
    const id = retryId ?? ++sequence.current;
    setTurns((prev) => retryId === undefined ? [...prev, { id, question: text }] : prev.map((turn) => turn.id === id ? { id, question: text } : turn));
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 100000);
    try {
      const response = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: text, lang }), signal: abort.signal });
      if (!response.ok) throw new Error("request_failed");
      const answer = await response.json() as Answer;
      setTurns((prev) => prev.map((turn) => turn.id === id ? { ...turn, answer } : turn));
    } catch {
      setTurns((prev) => prev.map((turn) => turn.id === id ? { ...turn, failed: true } : turn));
    } finally {
      clearTimeout(timeout);
      pending.current = false;
      setBusy(false);
    }
  }, [lang]);

  useEffect(() => {
    if (initialQuestion && !initialSent.current) {
      initialSent.current = true;
      void ask(initialQuestion);
    }
  }, [initialQuestion, ask]);

  useEffect(() => {
    const active = scroll.current?.querySelector<HTMLElement>("[data-latest]");
    active?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [turns]);

  const openSheet = (value: Sheet, trigger: HTMLElement) => {
    lastTrigger.current = trigger;
    setSheet(value);
    dialog.current?.showModal();
  };

  return (
    <div className={`chat-layout ${turns.length ? "has-conversation" : ""}`}>
      <div className="chat-scroll" ref={scroll} role="region" aria-label={t({ ro: "Conversație", ru: "Диалог" })} tabIndex={0}>
        {!turns.length ? (
          <section className="chat-welcome" aria-labelledby="welcome-title">
            <div className="welcome-art" aria-hidden="true"><span className="art-orbit" /><span className="art-chat"><Icon name="chat" /></span><span className="art-spark">✦</span></div>
            <h1 id="welcome-title">{t({ ro: "Hai să vorbim", ru: "Поговорим" })}<br />{t({ ro: "despre Chișinău.", ru: "о Кишинэу." })}</h1>
          </section>
        ) : (
          <div className="conversation">
            <h1 className="sr-only">{t({ ro: "Conversația ta", ru: "Ваш диалог" })}</h1>
            {turns.map((turn, index) => (
              <section key={turn.id} className="chat-turn" data-latest={index === turns.length - 1 ? "true" : undefined} aria-label={turn.question}>
                <div className="user-message">{turn.question}</div>
                <div className="assistant-label"><span className="assistant-dot" />pe fir</div>
                {turn.answer ? <div className="chat-answer"><AnswerView answer={turn.answer} headingRef={heading} onFollowUp={(q) => { if (!pending.current) void ask(q); }} compact /></div> : turn.failed ? (
                  <div className="chat-error" role="alert"><p>{t({ ro: "Nu am reușit să obținem răspunsul. Întrebarea ta este păstrată aici.", ru: "Не удалось получить ответ. Ваш вопрос сохранён здесь." })}</p><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void ask(turn.question, turn.id)}>{t({ ro: "Încearcă din nou", ru: "Повторить" })}</button></div>
                ) : <p className="searching"><span className="loading-dots" aria-hidden="true">•••</span>{t({ ro: "Caut în sursele disponibile…", ru: "Ищу в доступных источниках…" })}</p>}
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="chat-dock">
        {!turns.length && <div className="call-prompt"><span>{t({ ro: "Preferi să vorbești cu cineva?", ru: "Хотите поговорить с человеком?" })}</span><button type="button" className="call-button" onClick={(e) => openSheet("call", e.currentTarget)}><Icon name="phone" />{t({ ro: "Sună", ru: "Позвонить" })}</button></div>}
        <div className="faq-bar">
          <button type="button" className="faq-heading" onClick={(e) => openSheet("faq", e.currentTarget)}><Icon name="help" />{t({ ro: "Întrebări frecvente", ru: "Частые вопросы" })}<Icon name="chevron" /></button>
          <div className="question-shortcuts">
            {EXAMPLES.slice(0, 3).map((example, i) => <button type="button" key={example.id} disabled={busy} onClick={() => void ask(example.q[lang])}>{t([{ ro: "Acte pentru apă", ru: "Договор на воду" }, { ro: "O petiție", ru: "Подать петицию" }, { ro: "Tariful la apă", ru: "Тариф на воду" }][i])}<span aria-hidden="true">↗</span></button>)}
          </div>
        </div>
        <form className="chat-composer" onSubmit={(e) => { e.preventDefault(); void ask(draft); }}>
          <button type="button" className="composer-tools" aria-label={t({ ro: "Adaugă un document sau pregătește o sesizare", ru: "Добавить документ или подготовить обращение" })} onClick={(e) => openSheet("tools", e.currentTarget)}><Icon name="plus" /></button>
          <label htmlFor="chat-message" className="sr-only">{t({ ro: "Mesajul tău", ru: "Ваше сообщение" })}</label>
          <textarea ref={input} id="chat-message" rows={1} maxLength={500} value={draft} onChange={(e) => { setDraft(e.target.value); setValidation(false); }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void ask(draft); } }} placeholder={t({ ro: "Scrie întrebarea ta…", ru: "Напишите ваш вопрос…" })} aria-invalid={validation || undefined} aria-describedby={validation ? "chat-validation" : "chat-hint"} />
          <button className="send-button" type="submit" disabled={busy || !draft.trim()} aria-label={t({ ro: "Trimite întrebarea", ru: "Отправить вопрос" })}>{busy ? <span className="send-spinner" /> : <Icon name="arrow" />}</button>
        </form>
        {validation && <p id="chat-validation" className="composer-error" role="alert">{t({ ro: "Scrie o întrebare pentru a începe.", ru: "Напишите вопрос, чтобы начать." })}</p>}
        <p id="chat-hint" className="composer-hint">{t({ ro: "Răspunsuri cu surse. Fără date personale în mesaje.", ru: "Ответы с источниками. Не указывайте личные данные." })}</p>
        <p className="sr-only" role="status">{busy ? t({ ro: "Se caută răspunsul.", ru: "Идёт поиск ответа." }) : turns.at(-1)?.answer ? t({ ro: "Răspunsul este gata.", ru: "Ответ готов." }) : ""}</p>
      </div>

      <dialog ref={dialog} className="utility-sheet" aria-labelledby="sheet-title" onClose={() => lastTrigger.current?.focus()} onClick={(e) => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
        <div className="sheet-inner">
          <div className="sheet-handle" aria-hidden="true" />
          <header className="sheet-header"><h2 id="sheet-title">{sheet === "faq" ? t({ ro: "Bine de știut", ru: "Полезно знать" }) : sheet === "call" ? t({ ro: "Vorbim la telefon?", ru: "Поговорим по телефону?" }) : t({ ro: "Cu ce începem?", ru: "С чего начнём?" })}</h2><button type="button" className="sheet-close" aria-label={t({ ro: "Închide", ru: "Закрыть" })} onClick={() => dialog.current?.close()}><Icon name="close" /></button></header>
          {sheet === "faq" && <div className="faq-list">{FAQ.map((item) => <details key={item.q.ro}><summary>{t(item.q)}<Icon name="plus" /></summary><p>{t(item.a)}</p></details>)}<Link href="/surse" className="sheet-text-link">{t({ ro: "Explorează sursele", ru: "Посмотреть источники" })} ↗</Link></div>}
          {sheet === "call" && <div className="contact-content"><span className="contact-icon"><Icon name="phone" /></span><h3>{t({ ro: "Ghișeul Unic al Primăriei", ru: "Единое окно примэрии" })}</h3><p>{t({ ro: "Pentru întrebări despre serviciile municipale.", ru: "По вопросам муниципальных услуг." })}</p><a className="contact-number" href="tel:+37322201505">+373 22 20 15 05</a><p>{t({ ro: "Luni–vineri · 09:00–16:00\nPauză · 12:00–13:00", ru: "Пн–пт · 09:00–16:00\nПерерыв · 12:00–13:00" })}</p><a className="call-button contact-call" href="tel:+37322201505"><Icon name="phone" />{t({ ro: "Apelează Ghișeul Unic", ru: "Позвонить в Единое окно" })}</a><p className="contact-source">{t({ ro: "Contact din sursa Primăriei, preluată la 25.09.2026. Programul poate fi modificat. Apelul folosește aplicația de telefon a dispozitivului.", ru: "Контакт из источника примэрии от 25.09.2026. Расписание может измениться. Звонок открывается в приложении телефона." })}</p><Link href="/surse/pmc-home" className="sheet-text-link">{t({ ro: "Vezi sursa contactului", ru: "Источник контакта" })} ↗</Link></div>}
          {sheet === "tools" && <div className="tool-list"><Link href="/scaneaza"><span className="tool-icon"><Icon name="document" /></span><span><strong>{t({ ro: "Un document, mai clar", ru: "Разобраться с документом" })}</strong><small>{t({ ro: "Scanează o fotografie sau un PDF", ru: "Сканировать фото или PDF" })}</small></span><Icon name="chevron" /></Link><Link href="/raporteaza"><span className="tool-icon"><Icon name="pin" /></span><span><strong>{t({ ro: "Dă de veste", ru: "Сообщить о проблеме" })}</strong><small>{t({ ro: "Descrie → localizează → verifică · demo", ru: "Опишите → укажите место → проверьте · демо" })}</small></span><Icon name="chevron" /></Link><button type="button" onClick={() => setSheet("call")}><span className="tool-icon"><Icon name="phone" /></span><span><strong>{t({ ro: "Vorbește cu cineva", ru: "Поговорить с человеком" })}</strong><small>{t({ ro: "Contactul Ghișeului Unic", ru: "Контакт Единого окна" })}</small></span><Icon name="chevron" /></button><Link href="/surse"><span className="tool-icon"><Icon name="source" /></span><span><strong>{t({ ro: "Vezi sursele", ru: "Посмотреть источники" })}</strong><small>{t({ ro: "Documentele din spatele răspunsurilor", ru: "Документы, на которых основаны ответы" })}</small></span><Icon name="chevron" /></Link></div>}
        </div>
      </dialog>
    </div>
  );
}

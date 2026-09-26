"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "../LangProvider";
import { Icon } from "./Icon";
import { DocumentTurn, type DocContext } from "./DocumentTurn";
import type { Answer } from "@/lib/answer/types";
import { AnswerView } from "../ask/AnswerView";
import { EXAMPLES } from "@/lib/corpus/examples";
import { useConversations } from "../ConversationProvider";
import type { SavedTurn } from "@/lib/chat/types";
import { VoiceCall } from "./VoiceCall";

type AskTurn = { kind: "ask"; id: number; question: string; answer?: Answer; failed?: string | true; phase?: string; text?: string };
type DocTurn = { kind: "doc"; id: number; file?: File; name?: string; goal: string; ctx?: DocContext };
type Turn = AskTurn | DocTurn;
type Sheet = "faq" | "call" | "tools";

const ACCEPT = "image/*,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;

const settled = (turn?: Turn) => (turn?.kind === "doc" ? !!turn.ctx : !!turn?.answer);

type ServerEvent =
  | { type: "phase"; label: string }
  | { type: "chunk"; text: string }
  | { type: "answer"; answer: Answer }
  | { type: "error"; message: string };

const FAQ = [
  { q: { ro: "Cu ce mă poate ajuta pe fir?", ru: "Чем поможет «pe fir»?" }, a: { ro: "Găsiți informații despre contractul de apă, petiții, deșeuri și cereri pentru arbori. Fiecare răspuns are surse pe care le puteți verifica. Puteți și scana un document sau pregăti o sesizare demo.", ru: "Здесь можно найти сведения о договорах на воду, петициях, вывозе мусора и заявлениях по деревьям. У ответов есть проверяемые источники. Также можно сканировать документ или подготовить демо-обращение." } },
  { q: { ro: "Sesizarea mea ajunge la Primărie?", ru: "Моё обращение попадёт в примэрию?" }, a: { ro: "Nu încă. Acesta este un prototip independent, nu un serviciu oficial. Sesizările sunt salvate doar pe serverul prototipului, ca tichete demo. Pentru o sesizare reală, folosiți canalele oficiale ale Primăriei.", ru: "Пока нет. Это независимый прототип, а не официальный сервис. Обращения сохраняются только на сервере прототипа как демо-заявки. Для настоящего обращения используйте официальные каналы примэрии." } },
  { q: { ro: "De unde vin răspunsurile?", ru: "Откуда берутся ответы?" }, a: { ro: "Din pagini și documente publicate de instituții, incluse în colecția noastră. Apăsați numărul de lângă o informație pentru a vedea pasajul original. Dacă ceva lipsește sau nu este clar, vă spunem.", ru: "Из опубликованных учреждениями страниц и документов в нашей подборке. Нажмите номер рядом со сведениями, чтобы увидеть оригинальный фрагмент. Если информации недостаточно или она неоднозначна, мы сообщим об этом." } },
  { q: { ro: "Ce documente pot scana?", ru: "Какие документы можно сканировать?" }, a: { ro: "Fotografii JPG, PNG, WEBP, TIFF sau fișiere PDF, până la 10 MB. Se citește doar prima pagină a PDF-ului. Verificarea câmpurilor este disponibilă pentru formularul AGSV inclus în exemplu; pentru alte documente primiți textul recunoscut.", ru: "Фото JPG, PNG, WEBP, TIFF или PDF до 10 МБ. Читается только первая страница PDF. Проверка полей доступна для формы AGSV из примера; для других документов доступен распознанный текст." } },
  { q: { ro: "Trebuie să introduc date personale?", ru: "Нужно вводить личные данные?" }, a: { ro: "Nu cerem nume, telefon sau IDNP. Evitați datele personale în întrebări și fotografii. Documentele scanate sunt șterse după procesare; tichetele demo pot fi șterse din pagina lor. Într-o configurație cu AI extern, întrebarea și sursele sunt trimise furnizorului.", ru: "Мы не запрашиваем имя, телефон или IDNP. Не указывайте личные данные в вопросах и фото. Сканируемые документы удаляются после обработки; демо-заявки можно удалить на их странице. При подключённом внешнем ИИ вопрос и источники передаются провайдеру." } },
];

export function ChatClient(props: { initialQuestion?: string }) {
  const history = useConversations();
  return <ChatSession key={history.revision} {...props} />;
}

function ChatSession({ initialQuestion = "" }: { initialQuestion?: string }) {
  const { lang, t } = useLang();
  const [draft, setDraft] = useState("");
  const history = useConversations();
  const { save } = history;
  const [turns, setTurns] = useState<Turn[]>(() => history.active?.turns ?? []);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<Sheet>("faq");
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);
  const [validation, setValidation] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [fileErr, setFileErr] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const filePicker = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(Math.max(0, ...turns.map((turn) => turn.id)));
  const initialSent = useRef(false);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const historyRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const docRef = useRef<DocContext | null>(null);

  const ask = useCallback(async (question: string, retryId?: number) => {
    if (pending.current) return;
    const text = question.trim();
    if (!text) { setValidation(true); input.current?.focus(); return; }
    pending.current = true;
    setBusy(true);
    setValidation(false);
    setDraft("");
    const id = retryId ?? ++sequence.current;
    const fresh: AskTurn = { kind: "ask", id, question: text };
    setTurns((prev) => retryId === undefined ? [...prev, fresh] : prev.map((turn) => turn.id === id ? fresh : turn));
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 100000);
    const patch = (fields: Partial<AskTurn>) => setTurns((prev) => prev.map((turn) => (turn.id === id && turn.kind === "ask" ? { ...turn, ...fields } : turn)));
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify({ question: text, lang, history: historyRef.current, document: docRef.current ? { name: docRef.current.name, text: docRef.current.text } : undefined }),
        signal: abort.signal,
      });
      if (!response.ok || !response.body) throw new Error("request_failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamed = "";
      let settled = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          let event: ServerEvent;
          try {
            event = JSON.parse(line.slice(5).trim()) as ServerEvent;
          } catch {
            continue;
          }
          if (event.type === "phase") patch({ phase: event.label });
          else if (event.type === "chunk") {
            streamed += event.text;
            patch({ text: streamed, phase: undefined });
          } else if (event.type === "answer") {
            settled = true;
            patch({ answer: event.answer, phase: undefined, text: undefined });
          } else if (event.type === "error") {
            settled = true;
            patch({ failed: event.message, phase: undefined, text: undefined });
          }
        }
      }
      if (!settled) throw new Error("incomplete");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") patch({ failed: true, phase: undefined, text: undefined });
    } finally {
      clearTimeout(timeout);
      pending.current = false;
      setBusy(false);
    }
  }, [lang]);

  /** Whatever is already typed becomes the review goal, so "verifică dacă e corect" + attach reads as one act. */
  const attach = useCallback((file: File | null | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) { setFileErr(true); return; }
    const goal = draft.trim().slice(0, 300);
    setDraft("");
    setValidation(false);
    setFileErr(false);
    setTurns((prev) => [...prev, { kind: "doc", id: ++sequence.current, file, goal }]);
  }, [draft]);

  useEffect(() => {
    if (initialQuestion && !history.active && !initialSent.current) {
      initialSent.current = true;
      void ask(initialQuestion);
    }
  }, [initialQuestion, ask, history.active]);

  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    if (busy || !turns.length) return;
    const saved: SavedTurn[] = turns.flatMap((turn): SavedTurn[] => turn.kind === "ask"
      ? [{ kind: "ask", id: turn.id, question: turn.question, answer: turn.answer, failed: turn.failed || (!turn.answer ? true : undefined) }]
      : turn.ctx ? [{ kind: "doc", id: turn.id, name: turn.file?.name ?? turn.name ?? "Document", goal: turn.goal, ctx: turn.ctx }] : []);
    save(saved);
  }, [turns, busy, save]);

  useEffect(() => {
    const active = scroll.current?.querySelector<HTMLElement>("[data-latest]");
    active?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [turns]);

  // Completed turns become the context sent with the next question. Only the redacted
  // document text is carried forward — the original never left the browser to begin with.
  useEffect(() => {
    historyRef.current = turns.flatMap((turn) => {
      if (turn.kind === "doc") {
        if (!turn.ctx) return [];
        return [
          { role: "user" as const, content: `[${turn.ctx.docType}: ${turn.ctx.name}]${turn.goal ? ` ${turn.goal}` : ""}` },
          { role: "assistant" as const, content: turn.ctx.summary },
        ];
      }
      if (!turn.answer) return [];
      return [
        { role: "user" as const, content: turn.question },
        { role: "assistant" as const, content: turn.answer.prose ?? turn.answer.summary[lang] },
      ];
    });
    docRef.current = turns.flatMap((turn) => (turn.kind === "doc" && turn.ctx ? [turn.ctx] : [])).at(-1) ?? null;
  }, [turns, lang]);

  const openSheet = (value: Sheet, trigger: HTMLElement) => {
    lastTrigger.current = trigger;
    setSheet(value);
    setVoiceDialogOpen(value === "call");
    dialog.current?.showModal();
  };

  return (
    <div
      className={`chat-layout ${turns.length ? "has-conversation" : ""} ${dropping ? "dropping" : ""}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDropping(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDropping(false); }}
      onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); setDropping(false); attach(e.dataTransfer.files[0]); } }}
    >
      {dropping && <p className="drop-hint" aria-hidden="true">{t({ ro: "Lasă documentul aici", ru: "Отпустите документ здесь" })}</p>}
      <div className="chat-scroll" ref={scroll} role="region" aria-label={t({ ro: "Conversație", ru: "Диалог" })} tabIndex={0}>
        {!turns.length ? (
          <section className="chat-welcome" aria-labelledby="welcome-title">
            <div className="welcome-art" aria-hidden="true"><span className="art-orbit" /><span className="art-chat"><Icon name="chat" /></span><span className="art-spark">✦</span></div>
            <h1 id="welcome-title">{t({ ro: "Hai să vorbim", ru: "Поговорим" })}<br />{t({ ro: "despre Chișinău.", ru: "о Кишинэу." })}</h1>
          </section>
        ) : (
          <div className="conversation">
            <h1 className="sr-only">{t({ ro: "Conversația ta", ru: "Ваш диалог" })}</h1>
            {turns.map((turn, index) => turn.kind === "doc" ? (
              <section key={turn.id} className="chat-turn" data-latest={index === turns.length - 1 ? "true" : undefined} aria-label={(turn.file?.name ?? turn.name)}>
                <div className="user-message user-file"><Icon name="document" /><span>{(turn.file?.name ?? turn.name)}</span></div>
                {turn.goal && <div className="user-message">{turn.goal}</div>}
                <div className="assistant-label"><span className="assistant-dot" />pe fir</div>
                {turn.file ? <DocumentTurn file={turn.file} goal={turn.goal} onReady={(ctx) => setTurns((prev) => prev.map((x) => (x.id === turn.id && x.kind === "doc" ? { ...x, ctx } : x)))} /> : <div className="chat-answer"><p>{turn.ctx?.summary}</p></div>}
              </section>
            ) : (
              <section key={turn.id} className="chat-turn" data-latest={index === turns.length - 1 ? "true" : undefined} aria-label={turn.question}>
                <div className="user-message">{turn.question}</div>
                <div className="assistant-label"><span className="assistant-dot" />pe fir</div>
                {turn.answer ? <div className="chat-answer"><AnswerView answer={turn.answer} headingRef={heading} onFollowUp={(q) => { if (!pending.current) void ask(q); }} compact /></div> : turn.failed ? (
                  <div className="chat-error" role="alert"><p>{typeof turn.failed === "string" ? turn.failed : t({ ro: "Nu am reușit să obținem răspunsul. Întrebarea ta este păstrată aici.", ru: "Не удалось получить ответ. Ваш вопрос сохранён здесь." })}</p><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void ask(turn.question, turn.id)}>{t({ ro: "Încearcă din nou", ru: "Повторить" })}</button></div>
                ) : turn.text ? (
                  <div className="chat-answer"><p className="prose-stream">{turn.text}<span className="stream-caret" aria-hidden="true" /></p></div>
                ) : <p className="searching"><span className="loading-dots" aria-hidden="true">•••</span>{turn.phase ?? t({ ro: "Caut în sursele disponibile…", ru: "Ищу в доступных источниках…" })}</p>}
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="chat-dock">
        <div className="call-prompt"><span>{t({ ro: "Vorbești mai ușor decât scrii?", ru: "Вам удобнее говорить?" })}</span><button type="button" className="call-button" onClick={(e) => openSheet("call", e.currentTarget)}><Icon name="phone" />{t({ ro: "Sună", ru: "Позвонить" })}</button></div>
        <div className="faq-bar">
          <button type="button" className="faq-heading" onClick={(e) => openSheet("faq", e.currentTarget)}><Icon name="help" />{t({ ro: "Întrebări frecvente", ru: "Частые вопросы" })}<Icon name="chevron" /></button>
          <div className="question-shortcuts">
            {EXAMPLES.slice(0, 3).map((example, i) => <button type="button" key={example.id} disabled={busy} onClick={() => void ask(example.q[lang])}>{t([{ ro: "Acte pentru apă", ru: "Договор на воду" }, { ro: "O petiție", ru: "Подать петицию" }, { ro: "Tariful la apă", ru: "Тариф на воду" }][i])}<span aria-hidden="true">↗</span></button>)}
          </div>
        </div>
        <form className="chat-composer" onSubmit={(e) => { e.preventDefault(); void ask(draft); }}>
          <button type="button" className="composer-tools" aria-label={t({ ro: "Adaugă un document sau pregătește o sesizare", ru: "Добавить документ или подготовить обращение" })} onClick={(e) => openSheet("tools", e.currentTarget)}><Icon name="plus" /></button>
          <input ref={filePicker} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} onChange={(e) => { attach(e.target.files?.[0]); e.target.value = ""; }} />
          <label htmlFor="chat-message" className="sr-only">{t({ ro: "Mesajul tău", ru: "Ваше сообщение" })}</label>
          <textarea ref={input} id="chat-message" rows={1} maxLength={500} value={draft} onChange={(e) => { setDraft(e.target.value); setValidation(false); }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void ask(draft); } }} placeholder={t({ ro: "Scrie întrebarea ta…", ru: "Напишите ваш вопрос…" })} aria-invalid={validation || undefined} aria-describedby={validation ? "chat-validation" : "chat-hint"} />
          <button className="send-button" type="submit" disabled={busy || !draft.trim()} aria-label={t({ ro: "Trimite întrebarea", ru: "Отправить вопрос" })}>{busy ? <span className="send-spinner" /> : <Icon name="arrow" />}</button>
        </form>
        {validation && <p id="chat-validation" className="composer-error" role="alert">{t({ ro: "Scrie o întrebare pentru a începe.", ru: "Напишите вопрос, чтобы начать." })}</p>}
        {fileErr && <p className="composer-error" role="alert">{t({ ro: "Fișierul depășește 10 MB. Încearcă o fotografie mai mică.", ru: "Файл больше 10 МБ. Попробуйте фото меньшего размера." })}</p>}
        <p className="sr-only" role="status">{busy ? t({ ro: "Se caută răspunsul.", ru: "Идёт поиск ответа." }) : settled(turns.at(-1)) ? t({ ro: "Răspunsul este gata.", ru: "Ответ готов." }) : ""}</p>
      </div>

      <dialog ref={dialog} className="utility-sheet" aria-labelledby="sheet-title" onClose={() => { lastTrigger.current?.focus(); setVoiceDialogOpen(false); }} onClick={(e) => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
        <div className="sheet-inner">
          <div className="sheet-handle" aria-hidden="true" />
          <header className="sheet-header"><h2 id="sheet-title">{sheet === "faq" ? t({ ro: "Bine de știut", ru: "Полезно знать" }) : sheet === "call" ? t({ ro: "Asistent vocal", ru: "Голосовой помощник" }) : t({ ro: "Cu ce începem?", ru: "С чего начнём?" })}</h2><button type="button" className="sheet-close" aria-label={t({ ro: "Închide", ru: "Закрыть" })} onClick={() => dialog.current?.close()}><Icon name="close" /></button></header>
          {sheet === "faq" && <div className="faq-list">{FAQ.map((item) => <details key={item.q.ro}><summary>{t(item.q)}<Icon name="plus" /></summary><p>{t(item.a)}</p></details>)}<Link href="/surse" className="sheet-text-link">{t({ ro: "Explorează sursele", ru: "Посмотреть источники" })} ↗</Link></div>}
          {sheet === "call" && <VoiceCall lang={lang} open={voiceDialogOpen} />}
          {sheet === "tools" && <div className="tool-list"><button type="button" onClick={() => { dialog.current?.close(); filePicker.current?.click(); }}><span className="tool-icon"><Icon name="document" /></span><span><strong>{t({ ro: "Un document, mai clar", ru: "Разобраться с документом" })}</strong><small>{t({ ro: "Fotografie sau PDF · se citește aici, în conversație", ru: "Фото или PDF · читается здесь, в диалоге" })}</small></span><Icon name="chevron" /></button><Link href="/raporteaza"><span className="tool-icon"><Icon name="pin" /></span><span><strong>{t({ ro: "Dă de veste", ru: "Сообщить о проблеме" })}</strong><small>{t({ ro: "O fotografie, un titlu, un pas înainte · demo", ru: "Фото, заголовок — и шаг вперёд · демо" })}</small></span><Icon name="chevron" /></Link><button type="button" onClick={() => { setSheet("call"); setVoiceDialogOpen(true); }}><span className="tool-icon"><Icon name="phone" /></span><span><strong>{t({ ro: "Vorbește cu cineva", ru: "Поговорить с человеком" })}</strong><small>{t({ ro: "Asistent vocal și contact uman", ru: "Голосовой помощник и контакт" })}</small></span><Icon name="chevron" /></button><Link href="/surse"><span className="tool-icon"><Icon name="source" /></span><span><strong>{t({ ro: "Vezi sursele", ru: "Посмотреть источники" })}</strong><small>{t({ ro: "Documentele din spatele răspunsurilor", ru: "Документы, на которых основаны ответы" })}</small></span><Icon name="chevron" /></Link></div>}
        </div>
      </dialog>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "../LangProvider";
import { CATEGORIES, SERVICES, type CategoryId, type ServiceId, type Ticket } from "@/lib/tickets/types";
import { ReportCamera } from "./ReportCamera";
import { ReportMedia } from "./ReportMedia";
import { ReportVoice } from "./ReportVoice";
import { mediaMime, normalizeMobileMedia } from "@/lib/tickets/media";

const DRAFT_KEY = "pefir_report_v2";
interface Draft { title: string; service: ServiceId | ""; category: CategoryId; location: string; message: string; transcript: string; links: string; lat?: number; lng?: number; }
const EMPTY: Draft = { title: "", service: "", category: "other", location: "", message: "", transcript: "", links: "" };
type Summary = Pick<Ticket, "id" | "title" | "city" | "status" | "location" | "description" | "createdAt">;
const ACCEPT = "image/*,.heic,.heif,video/mp4,video/quicktime,video/webm";
const ACCEPT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm", "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-m4a"]);
const REPORT_SERVICES = SERVICES.filter(item => item.id !== "hospital");

export function ReportClient({ initialTickets = [] }: { initialTickets?: Summary[] }) {
  const { lang, t } = useLang();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [files, setFiles] = useState<File[]>([]);
  const [audio, setAudio] = useState<File | null>(null);
  const [sendAudio, setSendAudio] = useState(true);
  const [mode, setMode] = useState<"text" | "voice" | "media" | "link" | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submittedId, setSubmittedId] = useState("");
  const [geo, setGeo] = useState("");
  const [restored, setRestored] = useState(false);
  const loaded = useRef(false);
  const submitting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const addPicker = useRef<HTMLInputElement>(null);
  const replacePicker = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<number | null>(null);
  const [processingMedia, setProcessingMedia] = useState(false);
  const patch = (value: Partial<Draft>) => setDraft(previous => ({ ...previous, ...value }));
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (saved && typeof saved.title === "string" && (saved.title || saved.message || saved.transcript || saved.links || saved.location)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDraft({ ...EMPTY, ...saved }); setRestored(true);
      }
    } catch { /* Private browsing may disable draft storage. */ }
    loaded.current = true;
  }, []);
  useEffect(() => { if (loaded.current) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {} } }, [draft]);
  useEffect(() => { if (step > 0) heading.current?.focus(); }, [step]);
  async function addFiles(incoming: File[], replaceIndex: number | null = null) {
    if (!incoming.length) return false;
    if (incoming.some(file => file.size > 25 * 1024 * 1024)) { setError(t({ ro: "Fiecare fișier trebuie să aibă maximum 25 MB.", ru: "Каждый файл должен быть не больше 25 МБ." })); return false; }
    setProcessingMedia(true);
    let normalized: File[];
    try {
      normalized = await Promise.all(incoming.map(normalizeMobileMedia));
    } catch (failure) {
      setProcessingMedia(false);
      const heif = failure instanceof Error && failure.message === "heif_unsupported";
      setError(t({ ro: heif ? "Browserul nu poate converti această fotografie HEIC. Pe iPhone, în Poze: Partajare → Opțiuni → Cel mai compatibil, apoi salvează/exportă JPEG. Pe Android, exportă fotografia ca JPEG din editorul telefonului. Fotografia nu a fost încărcată.": "Tipul fișierului nu este acceptat. Alege JPG, PNG, WEBP, MP4, MOV sau WEBM.", ru: heif ? "Браузер не может преобразовать это фото HEIC. На iPhone в приложении Фото: Поделиться → Параметры → Наиболее совместимый, затем сохраните/экспортируйте JPEG. На Android экспортируйте фото как JPEG из редактора телефона. Фото не загружено." : "Тип файла не поддерживается. Выберите JPG, PNG, WEBP, MP4, MOV или WEBM." }));
      return false;
    }
    if (normalized.some(file => !ACCEPT_TYPES.has(mediaMime(file)))) { setProcessingMedia(false); setError(t({ ro: "Tipul fișierului nu este acceptat. Alege JPG, PNG, WEBP, MP4, MOV sau WEBM.", ru: "Тип файла не поддерживается. Выберите JPG, PNG, WEBP, MP4, MOV или WEBM." })); return false; }
    if (normalized.some(file => file.size > 25 * 1024 * 1024)) { setProcessingMedia(false); setError(t({ ro: "Fotografia convertită depășește limita de 25 MB. Alege o imagine mai mică.", ru: "Преобразованное фото больше 25 МБ. Выберите изображение поменьше." })); return false; }
    if (files.length - (replaceIndex == null ? 0 : 1) + normalized.length > 3) { setProcessingMedia(false); setError(t({ ro: "Poți atașa maximum 3 fotografii sau videoclipuri.", ru: "Можно прикрепить до 3 фото или видео." })); return false; }
    setFiles(previous => {
      if (replaceIndex == null) return [...previous, ...normalized];
      const next = [...previous]; next[replaceIndex] = normalized[0]; return next;
    });
    setProcessingMedia(false); setError(""); return true;
  }
  const service = SERVICES.find(item => item.id === draft.service);
  function review() {
    setError("");
    if (draft.title.trim().length < 3) { setError(t({ ro: "Dă-i problemei un titlu de cel puțin 3 caractere.", ru: "Добавьте название — хотя бы 3 символа." })); document.getElementById("report-title")?.focus(); return; }
    if ((draft.message.trim() || draft.transcript.trim()).length < 10) { setError(t({ ro: "Descrie problema sau înregistrează un mesaj vocal de cel puțin 10 caractere.", ru: "Опишите проблему или запишите голосовое сообщение минимум в 10 символах." })); setMode("text"); window.setTimeout(() => document.getElementById("report-message")?.focus(), 0); return; }
    if (!service) { setError(t({ ro: "Alege serviciul care ar putea ajuta.", ru: "Выберите службу, которая может помочь." })); document.getElementById("service-legend")?.focus(); return; }
    const links = draft.links.split("\n").map(s => s.trim()).filter(Boolean);
    if (links.length > 5 || links.some(link => { try { return link.length > 1000 || !["http:", "https:"].includes(new URL(link).protocol); } catch { return true; } })) { setError(t({ ro: "Adaugă până la 5 linkuri complete (https://…), câte unul pe rând.", ru: "Добавьте до 5 полных ссылок (https://…), по одной на строку." })); setMode("link"); return; }
    setStep(2);
  }
  function locate() {
    setGeo(t({ ro: "Căutăm locația…", ru: "Определяем местоположение…" }));
    if (!navigator.geolocation) { setGeo(t({ ro: "Poți scrie adresa manual.", ru: "Можно ввести адрес вручную." })); return; }
    navigator.geolocation.getCurrentPosition(position => {
      const lat = Number(position.coords.latitude.toFixed(5)), lng = Number(position.coords.longitude.toFixed(5));
      setDraft(previous => ({ ...previous, lat, lng, location: previous.location || `${lat}, ${lng}` }));
      setGeo(t({ ro: "Locație adăugată. Verifică dacă este locul problemei.", ru: "Местоположение добавлено. Проверьте, совпадает ли оно с местом проблемы." }));
    }, () => setGeo(t({ ro: "Locația nu este disponibilă. Poți scrie adresa manual.", ru: "Геолокация недоступна. Можно ввести адрес вручную." })), { timeout: 10000 });
  }
  async function submit() {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError("");
    const fd = new FormData();
    for (const [key, value] of Object.entries({ title: draft.title, description: draft.message, transcript: draft.transcript, service: draft.service, category: draft.category, location: draft.location, links: draft.links, lang, confirm: "yes", locationSource: draft.lat != null ? "device" : "manual" })) fd.append(key, value);
    if (draft.lat != null && draft.lng != null) { fd.append("lat", String(draft.lat)); fd.append("lng", String(draft.lng)); }
    files.forEach(file => fd.append("media", file));
    if (audio && sendAudio) fd.append("media", audio);
    try {
      const response = await fetch("/api/tickets", { method: "POST", body: fd });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.reason || result.fields?.media || result.fields?.description || result.error || "network");
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setSubmittedId(result.id); setStep(3);
    } catch (failure) {
      submitting.current = false; setBusy(false);
      const issue = failure instanceof Error ? failure.message : "network";
      setError(t({ ro: issue === "unsupported_type" ? "Fotografia are un format pe care serverul nu îl poate procesa. Alege JPG, PNG sau WEBP." : issue === "too_large" ? "Fișierul depășește limita de 25 MB. Alege unul mai mic și încearcă din nou." : issue === "too_many_files" ? "Poți atașa maximum 3 fotografii sau videoclipuri." : issue === "media_save_failed" || issue === "save_failed" ? "Serverul nu a putut păstra fotografia sau sesizarea. Datele sunt încă aici — încearcă din nou." : "Nu am putut salva sesizarea. Datele și atașamentele sunt încă aici — încearcă din nou.", ru: "Не удалось сохранить обращение. Данные и вложения остались здесь — попробуйте снова." }));
    }
  }
  return <div className="report-flow">
    <header className="report-intro"><h1>{t({ ro: "Ai observat ceva?", ru: "Заметили проблему?" })}<br /><span>{t({ ro: "Dă-ne de veste.", ru: "Дайте нам знать." })}</span></h1></header>
    <section className="report-surface" aria-labelledby="report-step-title">
      <div className="report-section-head"><div><h2 id="report-step-title" tabIndex={-1} ref={heading}>{step === 0 ? t({ ro: "Totul începe cu o imagine", ru: "Начнём с фотографии" }) : step === 1 ? t({ ro: "Ce putem îmbunătăți?", ru: "Что можно улучшить?" }) : t({ ro: "Arată bine? Trimite mai departe.", ru: "Всё верно? Можно отправлять." })}</h2></div></div>
      {error && <p className="report-error" role="alert">{error}</p>}
      {step === 3 && <div className="report-details" role="status"><div className="report-review"><span className="review-check" aria-hidden="true">✓</span><p className="report-eyebrow">{t({ ro: "SESIZARE ÎNREGISTRATĂ", ru: "ОБРАЩЕНИЕ ЗАРЕГИСТРИРОВАНО" })}</p><h2>{t({ ro: "Mulțumim că ne-ai spus.", ru: "Спасибо, что сообщили." })}</h2><p>{t({ ro: "Numărul sesizării", ru: "Номер обращения" })}: <strong>{submittedId}</strong></p><p>{t({ ro: "Sesizarea și fotografia sunt păstrate pe server și pot fi consultate de personalul autorizat. Serviciile municipale nu sunt conectate la acest prototip.", ru: "Обращение и фотография сохранены на сервере и доступны уполномоченному персоналу. Муниципальные службы пока не подключены к этому прототипу." })}</p></div><Link href="/" className="report-primary">{t({ ro: "Înapoi la început", ru: "На главную" })} ↗</Link></div>}
      {step === 0 && <ReportCamera onPhoto={async file => { const ok = await addFiles([file]); if (ok) setStep(1); }} />}
      {step === 1 && <div className="report-details">
        {restored && <div className="report-note">{t({ ro: "Am păstrat textul ciornei tale. Atașamentele trebuie adăugate din nou.", ru: "Текст черновика сохранён. Вложения нужно добавить заново." })}<button type="button" className="report-text-button" onClick={() => { setDraft(EMPTY); setFiles([]); setAudio(null); setRestored(false); }}>{t({ ro: "Începe de la zero", ru: "Начать заново" })}</button></div>}
        <input ref={addPicker} type="file" multiple accept={ACCEPT} className="sr-only" aria-label={t({ ro: "Alege fotografii sau videoclipuri", ru: "Выберите фото или видео" })} onChange={e => { void addFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
        <input ref={replacePicker} type="file" accept="image/*,.heic,.heif" className="sr-only" aria-label={t({ ro: "Înlocuiește fotografia selectată", ru: "Заменить выбранное фото" })} onChange={e => { const file = e.target.files?.[0]; if (file) void addFiles([file], replaceTarget.current); e.target.value = ""; }} />
        {processingMedia && <p className="report-muted" role="status">{t({ ro: "Se pregătește fișierul pe dispozitiv…", ru: "Подготавливаем файл на устройстве…" })}</p>}
        {files.length > 0 && <div className="report-attachments">{files.map((file, index) => <div className="report-attachment" key={`${file.name}-${index}`}><ReportMedia file={file} /><button type="button" disabled={processingMedia} onClick={() => setFiles(previous => previous.filter((_, i) => i !== index))} aria-label={`${t({ ro: "Elimină", ru: "Удалить" })} ${file.name}`}>×</button>{file.type.startsWith("image/") && <button type="button" className="report-attachment-replace" disabled={processingMedia} onClick={() => { replaceTarget.current = index; replacePicker.current?.click(); }}>{t({ ro: "Înlocuiește", ru: "Заменить" })}</button>}</div>)}</div>}
        <div><label className="report-label" htmlFor="report-title">{t({ ro: "Un titlu scurt este suficient", ru: "Достаточно короткого названия" })} <span>*</span></label><input id="report-title" className="report-input report-title-input" value={draft.title} maxLength={100} onChange={e => patch({ title: e.target.value })} placeholder={t({ ro: "De exemplu: Un felinar nu se aprinde", ru: "Например: Не горит фонарь" })} /><p className="report-muted">{t({ ro: "Fără formulare complicate. Spune-ne doar ce ai observat.", ru: "Без сложных форм. Просто расскажите, что заметили." })}</p></div>
        <fieldset><legend className="report-label" id="service-legend" tabIndex={-1}>{t({ ro: "Cine te poate ajuta?", ru: "Кто может помочь?" })} <span>*</span></legend><div className="service-grid">{REPORT_SERVICES.map(item => <label key={item.id} className={`service-option ${draft.service === item.id ? "selected" : ""}`}><input type="radio" name="service" value={item.id} checked={draft.service === item.id} onChange={() => patch({ service: item.id })} /><span className="service-symbol" aria-hidden="true">{item.symbol}</span><span><strong>{item.label[lang]}</strong><small>{item.hint[lang]}</small></span><span className="service-check" aria-hidden="true">{draft.service === item.id ? "✓" : ""}</span></label>)}</div></fieldset>
        <div className="report-location-row"><div><label className="report-label" htmlFor="report-category">{t({ ro: "Tipul problemei", ru: "Тип проблемы" })}</label><select id="report-category" className="report-input" value={draft.category} onChange={e => patch({ category: e.target.value as CategoryId })}>{CATEGORIES.map(item => <option key={item.id} value={item.id}>{item.label[lang]}</option>)}</select></div><div><label className="report-label" htmlFor="report-location">{t({ ro: "Unde ai observat-o?", ru: "Где вы её заметили?" })} <small>{t({ ro: "opțional", ru: "необязательно" })}</small></label><input id="report-location" className="report-input" maxLength={300} value={draft.location} onChange={e => patch({ location: e.target.value, lat: undefined, lng: undefined })} placeholder={t({ ro: "Strada sau un reper", ru: "Улица или ориентир" })} /><button type="button" className="report-text-button" onClick={locate}>⌖ {t({ ro: "Folosește locația mea", ru: "Моё местоположение" })}</button></div></div>
        {geo && <p role="status" className="report-muted">{geo}</p>}
        <div className="report-extras"><div className="report-extras-heading"><h3>{t({ ro: "Mai ai ceva de adăugat?", ru: "Хотите что-то добавить?" })}</h3><span>{t({ ro: "Doar dacă vrei", ru: "По желанию" })}</span></div><div className="report-modes">{([
          ["text", "✎", t({ ro: "Mesaj", ru: "Текст" })], ["voice", "◉", t({ ro: "Vocal", ru: "Голос" })], ["media", "▧", t({ ro: "Foto / video", ru: "Фото / видео" })], ["link", "↗", t({ ro: "Link", ru: "Ссылка" })],
        ] as const).map(([key, symbol, label]) => <button key={key} type="button" disabled={voiceBusy} aria-pressed={mode === key} onClick={() => setMode(mode === key ? null : key)}><span aria-hidden="true">{symbol}</span>{label}</button>)}</div>
        {mode === "text" && <div className="report-extra-panel"><label className="report-label" htmlFor="report-message">{t({ ro: "Descrie problema", ru: "Опишите проблему" })} <span>*</span></label><textarea id="report-message" className="report-input" rows={3} maxLength={1000} value={draft.message} onChange={e => patch({ message: e.target.value })} placeholder={t({ ro: "Ce s-a întâmplat și unde?", ru: "Что произошло и где?" })} /></div>}
        {mode === "voice" && <ReportVoice audio={audio} onAudio={setAudio} transcript={draft.transcript} onTranscript={text => patch({ transcript: text })} onBusy={setVoiceBusy} />}
        {mode === "media" && <div className="report-upload"><span aria-hidden="true">▧</span><strong>{t({ ro: "Adaugă fotografii sau videoclipuri", ru: "Добавить фото или видео" })}</strong><span>{t({ ro: "Până la 3 fișiere · maximum 25 MB fiecare", ru: "До 3 файлов · максимум 25 МБ каждый" })}</span><button type="button" className="report-secondary" disabled={processingMedia} onClick={() => addPicker.current?.click()}>{processingMedia ? t({ ro: "Se pregătește fotografia…", ru: "Подготавливаем фото…" }) : t({ ro: "Alege fișiere", ru: "Выбрать файлы" })}</button><p className="report-muted">{t({ ro: "HEIC este convertit local în JPEG dacă browserul îl poate decoda; fișierul nu este trimis altui serviciu.", ru: "HEIC преобразуется в JPEG на устройстве, если браузер поддерживает этот формат; файл не отправляется сторонним сервисам." })}</p></div>}
        {mode === "link" && <div className="report-extra-panel"><label className="report-label" htmlFor="report-links">{t({ ro: "Linkuri către fotografii sau videoclipuri", ru: "Ссылки на фото или видео" })}</label><textarea id="report-links" className="report-input" rows={2} maxLength={10000} value={draft.links} onChange={e => patch({ links: e.target.value })} placeholder="https://…" /><p className="report-muted">{t({ ro: "Câte un link pe rând. Asigură-te că poate fi deschis de destinatar.", ru: "По одной ссылке на строку. Убедитесь, что получатель сможет её открыть." })}</p></div>}
        </div>
        <div className="report-actions"><button type="button" className="report-text-button" disabled={voiceBusy} onClick={() => { setStep(0); setError(""); }}>← {t({ ro: "Înapoi la cameră", ru: "Назад к камере" })}</button><button type="button" className="report-primary" disabled={voiceBusy} onClick={review}>{t({ ro: "Mai departe", ru: "Далее" })} <span>→</span></button></div>
      </div>}
      {step === 2 && <div className="report-details"><div className="report-review"><span className="review-check" aria-hidden="true">✓</span><p className="report-eyebrow">{t({ ro: "SESIZAREA TA", ru: "ВАШЕ ОБРАЩЕНИЕ" })}</p><h3>{draft.title}</h3><p>{service?.label[lang]} · {CATEGORIES.find(item => item.id === draft.category)?.label[lang]}</p>{draft.location && <p>⌖ {draft.location}</p>}</div>
        {files.length > 0 && <div className="report-attachments">{files.map((file, i) => <div className="report-attachment" key={i}><ReportMedia file={file} /></div>)}</div>}
        {draft.message && <p className="report-message">{draft.message}</p>}
        {draft.transcript && <div><p className="report-label">{t({ ro: "Mesaj vocal transcris", ru: "Расшифровка сообщения" })}</p><p className="report-message">{draft.transcript}</p></div>}
        {audio && <div className="voice-preview"><ReportMedia file={audio} /><label className="report-audio-choice"><input type="checkbox" checked={sendAudio} onChange={e => setSendAudio(e.target.checked)} />{t({ ro: "Atașează și înregistrarea vocală", ru: "Прикрепить и голосовую запись" })}</label></div>}
        {draft.links.trim() && <div className="report-links">{draft.links.split("\n").filter(s => s.trim()).map((link, i) => <a key={i} href={link.trim()} target="_blank" rel="noopener noreferrer">↗ {link}</a>)}</div>}
        <div className="report-note"><strong>{t({ ro: "Sesizarea va fi înregistrată pe server.", ru: "Обращение будет сохранено на сервере." })}</strong><p>{t({ ro: "Va putea fi consultată de personalul autorizat în back office. Serviciile municipale nu sunt conectate.", ru: "Уполномоченный персонал сможет просмотреть его в бэк-офисе. Муниципальные службы не подключены." })}</p></div>
        <div className="report-actions"><button type="button" className="report-text-button" disabled={busy} onClick={() => { setStep(1); setError(""); }}>← {t({ ro: "Mai schimb ceva", ru: "Изменить детали" })}</button><button type="button" className="report-primary" disabled={busy} onClick={() => void submit()}>{busy ? t({ ro: "Se trimite…", ru: "Отправляем…" }) : t({ ro: "Trimite sesizarea", ru: "Отправить обращение" })}<span>↗</span></button></div>
      </div>}
    </section>
    {initialTickets.length > 0 && <details className="report-history"><summary>{t({ ro: "Sesizări recente", ru: "Последние обращения" })} <span>{initialTickets.length}</span></summary>{initialTickets.slice(0, 8).map(ticket => <Link href={`/tichet/${ticket.id}`} key={ticket.id}><span>{ticket.title || ticket.description || ticket.id}</span><span>↗</span></Link>)}</details>}
  </div>;
}

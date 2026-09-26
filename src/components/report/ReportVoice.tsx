"use client";
import { useEffect, useRef, useState } from "react";
import { useLang } from "../LangProvider";
import { ReportMedia } from "./ReportMedia";

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { results: { length: number; [index: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null; start: () => void; stop: () => void; abort: () => void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

export function ReportVoice({ audio, onAudio, transcript, onTranscript, onBusy }: {
  audio: File | null; onAudio: (file: File | null) => void; transcript: string; onTranscript: (text: string) => void; onBusy: (busy: boolean) => void;
}) {
  const { lang, t } = useLang();
  const [recording, setRecording] = useState(false);
  const [working, setWorking] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(true);
  const spoken = useRef("");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      recognition.current?.abort();
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach(track => track.stop());
      if (timer.current) clearInterval(timer.current);
      abort.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);
  async function transcribe(file: File) {
    setWorking(true); onBusy(true); setError("");
    const controller = new AbortController(); abort.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("lang", lang);
      const r = await fetch("/api/report/audio", { method: "POST", body: fd, signal: controller.signal });
      const result = await r.json();
      if (!r.ok || !result.transcript) throw new Error("unavailable");
      if (mounted.current) onTranscript(result.transcript);
    } catch {
      if (mounted.current) setError(t({ ro: "Transcrierea nu este disponibilă aici. Înregistrarea este păstrată; poți adăuga sau corecta textul mai jos.", ru: "Расшифровка здесь недоступна. Запись сохранена; можно добавить или исправить текст ниже." }));
    } finally { clearTimeout(timeout); if (mounted.current) { setWorking(false); onBusy(false); } }
  }
  async function start() {
    setError(""); onBusy(true); setWorking(true); spoken.current = "";
    let media: MediaStream | null = null;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const mr = new MediaRecorder(media); recorder.current = mr;
      const chunks: Blob[] = [];
      mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      mr.onstop = () => {
        recognition.current?.stop();
        media?.getTracks().forEach(track => track.stop());
        if (timer.current) clearInterval(timer.current);
        if (!mounted.current) return;
        const mime = (mr.mimeType || "audio/webm").split(";")[0];
        const file = new File(chunks, `voce.${mime.split("/")[1]}`, { type: mime });
        onAudio(file); setRecording(false); onBusy(false);
        if (!spoken.current.trim()) void transcribe(file);
      };
      const Speech = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
      if (Speech) {
        const sr = new Speech(); recognition.current = sr;
        sr.lang = lang === "ru" ? "ru-RU" : "ro-RO"; sr.continuous = true; sr.interimResults = true;
        sr.onresult = event => {
          const parts: string[] = [];
          for (let i = 0; i < event.results.length; i++) parts.push(event.results[i][0].transcript);
          spoken.current = parts.join(" ").slice(0, 1000);
          if (mounted.current) onTranscript(spoken.current);
        };
        sr.onerror = () => { /* Local transcription is attempted if browser recognition returns no text. */ };
        try { sr.start(); } catch { recognition.current = null; }
      }
      mr.start(); onTranscript(""); setSeconds(0); setRecording(true); setWorking(false);
      let elapsed = 0;
      timer.current = setInterval(() => { elapsed++; setSeconds(elapsed); if (elapsed >= 120 && mr.state === "recording") mr.stop(); }, 1000);
    } catch {
      media?.getTracks().forEach(track => track.stop());
      recognition.current?.abort();
      setWorking(false); onBusy(false);
      setError(t({ ro: "Microfonul nu este disponibil. Permite accesul, încarcă audio sau scrie un mesaj.", ru: "Микрофон недоступен. Разрешите доступ, загрузите аудио или напишите сообщение." }));
    }
  }
  return <div className="voice-panel">
    <p className="report-muted">{t({ ro: "Vorbește, iar cuvintele tale apar mai jos. Poți corecta textul înainte de trimitere. Recunoașterea vocală poate folosi serviciul browserului.", ru: "Говорите — слова появятся ниже. Перед отправкой текст можно исправить. Распознавание может использовать сервис браузера." })}</p>
    <div className="report-inline">
      <button type="button" className={`report-secondary ${recording ? "is-recording" : ""}`} disabled={working} onClick={() => recording ? recorder.current?.stop() : void start()}>{recording ? `■ ${t({ ro: "Oprește", ru: "Остановить" })} · ${seconds}s` : t({ ro: "● Înregistrează mesajul", ru: "● Записать сообщение" })}</button>
      <label className="report-text-button">{t({ ro: "Încarcă audio", ru: "Загрузить аудио" })}<input type="file" accept="audio/*" className="sr-only" disabled={recording || working} onChange={e => { const file = e.target.files?.[0]; if (file) { if (file.size > 25 * 1024 * 1024) { setError(t({ ro: "Alege un fișier de maximum 25 MB.", ru: "Выберите файл до 25 МБ." })); return; } onAudio(file); onTranscript(""); void transcribe(file); } }} /></label>
    </div>
    <p role="status" className="report-muted">{working ? t({ ro: "Pregătim transcrierea…", ru: "Готовим расшифровку…" }) : recording ? t({ ro: "Te ascultăm… maximum 2 minute", ru: "Слушаем… максимум 2 минуты" }) : ""}</p>
    {audio && <div className="voice-preview"><ReportMedia file={audio} /><button type="button" className="report-text-button" disabled={recording || working} onClick={() => onAudio(null)}>{t({ ro: "Elimină audio", ru: "Удалить аудио" })}</button></div>}
    <label className="report-label" htmlFor="voice-transcript">{t({ ro: "Mesajul tău, în cuvinte", ru: "Ваше сообщение текстом" })}</label>
    <textarea id="voice-transcript" className="report-input" rows={3} maxLength={1000} value={transcript} disabled={recording} onChange={e => onTranscript(e.target.value)} placeholder={t({ ro: "Transcrierea va apărea aici…", ru: "Здесь появится расшифровка…" })} />
    {transcript && <button type="button" className="report-text-button" onClick={() => { if (!window.speechSynthesis) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(transcript); utterance.lang = lang === "ru" ? "ru-RU" : "ro-RO"; window.speechSynthesis.speak(utterance); }}>{t({ ro: "Ascultă textul", ru: "Прослушать текст" })}</button>}
    {error && <p role="alert" className="report-error">{error}</p>}
  </div>;
}

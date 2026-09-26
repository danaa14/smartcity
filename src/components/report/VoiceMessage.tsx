"use client";
import { useEffect, useRef, useState } from "react";
import { useLang } from "../LangProvider";

type Recognition = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void; abort: () => void };
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
export function VoiceMessage({ audio, onAudio, text, onText, onBusy }: { audio: File | null; onAudio: (file: File | null) => void; text: string; onText: (text: string) => void; onBusy: (busy: boolean) => void }) {
  const { lang, t } = useLang();
  const recorder = useRef<MediaRecorder | null>(null), media = useRef<MediaStream | null>(null), recognition = useRef<Recognition | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null), alive = useRef(true), transcript = useRef("");
  const [recording, setRecording] = useState(false), [starting, setStarting] = useState(false), [error, setError] = useState(false), [url, setUrl] = useState("");
  useEffect(() => { alive.current = true; return () => { alive.current = false; recognition.current?.abort(); if (recorder.current?.state === "recording") recorder.current.stop(); media.current?.getTracks().forEach(track => track.stop()); if (timer.current) clearTimeout(timer.current); }; }, []);
  useEffect(() => { if (!audio) return; const value = URL.createObjectURL(audio); setUrl(value); return () => URL.revokeObjectURL(value); }, [audio]);
  function stop() { recognition.current?.stop(); if (recorder.current?.state === "recording") recorder.current.stop(); if (timer.current) clearTimeout(timer.current); }
  async function start() {
    setStarting(true); onBusy(true); setError(false); transcript.current = "";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) { stream.getTracks().forEach(track => track.stop()); return; }
      media.current = stream;
      const mr = new MediaRecorder(stream), chunks: Blob[] = [];
      recorder.current = mr;
      mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        if (!alive.current) return;
        setRecording(false); setStarting(false);
        const mime = mr.mimeType.split(";")[0] || "audio/webm";
        const file = new File(chunks, `mesaj.${mime.split("/")[1]}`, { type: mime });
        onAudio(file);
        if (!transcript.current.trim()) {
          try {
            const form = new FormData(); form.append("file", file); form.append("lang", lang);
            const res = await fetch("/api/report/video", { method: "POST", body: form, signal: AbortSignal.timeout(55000) });
            const result = await res.json(); if (!res.ok || !result.transcript?.trim()) throw new Error();
            if (alive.current) onText(result.transcript.slice(0, 1000));
          } catch { if (alive.current) setError(true); }
        }
        if (alive.current) onBusy(false);
      };
      const Speech = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
      if (Speech) {
        const sr = new Speech(); recognition.current = sr; sr.lang = lang === "ro" ? "ro-RO" : "ru-RU"; sr.continuous = true; sr.interimResults = true;
        sr.onresult = event => { transcript.current = Array.from(event.results).map(r => r[0].transcript).join(" "); if (alive.current) onText(transcript.current.slice(0, 1000)); };
        sr.onerror = () => { if (alive.current) setError(true); };
        try { sr.start(); } catch { setError(true); }
      }
      mr.start(); setRecording(true); setStarting(false); timer.current = setTimeout(stop, 120000);
    } catch { media.current?.getTracks().forEach(track => track.stop()); setError(true); setStarting(false); onBusy(false); }
  }
  return <div className="voice-message">
    <div className="voice-top"><div><strong>{t({ ro: "Mai ușor de spus?", ru: "Проще рассказать?" })}</strong><p>{t({ ro: "Înregistrează, apoi verifică textul.", ru: "Запишите голос и проверьте текст." })}</p></div><button type="button" className={`voice-record ${recording ? "is-recording" : ""}`} disabled={starting} onClick={() => recording ? stop() : void start()}>{recording ? "■ " : "● "}{recording ? t({ ro: "Oprește", ru: "Стоп" }) : t({ ro: "Înregistrează", ru: "Записать" })}</button></div>
    <p className="report-helper">{t({ ro: "Transcrierea live poate folosi serviciul vocal al browserului. Maximum 2 minute.", ru: "Распознавание речи может использовать голосовой сервис браузера. До 2 минут." })}</p>
    {recording && <p role="status">{t({ ro: "Te ascult… textul apare mai jos.", ru: "Слушаю… текст появится ниже." })}</p>}
    {audio && <div className="voice-playback"><audio controls src={url} /><button type="button" onClick={() => onAudio(null)}>{t({ ro: "Elimină audio", ru: "Удалить аудио" })}</button></div>}
    {error && <p className="report-helper" role="status">{t({ ro: "Transcrierea nu este disponibilă acum. Poți păstra vocea și scrie sau corecta mesajul mai jos.", ru: "Распознавание сейчас недоступно. Можно сохранить голос и написать или исправить текст ниже." })}</p>}
    <label className="report-label">{t({ ro: "Mesajul tău · text editabil, opțional", ru: "Ваше сообщение · можно исправить, необязательно" })}<textarea value={text} onChange={e => onText(e.target.value)} maxLength={1000} rows={3} placeholder={t({ ro: "Adaugă un detaliu, dacă vrei…", ru: "Добавьте подробности, если хотите…" })} /></label>
  </div>;
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "../LangProvider";

export function ReportCamera({ onPhoto }: { onPhoto: (file: File) => void | Promise<void> }) {
  const { t } = useLang();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const epoch = useRef(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "opening" | "ready" | "blocked">("idle");
  const picker = useRef<HTMLInputElement>(null);
  const stop = useCallback(() => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; }, []);
  const start = useCallback(async () => {
    const attempt = ++epoch.current;
    stop(); setReady(false); setState("opening");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("camera_unavailable");
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } }, audio: false });
      if (attempt !== epoch.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      if (video.current) { video.current.srcObject = media; await video.current.play(); }
      if (attempt === epoch.current) setState("ready");
    } catch { if (attempt === epoch.current) { stop(); setState("blocked"); } }
  }, [stop]);
  useEffect(() => () => { epoch.current++; stop(); }, [stop]);
  async function capture() {
    if (!ready || busy || !video.current?.videoWidth) return;
    setBusy(true);
    try {
      const v = video.current, canvas = document.createElement("canvas");
      const scale = Math.min(1, 1800 / Math.max(v.videoWidth, v.videoHeight));
      canvas.width = Math.round(v.videoWidth * scale); canvas.height = Math.round(v.videoHeight * scale);
      const context = canvas.getContext("2d"); if (!context) throw new Error();
      context.drawImage(v, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", .88));
      if (!blob) throw new Error();
      epoch.current++; stop(); await onPhoto(new File([blob], "fotografie.jpg", { type: "image/jpeg" }));
    } catch { setState("blocked"); } finally { setBusy(false); }
  }
  return <div className="report-camera">
    <div className="camera-view">
      <video ref={video} autoPlay playsInline muted onLoadedData={() => setReady(true)} aria-label={t({ ro: "Camera pentru fotografie", ru: "Камера для фото" })} />
      <div className="camera-corners" aria-hidden="true"><i /><i /><i /><i /></div>
      {!ready && <div className="camera-placeholder"><span aria-hidden="true">◎</span><p>{state === "opening" ? t({ ro: "Se deschide camera…", ru: "Открываем камеру…" }) : state === "blocked" ? t({ ro: "Camera nu este disponibilă. Permite accesul în browser și folosește HTTPS sau alege din galerie.", ru: "Камера недоступна. Разрешите доступ в браузере и откройте сайт по HTTPS либо выберите фото из галереи." }) : t({ ro: "Alege o fotografie sau pornește camera.", ru: "Выберите фото или включите камеру." })}</p></div>}
      <span className="camera-caption">{t({ ro: "Un cadru. Un oraș mai bun.", ru: "Один кадр. Город становится лучше." })}</span>
    </div>
    <div className="camera-controls">
      <input ref={picker} type="file" accept="image/*,.heic,.heif" className="sr-only" aria-label={t({ ro: "Alege o fotografie din galerie sau fișiere", ru: "Выберите фото из галереи или файлов" })} onChange={async e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) { setBusy(true); epoch.current++; stop(); try { await onPhoto(file); } finally { setBusy(false); } } }} />
      <button type="button" className="camera-alternative" disabled={busy} onClick={() => picker.current?.click()}><span aria-hidden="true">▧</span>{t({ ro: "Din galerie", ru: "Из галереи" })}</button>
      {ready ? <button type="button" className="camera-shutter" disabled={busy} onClick={() => void capture()} aria-label={t({ ro: "Fotografiază", ru: "Сделать фото" })}><span /></button> : <button type="button" className="camera-start" disabled={state === "opening"} onClick={() => void start()}>{state === "opening" ? t({ ro: "Se deschide…", ru: "Открываем…" }) : t({ ro: "Pornește camera", ru: "Включить камеру" })}</button>}
    </div>
  </div>;
}

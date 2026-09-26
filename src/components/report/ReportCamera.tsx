"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "../LangProvider";

export function ReportCamera({ onPhoto }: { onPhoto: (file: File) => void }) {
  const { t } = useLang();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const epoch = useRef(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"opening" | "ready" | "blocked" | "paused">("opening");
  const stop = useCallback(() => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; }, []);
  const start = useCallback(async () => {
    const attempt = ++epoch.current;
    stop(); setReady(false); setState("opening");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } }, audio: false });
      if (attempt !== epoch.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      if (video.current) { video.current.srcObject = media; await video.current.play(); }
      if (attempt === epoch.current) setState("ready");
    } catch { if (attempt === epoch.current) { stop(); setState("blocked"); } }
  }, [stop]);
  useEffect(() => {
    const lifecycle = epoch;
    const timer = setTimeout(() => void start(), 0);
    const hide = () => { if (document.hidden) { epoch.current++; stop(); setReady(false); setState("paused"); } };
    document.addEventListener("visibilitychange", hide);
    return () => { clearTimeout(timer); lifecycle.current++; stop(); document.removeEventListener("visibilitychange", hide); };
  }, [start, stop]);
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
      epoch.current++; stop(); onPhoto(new File([blob], "fotografie.jpg", { type: "image/jpeg" }));
    } catch { setState("blocked"); } finally { setBusy(false); }
  }
  return <div className="report-camera">
    <div className="camera-view">
      <video ref={video} autoPlay playsInline muted onLoadedData={() => setReady(true)} aria-label={t({ ro: "Camera pentru fotografie", ru: "Камера для фото" })} />
      <div className="camera-corners" aria-hidden="true"><i /><i /><i /><i /></div>
      {!ready && <div className="camera-placeholder"><span aria-hidden="true">◎</span><p>{state === "opening" ? t({ ro: "Se deschide camera…", ru: "Открываем камеру…" }) : state === "paused" ? t({ ro: "Camera este oprită", ru: "Камера остановлена" }) : t({ ro: "Permite accesul la cameră sau alege o fotografie", ru: "Разрешите доступ к камере или выберите фото" })}</p>{state !== "opening" && <button type="button" onClick={() => void start()}>{t({ ro: "Încearcă din nou", ru: "Попробовать снова" })}</button>}</div>}
      <span className="camera-caption">{t({ ro: "Un cadru. Un oraș mai bun.", ru: "Один кадр. Город становится лучше." })}</span>
    </div>
    <div className="camera-controls"><label className="camera-alternative"><span aria-hidden="true">▧</span>{t({ ro: "Din galerie", ru: "Из галереи" })}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => { const file = e.target.files?.[0]; if (file) { epoch.current++; stop(); onPhoto(file); } e.target.value = ""; }} /></label><button className="camera-shutter" disabled={!ready || busy} onClick={() => void capture()} aria-label={t({ ro: "Fotografiază", ru: "Сделать фото" })}><span /></button></div>
  </div>;
}

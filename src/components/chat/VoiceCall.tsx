"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/corpus/types";

type VoiceStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "disconnected" | "error";
type VoiceLine = { id: number; role: "user" | "assistant"; text: string };
type VoiceSource = { chunkId: string; document: string; page?: number; section?: string; passage: string; score: number };
type VoiceSourceGroup = { id: number; query: string; results: VoiceSource[]; fallback: string };
type SearchResult = { results: VoiceSource[]; fallback: string };

const LABELS: Record<Lang, Record<VoiceStatus, string>> = {
  ro: { idle: "Pregătit", connecting: "Se conectează…", listening: "Ascult", thinking: "Mă gândesc…", speaking: "Vorbesc", disconnected: "Apel încheiat", error: "Conexiune indisponibilă" },
  ru: { idle: "Готово", connecting: "Подключение…", listening: "Слушаю", thinking: "Думаю…", speaking: "Говорю", disconnected: "Звонок завершён", error: "Соединение недоступно" },
};

const COPY = {
  ro: {
    intro: "Poți întrerupe răspunsul oricând. Pentru răspunsuri folosesc doar Anexa 1, care enumeră categorii de servicii și site-uri — nu procedurile descrise pe ele.",
    start: "Pornește asistentul vocal", end: "Încheie apelul", transcript: "Conversație", sources: "Surse folosite", noSources: "Documentul disponibil nu conține suficiente informații pentru a răspunde.",
    unavailable: "Asistentul vocal nu este disponibil acum. Poți continua conversația în scris.", denied: "Accesul la microfon a fost refuzat. Permite microfonul în setările browserului și încearcă din nou.", unsupported: "Acest browser nu acceptă apeluri vocale. Continuă conversația în scris.",
    searchError: "Nu am putut verifica sursa. Încearcă din nou sau scrie întrebarea în chat.",
    user: "Tu", assistant: "pe fir", page: "Pagina", expand: "Vezi pasajul", human: "Preferi să vorbești cu o persoană?", humanCall: "Sună la Ghișeul Unic · +373 22 20 15 05",
    allSources: "Deschide PDF-ul și toate pasajele citabile",
    greeting: "Salută utilizatorul în limba curentă a interfeței. Spune pe scurt că poți căuta doar lista de categorii și site-uri din Anexa 1, apoi invită-l să întrebe.",
  },
  ru: {
    intro: "Вы можете перебить ответ в любой момент. Я использую только Приложение 1: в нём перечислены категории услуг и сайты, но нет опубликованных там процедур.",
    start: "Начать голосовой разговор", end: "Завершить звонок", transcript: "Диалог", sources: "Использованные источники", noSources: "В доступном документе недостаточно информации для ответа.",
    unavailable: "Голосовой помощник сейчас недоступен. Продолжите диалог письменно.", denied: "Доступ к микрофону запрещён. Разрешите микрофон в настройках браузера и попробуйте снова.", unsupported: "Этот браузер не поддерживает голосовые звонки. Продолжите диалог письменно.",
    searchError: "Не удалось проверить источник. Попробуйте снова или напишите вопрос в чате.",
    user: "Вы", assistant: "pe fir", page: "Страница", expand: "Показать фрагмент", human: "Хотите поговорить с человеком?", humanCall: "Единое окно · +373 22 20 15 05",
    allSources: "Открыть PDF и все цитируемые фрагменты",
    greeting: "Поприветствуй пользователя на текущем языке интерфейса. Кратко объясни, что доступен только список категорий и сайтов из Приложения 1, и предложи задать вопрос.",
  },
} as const;

function localizedError(lang: Lang, code: string): string {
  const copy = COPY[lang];
  if (code === "voice_not_configured" || code === "voice_unavailable") return copy.unavailable;
  if (code === "search_unavailable" || code === "source_unavailable") return copy.searchError;
  return copy.unavailable;
}

export function VoiceCall({ lang, open }: { lang: Lang; open: boolean }) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [lines, setLines] = useState<VoiceLine[]>([]);
  const [sourceGroups, setSourceGroups] = useState<VoiceSourceGroup[]>([]);
  const [error, setError] = useState("");
  const peer = useRef<RTCPeerConnection | null>(null);
  const channel = useRef<RTCDataChannel | null>(null);
  const microphone = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const lineSequence = useRef(0);
  const searchBusy = useRef(false);
  const sessionGeneration = useRef(0);

  const release = useCallback(() => {
    sessionGeneration.current += 1;
    channel.current?.close();
    channel.current = null;
    peer.current?.close();
    peer.current = null;
    microphone.current?.getTracks().forEach((track) => track.stop());
    microphone.current = null;
    if (audio.current) audio.current.srcObject = null;
    searchBusy.current = false;
  }, []);

  useEffect(() => () => release(), [release]);
  useEffect(() => {
    if (!open) {
      release();
      setStatus((current) => current === "idle" ? "idle" : "disconnected");
    }
  }, [open, release]);

  const addLine = (role: VoiceLine["role"], text: string) => {
    const id = ++lineSequence.current;
    setLines((current) => [...current, { id, role, text }]);
    return id;
  };

  const appendAssistant = (text: string) => {
    if (!text) return;
    setLines((current) => {
      const last = current.at(-1);
      if (last?.role === "assistant") return [...current.slice(0, -1), { ...last, text: last.text + text }];
      return [...current, { id: ++lineSequence.current, role: "assistant", text }];
    });
  };

  const sendEvent = (value: unknown) => {
    if (channel.current?.readyState === "open") channel.current.send(JSON.stringify(value));
  };

  const search = async (event: { call_id?: string; arguments?: string }) => {
    if (!event.call_id || searchBusy.current) return;
    searchBusy.current = true;
    setStatus("thinking");
    try {
      const args = JSON.parse(event.arguments ?? "{}") as { query?: unknown };
      const query = typeof args.query === "string" ? args.query.slice(0, 300) : "";
      if (!query) throw new Error("invalid_tool_arguments");
      const response = await fetch("/api/voice/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, lang }),
      });
      if (!response.ok) throw new Error("search_unavailable");
      const result = await response.json() as SearchResult;
      setSourceGroups((current) => [...current, { id: ++lineSequence.current, query, results: result.results, fallback: result.results.length ? "" : result.fallback }]);
      sendEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify(result) } });
      sendEvent({ type: "response.create" });
    } catch {
      setError(COPY[lang].searchError);
      setSourceGroups((current) => [...current, { id: ++lineSequence.current, query: "", results: [], fallback: COPY[lang].noSources }]);
      sendEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify({ results: [], fallback: COPY[lang].noSources }) } });
      sendEvent({ type: "response.create" });
    } finally {
      searchBusy.current = false;
    }
  };

  const handleServerEvent = (event: Record<string, unknown>) => {
    const type = event.type;
    if (type === "input_audio_buffer.speech_started") setStatus("listening");
    else if (type === "input_audio_buffer.speech_stopped" || type === "response.created") setStatus("thinking");
    else if (type === "conversation.item.input_audio_transcription.completed") {
      const transcript = typeof event.transcript === "string" ? event.transcript.trim() : "";
      if (transcript) addLine("user", transcript);
      setStatus("thinking");
    } else if (type === "response.output_audio.delta") setStatus("speaking");
    else if (type === "response.output_audio_transcript.delta") {
      setStatus("speaking");
      appendAssistant(typeof event.delta === "string" ? event.delta : "");
    } else if (type === "response.function_call_arguments.done") {
      if (event.name === "searchMunicipalDocuments") void search({ call_id: typeof event.call_id === "string" ? event.call_id : undefined, arguments: typeof event.arguments === "string" ? event.arguments : undefined });
      else if (typeof event.call_id === "string") {
        sendEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify({ results: [], fallback: COPY[lang].noSources }) } });
        sendEvent({ type: "response.create" });
      }
    } else if (type === "response.done") {
      const response = event.response as { status?: string; status_details?: { error?: { code?: string } } } | undefined;
      if (response?.status === "failed") {
        setStatus("error");
        setError(COPY[lang].unavailable);
      } else if (peer.current?.connectionState === "connected") setStatus("listening");
    } else if (type === "error") {
      setStatus("error");
      setError(COPY[lang].unavailable);
    }
  };

  const start = async () => {
    setError("");
    setSourceGroups([]);
    setLines([]);
    lineSequence.current = 0;
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
      setStatus("error");
      setError(COPY[lang].unsupported);
      return;
    }

    setStatus("connecting");
    const generation = ++sessionGeneration.current;
    try {
      const readinessResponse = await fetch("/api/voice/ready", { cache: "no-store" });
      const readiness = await readinessResponse.json().catch(() => ({})) as { ready?: boolean };
      if (generation !== sessionGeneration.current) return;
      if (!readinessResponse.ok || !readiness.ready) throw new Error("voice_not_configured");
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (generation !== sessionGeneration.current) { mic.getTracks().forEach((track) => track.stop()); return; }
      microphone.current = mic;
      const tokenResponse = await fetch("/api/voice/token", { method: "POST", cache: "no-store" });
      const token = await tokenResponse.json().catch(() => ({})) as { value?: string; error?: string };
      if (generation !== sessionGeneration.current) { mic.getTracks().forEach((track) => track.stop()); return; }
      if (!tokenResponse.ok || !token.value) throw new Error(token.error || "voice_unavailable");

      const connection = new RTCPeerConnection();
      peer.current = connection;
      mic.getTracks().forEach((track) => connection.addTrack(track, mic));
      connection.ontrack = (event) => {
        if (audio.current) audio.current.srcObject = event.streams[0];
      };
      connection.onconnectionstatechange = () => {
        if (connection.connectionState === "failed") {
          setStatus("error");
          setError(COPY[lang].unavailable);
        } else if (connection.connectionState === "disconnected") setStatus("disconnected");
      };

      const dataChannel = connection.createDataChannel("oai-events");
      channel.current = dataChannel;
      dataChannel.onmessage = (message) => {
        try { handleServerEvent(JSON.parse(message.data) as Record<string, unknown>); }
        catch { setError(COPY[lang].unavailable); }
      };
      dataChannel.onopen = () => {
        setStatus("listening");
        sendEvent({ type: "response.create", response: { instructions: COPY[lang].greeting } });
      };
      dataChannel.onclose = () => {
        if (peer.current === connection && connection.connectionState !== "closed") setStatus("disconnected");
      };

      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      const answer = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: { authorization: `Bearer ${token.value}`, "content-type": "application/sdp" },
        body: offer.sdp,
      });
      if (generation !== sessionGeneration.current) { connection.close(); mic.getTracks().forEach((track) => track.stop()); return; }
      if (!answer.ok) throw new Error("voice_unavailable");
      await connection.setRemoteDescription({ type: "answer", sdp: await answer.text() });
    } catch (cause) {
      if (generation !== sessionGeneration.current) return;
      release();
      setStatus("error");
      const code = cause instanceof Error ? cause.message : "voice_unavailable";
      const denied = cause instanceof DOMException && ["NotAllowedError", "PermissionDeniedError"].includes(cause.name);
      setError(denied ? COPY[lang].denied : localizedError(lang, code));
    }
  };

  const end = () => {
    release();
    setStatus("disconnected");
  };

  const copy = COPY[lang];
  const active = ["connecting", "listening", "thinking", "speaking"].includes(status);

  return (
    <section className="voice-call" aria-label={copy.transcript}>
      <audio ref={audio} autoPlay playsInline className="sr-only" />
      <p className="voice-call-intro">{copy.intro}</p>
      <div className="voice-call-status" role="status" aria-live="polite">
        <span className={`voice-call-indicator ${active ? "is-active" : ""}`} aria-hidden="true" />
        <span>{LABELS[lang][status]}</span>
      </div>

      {error && <p className="voice-call-error" role="alert">{error}</p>}
      {lines.length > 0 && (
        <section className="voice-call-transcript" aria-label={copy.transcript} aria-live="polite">
          <h3>{copy.transcript}</h3>
          <ol>{lines.map((line) => <li key={line.id} className={`voice-call-line ${line.role}`}><strong>{line.role === "user" ? copy.user : copy.assistant}</strong><p>{line.text}</p></li>)}</ol>
        </section>
      )}

      {sourceGroups.length > 0 && (
        <section className="voice-call-sources" aria-label={copy.sources}>
          <h3>{copy.sources}</h3>
          {sourceGroups.map((group) => <div key={group.id} className="voice-call-source-group">
            {group.query && <p className="voice-call-source-query">{group.query}</p>}
            {group.fallback && <p>{group.fallback}</p>}
            {group.results.map((source, index) => (
              <details key={`${source.page}-${source.section}-${index}`}>
                <summary>{source.document} · {copy.page} {source.page ?? "—"}{source.section ? ` · ${source.section}` : ""}</summary>
                <p>{source.passage}</p>
              </details>
            ))}
          </div>)}
          <a className="sheet-text-link" href="/surse/voice-annex-source-list">{copy.allSources} ↗</a>
        </section>
      )}

      <div className="voice-call-actions">
        {active
          ? <button type="button" className="voice-call-end" onClick={end}>{copy.end}</button>
          : <button type="button" className="voice-call-start" onClick={() => void start()}>{copy.start}</button>}
      </div>
      <p className="voice-call-human">{copy.human} <a href="tel:+37322201505">{copy.humanCall}</a></p>
    </section>
  );
}

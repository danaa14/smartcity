"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Lang } from "@/lib/corpus/types";

type VoiceStatus = "idle" | "requesting-microphone" | "connecting" | "listening" | "thinking" | "speaking" | "ended" | "error";
type VoiceLine = { id: number; role: "user" | "assistant"; text: string };
type VoiceSource = { chunkId: string; questionPart: string; document: string; url: string | null; agency: string; language: string; lastCheckedAt: string; publicationDate: string | null; page?: number; section?: string; locator: string; passage: string; score: number };
type VoiceSourceGroup = { id: number; query: string; results: VoiceSource[]; fallback: string; missingParts: string[] };
type SearchResult = { results: VoiceSource[]; fallback: string; missingParts: string[] };

const LABELS: Record<Lang, Record<VoiceStatus, string>> = {
  ro: { idle: "Pregătit", "requesting-microphone": "Solicit accesul la microfon…", connecting: "Se conectează…", listening: "Ascult · microfon pornit", thinking: "Verific sursele… · microfon în pauză", speaking: "Vorbesc · microfon în pauză", ended: "Apel încheiat · microfon oprit", error: "Conexiune indisponibilă" },
  ru: { idle: "Готово", "requesting-microphone": "Запрашиваю доступ к микрофону…", connecting: "Подключение…", listening: "Слушаю · микрофон включён", thinking: "Проверяю источники… · микрофон на паузе", speaking: "Говорю · микрофон на паузе", ended: "Звонок завершён · микрофон выключен", error: "Соединение недоступно" },
};

const COPY = {
  ro: {
    intro: "Caut în paginile și documentele oficiale indexate din sursele catalogate în Anexa 1. Audio este transmis furnizorului vocal pentru procesare; aplicația nu salvează înregistrări sau transcripturi după închiderea ferestrei.",
    start: "Pornește asistentul vocal", retry: "Încearcă din nou", end: "Încheie apelul", stop: "Oprește răspunsul", transcript: "Conversație", sources: "Surse folosite", noSources: "Nu am găsit dovezi relevante în sursele oficiale indexate.",
    unavailable: "Serviciul vocal nu este disponibil. Încearcă din nou sau sună la Ghișeul Unic.", denied: "Accesul la microfon a fost refuzat. Permite-l în setările browserului și încearcă din nou.", missingMic: "Nu a fost găsit un microfon. Conectează un microfon și reîncearcă.", micBusy: "Microfonul nu poate fi deschis. Verifică dacă este folosit de altă aplicație.", network: "Conexiunea la serviciul vocal a eșuat. Verifică internetul și încearcă din nou.", timeout: "Asistentul nu a început să asculte în 15 secunde. Încearcă din nou sau sună la Ghișeul Unic.", unsupported: "Acest browser nu acceptă apeluri vocale. Continuă conversația în scris.",
    wrongLanguage: "Întrebarea pare să fie în rusă, dar limba selectată este româna. Schimbă limba site-ului sau corectează transcriptul înainte de trimitere.",
    searchError: "Nu am putut verifica sursa. Încearcă din nou sau scrie întrebarea în chat.",
    user: "Tu", assistant: "pe fir", page: "Pagina", checked: "Verificat", expand: "Vezi pasajul", human: "Preferi să vorbești cu o persoană?", humanCall: "Sună la Ghișeul Unic · +373 22 20 15 05",
    allSources: "Deschide catalogul surselor", correct: "Corectează întrebarea recunoscută", askCorrected: "Trimite întrebarea corectată", privacy: "Întrebarea recunoscută este păstrată doar în această fereastră.",
    greeting: "Salută utilizatorul în limba curentă a interfeței. Spune pe scurt că poți căuta în paginile și documentele oficiale indexate din sursele catalogate în Anexa 1, apoi invită-l să întrebe.",
  },
  ru: {
    intro: "Я ищу в проиндексированных официальных страницах и документах, перечисленных в каталоге Приложения 1. Аудио передаётся голосовому провайдеру для обработки; приложение не сохраняет записи или расшифровки после закрытия окна.",
    start: "Начать голосовой разговор", retry: "Повторить", end: "Завершить звонок", stop: "Остановить ответ", transcript: "Диалог", sources: "Использованные источники", noSources: "В проиндексированных официальных источниках не найдено релевантных сведений.",
    unavailable: "Голосовой сервис недоступен. Попробуйте снова или позвоните в Единое окно.", denied: "Доступ к микрофону запрещён. Разрешите его в настройках браузера и попробуйте снова.", missingMic: "Микрофон не найден. Подключите микрофон и повторите попытку.", micBusy: "Не удалось открыть микрофон. Проверьте, не использует ли его другое приложение.", network: "Не удалось подключиться к голосовому сервису. Проверьте интернет и попробуйте снова.", timeout: "Ассистент не начал слушать за 15 секунд. Попробуйте снова или позвоните в Единое окно.", unsupported: "Этот браузер не поддерживает голосовые звонки. Продолжите диалог письменно.",
    wrongLanguage: "Похоже, вопрос задан по-румынски, а на сайте выбран русский. Смените язык сайта или исправьте расшифровку перед отправкой.",
    searchError: "Не удалось проверить источник. Попробуйте снова или напишите вопрос в чате.",
    user: "Вы", assistant: "pe fir", page: "Страница", checked: "Проверено", expand: "Показать фрагмент", human: "Хотите поговорить с человеком?", humanCall: "Единое окно · +373 22 20 15 05",
    allSources: "Открыть каталог источников", correct: "Исправить распознанный вопрос", askCorrected: "Отправить исправленный вопрос", privacy: "Распознанный вопрос хранится только в этом окне.",
    greeting: "Поприветствуй пользователя на текущем языке интерфейса. Кратко объясни, что ты ищешь в проиндексированных официальных страницах и документах из каталога Приложения 1, и предложи задать вопрос.",
  },
} as const;

function localizedError(lang: Lang, code: string): string {
  const copy = COPY[lang];
  if (code === "voice_not_configured" || code === "voice_unavailable") return copy.unavailable;
  if (code === "startup_timeout") return copy.timeout;
  if (code === "network_error") return copy.network;
  if (code === "NotFoundError" || code === "DevicesNotFoundError") return copy.missingMic;
  if (code === "NotReadableError" || code === "TrackStartError") return copy.micBusy;
  if (code === "search_unavailable" || code === "source_unavailable") return copy.searchError;
  return copy.unavailable;
}

export function VoiceCall({ lang, open }: { lang: Lang; open: boolean }) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [lines, setLines] = useState<VoiceLine[]>([]);
  const [sourceGroups, setSourceGroups] = useState<VoiceSourceGroup[]>([]);
  const [error, setError] = useState("");
  const [recognizedQuestion, setRecognizedQuestion] = useState("");
  const peer = useRef<RTCPeerConnection | null>(null);
  const channel = useRef<RTCDataChannel | null>(null);
  const microphone = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const lineSequence = useRef(0);
  const searchBusy = useRef(false);
  const sessionGeneration = useRef(0);
  const startupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognizedRef = useRef("");

  const clearStartupTimer = () => {
    if (startupTimer.current) clearTimeout(startupTimer.current);
    startupTimer.current = null;
  };
  const setMicrophoneEnabled = (enabled: boolean) => {
    microphone.current?.getAudioTracks().forEach((track) => { track.enabled = enabled; });
  };

  const release = useCallback(() => {
    clearStartupTimer();
    sessionGeneration.current += 1;
    channel.current?.close();
    channel.current = null;
    peer.current?.close();
    peer.current = null;
    microphone.current?.getTracks().forEach((track) => track.stop());
    microphone.current = null;
    if (audio.current) { audio.current.pause(); audio.current.srcObject = null; }
    searchBusy.current = false;
  }, []);

  useEffect(() => () => release(), [release]);
  useEffect(() => {
    if (!open) {
      release();
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

  const selectedLang = useRef(lang);
  useEffect(() => {
    if (selectedLang.current === lang) return;
    selectedLang.current = lang;
    if (channel.current?.readyState === "open") {
      channel.current.send(JSON.stringify({ type: "session.update", session: {
        instructions: lang === "ru" ? "Speak and transcribe only Russian from now on. Use only relevant official passages returned by the search tool; abstain if evidence is missing." : "Vorbește și transcrie numai în română de acum înainte. Folosește doar pasaje oficiale relevante întoarse de căutare; abține-te dacă lipsesc dovezile.",
        audio: { input: { transcription: { model: "gpt-4o-mini-transcribe", language: lang, prompt: lang === "ru" ? "Вопросы о муниципальных услугах Кишинёва. Точно сохраняй названия улиц и учреждений, даты, суммы и номера документов." : "Întrebări despre servicii municipale în Chișinău. Păstrează exact numele străzilor și instituțiilor, datele, sumele și numerele documentelor." } }, output: { voice: "marin" } },
      } }));
    }
  }, [lang]);

  const search = async (event: { call_id?: string; arguments?: string }) => {
    if (!event.call_id || searchBusy.current) return;
    searchBusy.current = true;
    setStatus("thinking");
    try {
      const args = JSON.parse(event.arguments ?? "{}") as { query?: unknown };
      const query = (recognizedRef.current || (typeof args.query === "string" ? args.query : "")).slice(0, 300).trim();
      if (!query) throw new Error("invalid_tool_arguments");
      const response = await fetch("/api/voice/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, lang: selectedLang.current }),
      });
      if (!response.ok) throw new Error("search_unavailable");
      const result = await response.json() as SearchResult;
      setSourceGroups((current) => [...current, { id: ++lineSequence.current, query, results: result.results, fallback: result.results.length ? "" : result.fallback, missingParts: result.missingParts ?? [] }]);
      sendEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify(result) } });
      sendEvent({ type: "response.create" });
    } catch {
      setError(COPY[selectedLang.current].searchError);
      setSourceGroups((current) => [...current, { id: ++lineSequence.current, query: "", results: [], fallback: COPY[selectedLang.current].noSources, missingParts: [] }]);
      sendEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify({ results: [], fallback: COPY[selectedLang.current].noSources }) } });
      sendEvent({ type: "response.create" });
    } finally {
      searchBusy.current = false;
    }
  };

  const handleServerEvent = (event: Record<string, unknown>) => {
    const type = event.type;
    if (type === "input_audio_buffer.speech_started") { setError(""); setStatus("listening"); }
    else if (type === "input_audio_buffer.speech_stopped") {
      setMicrophoneEnabled(false);
      setStatus("thinking");
    } else if (type === "response.created") {
      setMicrophoneEnabled(false);
      setStatus("thinking");
    } else if (type === "conversation.item.input_audio_transcription.completed") {
      const transcript = typeof event.transcript === "string" ? event.transcript.trim() : "";
      if (transcript) {
        setError("");
        recognizedRef.current = transcript;
        setRecognizedQuestion(transcript);
        addLine("user", transcript);
        const cyrillic = (transcript.match(/[Ѐ-ӿ]/g) ?? []).length;
        const latin = (transcript.match(/[a-zA-ZăâîșțşţĂÂÎȘȚ]/g) ?? []).length;
        if ((selectedLang.current === "ro" && cyrillic > latin) || (selectedLang.current === "ru" && latin > cyril && latin > 5)) {
          setError(COPY[selectedLang.current].wrongLanguage);
          setMicrophoneEnabled(true);
          setStatus("listening");
          return;
        }
        sendEvent({ type: "response.create" });
      }
      setStatus("thinking");
    } else if (type === "response.output_audio.delta") setStatus("speaking");
    else if (type === "response.output_audio_transcript.delta") {
      setStatus("speaking");
      appendAssistant(typeof event.delta === "string" ? event.delta : "");
    } else if (type === "response.function_call_arguments.done") {
      if (event.name === "searchMunicipalDocuments") void search({ call_id: typeof event.call_id === "string" ? event.call_id : undefined, arguments: typeof event.arguments === "string" ? event.arguments : undefined });
      else if (typeof event.call_id === "string") {
        sendEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify({ results: [], fallback: COPY[selectedLang.current].noSources }) } });
        sendEvent({ type: "response.create" });
      }
    } else if (type === "response.done") {
      const response = event.response as { status?: string; status_details?: { error?: { code?: string } } } | undefined;
      if (response?.status === "failed") {
        release();
        setStatus("error");
        setError(COPY[selectedLang.current].unavailable);
      } else if (peer.current?.connectionState === "connected") {
        setMicrophoneEnabled(true);
        setStatus("listening");
      }
    } else if (type === "error") {
      release();
      setStatus("error");
      setError(COPY[selectedLang.current].unavailable);
    }
  };

  const start = async () => {
    setError("");
    setSourceGroups([]);
    setLines([]);
    setRecognizedQuestion("");
    recognizedRef.current = "";
    lineSequence.current = 0;
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
      setStatus("error");
      setError(COPY[selectedLang.current].unsupported);
      return;
    }

    setStatus("connecting");
    const generation = ++sessionGeneration.current;
    startupTimer.current = setTimeout(() => {
      if (generation !== sessionGeneration.current) return;
      release();
      setStatus("error");
      setError(COPY[selectedLang.current].timeout);
    }, 15_000);
    try {
      const readinessResponse = await fetch("/api/voice/ready", { cache: "no-store" });
      const readiness = await readinessResponse.json().catch(() => ({})) as { ready?: boolean };
      if (generation !== sessionGeneration.current) return;
      if (!readinessResponse.ok || !readiness.ready) throw new Error("voice_not_configured");
      setStatus("requesting-microphone");
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (generation !== sessionGeneration.current) { mic.getTracks().forEach((track) => track.stop()); return; }
      microphone.current = mic;
      setStatus("connecting");
      const tokenResponse = await fetch("/api/voice/token", { method: "POST", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang }) });
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
          release();
          setStatus("error");
          setError(COPY[selectedLang.current].unavailable);
        } else if (connection.connectionState === "disconnected") {
          release();
          setStatus("error");
          setError(COPY[selectedLang.current].network);
        }
      };

      const dataChannel = connection.createDataChannel("oai-events");
      channel.current = dataChannel;
      dataChannel.onmessage = (message) => {
        try { handleServerEvent(JSON.parse(message.data) as Record<string, unknown>); }
        catch { setError(COPY[selectedLang.current].unavailable); }
      };
      dataChannel.onopen = () => {
        clearStartupTimer();
        setStatus("listening");
        sendEvent({ type: "response.create", response: { instructions: COPY[selectedLang.current].greeting } });
      };
      dataChannel.onclose = () => {
        if (peer.current === connection && connection.connectionState !== "closed") {
          release();
          setStatus("error");
          setError(COPY[selectedLang.current].network);
        }
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
      const name = cause instanceof DOMException ? cause.name : code;
      const denied = ["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(name);
      const network = cause instanceof TypeError || code === "Failed to fetch";
      setError(denied ? COPY[selectedLang.current].denied : network ? COPY[selectedLang.current].network : localizedError(selectedLang.current, name));
    }
  };

  const end = () => {
    release();
    setStatus("ended");
  };

  const interrupt = () => {
    sendEvent({ type: "response.cancel" });
    sendEvent({ type: "output_audio_buffer.clear" });
    setMicrophoneEnabled(true);
    setStatus("listening");
  };

  const askCorrected = () => {
    const text = recognizedQuestion.trim();
    if (!text) return;
    setError("");
    recognizedRef.current = text;
    addLine("user", text);
    sendEvent({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } });
    sendEvent({ type: "response.create" });
    setMicrophoneEnabled(false);
    setStatus("thinking");
  };

  const copy = COPY[lang];
  const active = ["requesting-microphone", "connecting", "listening", "thinking", "speaking"].includes(status);

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

      {recognizedQuestion && status !== "ended" && (
        <div className="voice-call-correction">
          <label htmlFor="voice-corrected-question">{copy.correct}</label>
          <textarea id="voice-corrected-question" value={recognizedQuestion} onChange={(event) => { recognizedRef.current = event.target.value; setRecognizedQuestion(event.target.value); }} rows={2} />
          <button type="button" onClick={askCorrected}>{copy.askCorrected}</button>
          <p>{copy.privacy}</p>
        </div>
      )}

      {sourceGroups.length > 0 && (
        <section className="voice-call-sources" aria-label={copy.sources}>
          <h3>{copy.sources}</h3>
          {sourceGroups.map((group) => <div key={group.id} className="voice-call-source-group">
            {group.query && <p className="voice-call-source-query">{group.query}</p>}
            {group.fallback && <p>{group.fallback}</p>}
            {group.missingParts.map((part) => <p key={part}>{copy.noSources} <strong>{part}</strong></p>)}
            {group.results.map((source, index) => (
              <details key={`${source.page}-${source.section}-${index}`}>
              <summary>{source.document} · {source.agency} · {source.locator}</summary>
              <p>{source.passage}</p>
              <small>{copy.checked}: {new Date(source.lastCheckedAt).toLocaleDateString(lang === "ru" ? "ru-MD" : "ro-MD")}{source.publicationDate ? ` · ${source.publicationDate}` : ""}</small>
              {source.url && <a href={source.url} target="_blank" rel="noreferrer">{source.url} ↗</a>}
              </details>
            ))}
          </div>)}
          <Link className="sheet-text-link" href="/surse/voice-annex-source-list">{copy.allSources} ↗</Link>
        </section>
      )}

      <div className="voice-call-actions">
        {active
          ? <><button type="button" className="voice-call-end" onClick={end}>{copy.end}</button>{(status === "speaking" || status === "thinking") && <button type="button" onClick={interrupt}>{copy.stop}</button>}</>
          : <button type="button" className="voice-call-start" onClick={() => void start()}>{status === "error" ? copy.retry : copy.start}</button>}
      </div>
      <p className="voice-call-human">{copy.human} <a href="tel:+37322201505">{copy.humanCall}</a></p>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "../LangProvider";
import { Notice } from "../ui";
import { CATEGORIES, type CategoryId } from "@/lib/tickets/types";
import { localDemoAdapter } from "@/lib/tickets/adapter";

const DRAFT_KEY = "pefir_report_draft";
type Step = 1 | 2 | 3;

interface Draft {
  text: string;
  location: string;
  lat?: number;
  lng?: number;
  locationSource: "manual" | "device";
  category: CategoryId | "";
  categorySuggested: CategoryId | "";
  description: string;
  descriptionSuggested: string;
}
const EMPTY: Draft = { text: "", location: "", locationSource: "manual", category: "", categorySuggested: "", description: "", descriptionSuggested: "" };

function loadDraft(): Draft {
  try {
    const parsed = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") as Draft | null;
    return parsed && (parsed.text || parsed.location) ? { ...EMPTY, ...parsed } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function ReportClient() {
  const { lang, t } = useLang();
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [d, setD] = useState<Draft>(EMPTY);
  const [files, setFiles] = useState<File[]>([]);
  const [audio, setAudio] = useState<File | null>(null);
  const [vid, setVid] = useState<{ busy: boolean; error: string; transcript: string; ai: boolean } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [geoState, setGeoState] = useState<"idle" | "asking" | "denied" | "ok">("idle");
  const [confirm, setConfirm] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const headRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  const loaded = useRef(false);

  useEffect(() => {
    // Restored after mount so server and client render the same initial markup.
    const draft = loadDraft();
    loaded.current = true;
    if (draft !== EMPTY) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setD(draft);
      setRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch {}
  }, [d]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headRef.current?.focus();
  }, [step]);

  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  const goStep2 = async () => {
    const e: Record<string, string> = {};
    if (d.text.trim().length < 5 && !files.length && !audio)
      e.text = t({ ro: "Descrieți problema în câteva cuvinte sau adăugați o fotografie/înregistrare.", ru: "Опишите проблему в нескольких словах или добавьте фото/запись." });
    if (d.text.trim().length > 0 && d.text.trim().length < 5)
      e.text = t({ ro: "Descrierea este prea scurtă — minimum 5 caractere.", ru: "Описание слишком короткое — минимум 5 символов." });
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById("rep-text")?.focus();
      return;
    }
    const r = await fetch("/api/report/suggest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: d.text }) }).catch(() => null);
    const j = r?.ok ? await r.json() : null;
    const cat: CategoryId | "" = j?.category?.id ?? "";
    set({
      categorySuggested: cat,
      category: d.category || cat,
      descriptionSuggested: j?.description ?? d.text,
      description: d.description || j?.description || d.text,
    });
    setStep(2);
  };

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setGeoState("denied");
      return;
    }
    setGeoState("asking");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const lat = Math.round(p.coords.latitude * 1e5) / 1e5;
        const lng = Math.round(p.coords.longitude * 1e5) / 1e5;
        set({ lat, lng, locationSource: "device", location: d.location || `${lat}, ${lng}` });
        setGeoState("ok");
      },
      () => setGeoState("denied"),
      { timeout: 10000, maximumAge: 60000 },
    );
  };

  const goStep3 = () => {
    const e: Record<string, string> = {};
    if (d.location.trim().length < 3) e.location = t({ ro: "Indicați locul: stradă și număr, intersecție sau un reper.", ru: "Укажите место: улица и номер, перекрёсток или ориентир." });
    if (!d.category) e.category = t({ ro: "Alegeți o categorie.", ru: "Выберите категорию." });
    if (d.description.trim().length < 5 && !hasVideo) e.description = t({ ro: "Descrierea trebuie să aibă cel puțin 5 caractere.", ru: "Описание должно быть не короче 5 символов." });
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById(e.location ? "rep-loc" : e.category ? "cat-legend" : "rep-desc")?.focus();
      return;
    }
    setStep(3);
  };

  const submit = async () => {
    if (!confirm) {
      setErrors({ confirm: t({ ro: "Bifați confirmarea pentru a crea tichetul demo.", ru: "Отметьте подтверждение, чтобы создать демо-заявку." }) });
      document.getElementById("rep-confirm")?.focus();
      return;
    }
    setBusy(true);
    setSubmitErr(null);
    const fd = new FormData();
    fd.append("description", d.description);
    fd.append("location", d.location);
    fd.append("category", d.category);
    fd.append("categorySuggested", d.categorySuggested);
    fd.append("descriptionSuggested", d.descriptionSuggested);
    fd.append("locationSource", d.locationSource);
    if (d.lat != null) fd.append("lat", String(d.lat));
    if (d.lng != null) fd.append("lng", String(d.lng));
    fd.append("lang", lang);
    fd.append("confirm", "yes");
    for (const f of files) fd.append("media", f);
    if (audio) fd.append("media", audio);
    try {
      const r = await fetch("/api/tickets", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.reason ?? j.error);
      localStorage.removeItem(DRAFT_KEY);
      router.push(`/tichet/${j.id}?nou=1`);
    } catch (e) {
      const reason = (e as Error).message;
      setSubmitErr(
        reason === "too_large"
          ? t({ ro: "Un fișier depășește 25 MB. Eliminați-l sau alegeți unul mai mic. Restul datelor au rămas salvate.", ru: "Файл больше 25 МБ. Удалите его или выберите меньший. Остальные данные сохранены." })
          : reason === "unsupported_type"
            ? t({ ro: "Un fișier are un format neacceptat. Eliminați-l și încercați din nou. Datele au rămas salvate.", ru: "У файла неподдерживаемый формат. Удалите его и попробуйте снова. Данные сохранены." })
            : t({ ro: "Tichetul nu a putut fi creat. Ciorna este păstrată pe acest dispozitiv — încercați din nou.", ru: "Не удалось создать заявку. Черновик сохранён на этом устройстве — попробуйте ещё раз." }),
      );
      setBusy(false);
    }
  };

  const stepLabels = [
    { ro: "Ce s-a întâmplat", ru: "Что случилось" },
    { ro: "Unde și ce tip", ru: "Где и какой тип" },
    { ro: "Verificare și confirmare", ru: "Проверка и подтверждение" },
  ];
  const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label[lang] ?? "—";
  const hasVideo = files.some((f) => f.type.startsWith("video/"));

  const extractVideo = async () => {
    const v = files.find((f) => f.type.startsWith("video/"));
    if (!v || vid?.busy) return;
    setVid({ busy: true, error: "", transcript: "", ai: false });
    const fd = new FormData();
    fd.append("file", v);
    fd.append("lang", lang);
    try {
      const r = await fetch("/api/report/video", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      const patch: Partial<Draft> = { locationSource: j.lat != null ? "device" : undefined };
      if (!d.description.trim()) patch.description = j.description;
      if (!d.category) patch.category = j.category;
      if (!d.location.trim()) patch.location = j.location;
      if (d.lat == null && j.lat != null) { patch.lat = j.lat; patch.lng = j.lng; }
      set(patch);
      setVid({ busy: false, error: "", transcript: j.transcript ?? "", ai: !!j.ai });
    } catch (e) {
      const code = (e as Error).message;
      const msg =
        code === "whisper_missing"
          ? t({ ro: "Transcrierea locală (whisper) nu este instalată pe acest calculator. Puteți scrie descrierea manual.", ru: "Локальное распознавание речи (whisper) не установлено на этом компьютере. Опишите проблему вручную." })
          : code === "no_audio"
            ? t({ ro: "Videoclipul nu are sunet. Adăugați descrierea manual.", ru: "В видео нет звука. Опишите проблему вручную." })
            : t({ ro: "Analiza videoclipului nu a reușit. Scrieți descrierea manual.", ru: "Не удалось проанализировать видео. Опишите проблему вручную." });
      setVid({ busy: false, error: msg, transcript: "", ai: false });
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t({ ro: "Raportează o problemă în oraș", ru: "Сообщить о проблеме в городе" })}</h1>
        <p className="text-muted">{t({ ro: "Trei pași scurți. Nu vă cerem numele sau telefonul.", ru: "Три коротких шага. Мы не спрашиваем имя или телефон." })}</p>
      </header>

      <Notice tone="demo" title={t({ ro: "Tichet DEMO — nu se trimite Primăriei", ru: "DEMO-заявка — в Примэрию не отправляется" })}>
        {t({ ro: "Prototipul salvează sesizarea doar local. Pentru o sesizare reală folosiți portalul oficial „Sesizează” de pe chisinau.md.", ru: "Прототип сохраняет обращение только локально. Для реального обращения используйте официальный портал «Sesizează» на chisinau.md." })}{" "}
        <a href="https://www.chisinau.md/ro" target="_blank" rel="noopener noreferrer" className="link">chisinau.md ↗</a>
      </Notice>

      {restored && step === 1 && (
        <Notice tone="info">
          {t({ ro: "Am restabilit ciorna salvată pe acest dispozitiv. ", ru: "Восстановлен черновик, сохранённый на этом устройстве. " })}
          <button type="button" className="link" onClick={() => { setD(EMPTY); setRestored(false); }}>{t({ ro: "Începeți de la zero", ru: "Начать заново" })}</button>
        </Notice>
      )}

      <ol className="grid grid-cols-3 gap-1 text-xs sm:text-sm" aria-label={t({ ro: "Progres", ru: "Прогресс" })}>
        {stepLabels.map((l, i) => {
          const n = (i + 1) as Step;
          const state = n < step ? "done" : n === step ? "current" : "todo";
          return (
            <li key={i} aria-current={state === "current" ? "step" : undefined} className={`rounded-lg border-b-4 bg-white px-2 py-2 font-semibold ${state === "current" ? "border-brand text-brand-dark" : state === "done" ? "border-ok text-ok" : "border-line text-muted"}`}>
              <span aria-hidden="true">{state === "done" ? "✓ " : `${n}. `}</span>
              <span className="sr-only">{t({ ro: "Pasul", ru: "Шаг" })} {n}{state === "done" ? t({ ro: " (finalizat)", ru: " (готово)" }) : ""}: </span>
              {l[lang]}
            </li>
          );
        })}
      </ol>

      <section className="card space-y-4 p-4 sm:p-5" aria-labelledby="step-h">
        <h2 id="step-h" ref={headRef} tabIndex={-1} className="text-xl font-bold">
          {t({ ro: "Pasul", ru: "Шаг" })} {step} {t({ ro: "din", ru: "из" })} 3: {stepLabels[step - 1][lang]}
        </h2>

        {step === 1 && (
          <>
            <div>
              <label htmlFor="rep-text" className="field-label">{t({ ro: "Descrieți pe scurt problema", ru: "Кратко опишите проблему" })}</label>
              <span id="rep-text-hint" className="field-hint">{t({ ro: "De exemplu: „Groapă mare pe trotuar lângă stația de autobuz”.", ru: "Например: «Большая яма на тротуаре у остановки»." })}</span>
              <textarea id="rep-text" rows={3} maxLength={1000} value={d.text} onChange={(e) => set({ text: e.target.value })} aria-describedby={`rep-text-hint${errors.text ? " rep-text-err" : ""}`} aria-invalid={!!errors.text || undefined} className="input text-lg" />
              {errors.text && <p id="rep-text-err" role="alert" className="mt-1 font-semibold text-bad">⚠ {errors.text}</p>}
            </div>

            <div>
              <label htmlFor="rep-media" className="field-label">{t({ ro: "Fotografie sau video (opțional)", ru: "Фото или видео (необязательно)" })}</label>
              <span id="rep-media-hint" className="field-hint">{t({ ro: "JPG, PNG, WEBP, MP4, MOV — maximum 25 MB fiecare. Evitați fețele și numerele de înmatriculare.", ru: "JPG, PNG, WEBP, MP4, MOV — до 25 МБ каждый. Избегайте лиц и номеров машин." })}</span>
              <input id="rep-media" type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" aria-describedby="rep-media-hint" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 3))} className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-brand file:bg-white file:px-4 file:font-semibold file:text-brand" />
              {files.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 rounded border border-line bg-paper p-1 pr-2 text-sm">
                      {f.type.startsWith("image/") ? <img src={URL.createObjectURL(f)} alt="" className="h-12 w-12 rounded object-cover" /> : <span aria-hidden="true" className="grid h-12 w-12 place-items-center">🎞</span>}
                      <span className="max-w-40 truncate">{f.name}</span>
                      <button type="button" className="btn-quiet rounded px-1" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`${t({ ro: "Elimină", ru: "Удалить" })} ${f.name}`}>✕</button>
                    </li>
                  ))}
                </ul>
              )}

              {hasVideo && !vid?.busy && (
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="btn btn-secondary min-h-10 text-sm" onClick={extractVideo}>
                    <span aria-hidden="true">🤖</span> {t({ ro: "Extrage locația + descrierea din videoclip", ru: "Извлечь место и описание из видео" })}
                  </button>
                  <span className="text-xs text-muted">{t({ ro: "Transcrierea rulează local (whisper); rezumatul poate folosi modelul AI configurat, altfel reguli de cuvinte cheie. Verificați tot ce se completează.", ru: "Распознавание речи выполняется локально (whisper); сводку может составить настроенная ИИ-модель или правила ключевых слов. Проверяйте заполненное." })}</span>
                </div>
              )}
              {vid?.busy && <p className="text-sm text-muted">⏳ {t({ ro: "Se analizează videoclipul: audio, transcriere, rezumat…", ru: "Анализ видео: аудио, распознавание, сводка…" })}</p>}
              {vid?.error && <p role="alert" className="text-sm font-semibold text-bad">⚠ {vid.error}</p>}
              {vid?.transcript && (
                <details className="rounded-lg border border-line bg-paper p-2 text-sm">
                  <summary className="cursor-pointer font-semibold">{t({ ro: "Transcrierea audio", ru: "Расшифровка аудио" })}{vid.ai ? t({ ro: " · rezumat cu AI", ru: " · сводка с ИИ" }) : ""}</summary>
                  <p className="mt-1 whitespace-pre-wrap text-muted">{vid.transcript}</p>
                </details>
              )}
            </div>

            <VoiceRecorder audio={audio} setAudio={setAudio} />

            <div className="flex justify-end">
              <button type="button" className="btn btn-primary min-w-40" onClick={goStep2}>{t({ ro: "Continuă", ru: "Далее" })} →</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <label htmlFor="rep-loc" className="field-label">{t({ ro: "Unde este problema?", ru: "Где проблема?" })}</label>
              <span id="rep-loc-hint" className="field-hint">{t({ ro: "Stradă și număr, intersecție sau reper. Puteți folosi și locația dispozitivului — o vedeți și o confirmați înainte de trimitere.", ru: "Улица и номер, перекрёсток или ориентир. Можно использовать геолокацию — вы увидите и подтвердите её перед отправкой." })}</span>
              <input id="rep-loc" value={d.location} maxLength={300} onChange={(e) => set({ location: e.target.value, locationSource: d.lat ? d.locationSource : "manual" })} aria-describedby={`rep-loc-hint${errors.location ? " rep-loc-err" : ""}`} aria-invalid={!!errors.location || undefined} className="input" autoComplete="street-address" />
              {errors.location && <p id="rep-loc-err" role="alert" className="mt-1 font-semibold text-bad">⚠ {errors.location}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" className="btn btn-secondary min-h-10 text-sm" onClick={locate} disabled={geoState === "asking"}>
                  <span aria-hidden="true">⌖</span> {geoState === "asking" ? t({ ro: "Se determină…", ru: "Определяется…" }) : t({ ro: "Propune locația mea", ru: "Предложить моё местоположение" })}
                </button>
                <p aria-live="polite" className="text-sm">
                  {geoState === "ok" && d.lat != null && (
                    <span className="text-ok">✓ {t({ ro: "Coordonate propuse:", ru: "Предложенные координаты:" })} {d.lat}, {d.lng} — {t({ ro: "verificați și adăugați strada în câmp.", ru: "проверьте и добавьте улицу в поле." })}{" "}
                      <button type="button" className="link" onClick={() => { set({ lat: undefined, lng: undefined, locationSource: "manual" }); setGeoState("idle"); }}>{t({ ro: "Nu folosi coordonatele", ru: "Не использовать координаты" })}</button>
                    </span>
                  )}
                  {geoState === "denied" && <span className="text-warn">{t({ ro: "Locația nu este disponibilă. Scrieți adresa manual.", ru: "Геолокация недоступна. Введите адрес вручную." })}</span>}
                </p>
              </div>
            </div>

            <fieldset aria-describedby={errors.category ? "cat-err" : "cat-hint"}>
              <legend id="cat-legend" tabIndex={-1} className="field-label">{t({ ro: "Categoria", ru: "Категория" })}</legend>
              <span id="cat-hint" className="field-hint">
                {d.categorySuggested
                  ? t({ ro: `Sugestie automată după cuvintele din descriere: „${catLabel(d.categorySuggested)}”. Verificați și schimbați dacă e greșit.`, ru: `Автоматическая подсказка по словам описания: «${catLabel(d.categorySuggested)}». Проверьте и измените при ошибке.` })
                  : t({ ro: "Nu am putut propune o categorie — alegeți una.", ru: "Не удалось предложить категорию — выберите сами." })}{" "}
                {t({ ro: "Categoriile sunt ale prototipului, nu departamente oficiale.", ru: "Категории — прототипа, а не официальные отделы." })}
              </span>
              <div className="grid gap-2 sm:grid-cols-2">
                {CATEGORIES.map((c) => (
                  <label key={c.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-2.5 ${d.category === c.id ? "border-brand bg-brand-soft" : "border-line"}`}>
                    <input type="radio" name="cat" value={c.id} checked={d.category === c.id} onChange={() => set({ category: c.id })} className="h-5 w-5" />
                    <span aria-hidden="true">{c.icon}</span>
                    <span className="font-medium">{c.label[lang]}</span>
                    {d.categorySuggested === c.id && <span className="ml-auto rounded bg-white px-1.5 text-xs text-brand">{t({ ro: "sugerat", ru: "предложено" })}</span>}
                  </label>
                ))}
              </div>
              {errors.category && <p id="cat-err" role="alert" className="mt-1 font-semibold text-bad">⚠ {errors.category}</p>}
            </fieldset>

            <div>
              <label htmlFor="rep-desc" className="field-label">{t({ ro: "Descrierea care va fi salvată", ru: "Описание, которое будет сохранено" })}</label>
              <span id="rep-desc-hint" className="field-hint">{t({ ro: "Am ordonat textul dvs. fără să adăugăm informații. Corectați dacă e nevoie.", ru: "Мы упорядочили ваш текст, ничего не добавляя. Исправьте при необходимости." })}</span>
              <textarea id="rep-desc" rows={3} maxLength={1000} value={d.description} onChange={(e) => set({ description: e.target.value })} aria-describedby={`rep-desc-hint${errors.description ? " rep-desc-err" : ""}`} aria-invalid={!!errors.description || undefined} className="input" />
              {errors.description && <p id="rep-desc-err" role="alert" className="mt-1 font-semibold text-bad">⚠ {errors.description}</p>}
            </div>

            <div className="flex justify-between gap-2">
              <button type="button" className="btn btn-quiet" onClick={() => setStep(1)}>← {t({ ro: "Înapoi", ru: "Назад" })}</button>
              <button type="button" className="btn btn-primary min-w-40" onClick={goStep3}>{t({ ro: "Verifică", ru: "Проверить" })} →</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <dl className="divide-y divide-line rounded-lg border border-line">
              {[
                [t({ ro: "Categoria", ru: "Категория" }), catLabel(d.category) + (d.categorySuggested && d.categorySuggested !== d.category ? t({ ro: " (schimbată de dvs.)", ru: " (изменено вами)" }) : "")],
                [t({ ro: "Locul", ru: "Место" }), d.location + (d.lat != null ? ` · GPS ${d.lat}, ${d.lng}` : "")],
                [t({ ro: "Descrierea", ru: "Описание" }), d.description],
                [t({ ro: "Fișiere", ru: "Файлы" }), [...files.map((f) => f.name), ...(audio ? [t({ ro: "înregistrare vocală", ru: "голосовая запись" })] : [])].join(", ") || "—"],
                [t({ ro: "Date personale", ru: "Личные данные" }), t({ ro: "Niciuna (nume, telefon, e-mail nu sunt cerute)", ru: "Нет (имя, телефон, e-mail не запрашиваются)" })],
              ].map(([k, v]) => (
                <div key={k} className="grid gap-1 p-3 sm:grid-cols-[10rem_1fr]">
                  <dt className="font-semibold">{k}</dt>
                  <dd className="break-words">{v}</dd>
                </div>
              ))}
            </dl>
            <Notice tone="warn" title={t({ ro: "Ce se întâmplă cu datele", ru: "Что происходит с данными" })}>
              <p>{localDemoAdapter.destination[lang]}</p>
              <p className="mt-1">{t({ ro: "Niciun serviciu extern (AI, stocare, hărți) nu primește textul, fotografiile sau înregistrarea. Puteți șterge tichetul oricând de pe pagina lui.", ru: "Никакой внешний сервис (ИИ, хранилище, карты) не получает текст, фото или запись. Заявку можно удалить в любой момент на её странице." })}</p>
            </Notice>
            <div>
              <label className="flex min-h-11 items-start gap-3">
                <input id="rep-confirm" type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} aria-invalid={!!errors.confirm || undefined} aria-describedby={errors.confirm ? "rep-confirm-err" : undefined} className="mt-1 h-5 w-5" />
                <span>{t({ ro: "Am verificat detaliile și înțeleg că este un tichet DEMO, salvat local, care NU ajunge la Primărie.", ru: "Я проверил(а) данные и понимаю, что это DEMO-заявка, сохранённая локально, которая НЕ попадает в Примэрию." })}</span>
              </label>
              {errors.confirm && <p id="rep-confirm-err" role="alert" className="mt-1 font-semibold text-bad">⚠ {errors.confirm}</p>}
            </div>
            {submitErr && <p role="alert" className="font-semibold text-bad">⚠ {submitErr}</p>}
            <div className="flex justify-between gap-2">
              <button type="button" className="btn btn-quiet" onClick={() => setStep(2)}>← {t({ ro: "Modifică", ru: "Изменить" })}</button>
              <button type="button" className="btn btn-primary min-w-48" onClick={submit} disabled={busy}>
                {busy ? t({ ro: "Se creează…", ru: "Создаётся…" }) : t({ ro: "Creează tichetul demo", ru: "Создать демо-заявку" })}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function VoiceRecorder({ audio, setAudio }: { audio: File | null; setAudio: (f: File | null) => void }) {
  const { t } = useLang();
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const type = (mr.mimeType || "audio/webm").split(";")[0];
        setAudio(new File(chunks, `voce.${type.split("/")[1]}`, { type }));
        if (timer.current) clearInterval(timer.current);
      };
      mr.start();
      setRec(mr);
      setSecs(0);
      timer.current = setInterval(() => setSecs((s) => (s >= 119 ? (mr.stop(), setRec(null), 120) : s + 1)), 1000);
    } catch {
      setErr(t({ ro: "Microfonul nu este disponibil sau accesul a fost refuzat. Puteți încărca un fișier audio sau scrie textul.", ru: "Микрофон недоступен или доступ запрещён. Можно загрузить аудиофайл или написать текст." }));
    }
  };

  return (
    <div>
      <p className="field-label" id="voice-l">{t({ ro: "Mesaj vocal (opțional)", ru: "Голосовое сообщение (необязательно)" })}</p>
      <span className="field-hint">{t({ ro: "Înregistrarea este atașată tichetului local. Nu este transcrisă automat în acest prototip — scrieți și câteva cuvinte mai sus.", ru: "Запись прикрепляется к локальной заявке. В этом прототипе она не расшифровывается автоматически — напишите пару слов выше." })}</span>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby="voice-l">
        {!rec ? (
          <button type="button" className="btn btn-secondary min-h-10 text-sm" onClick={start}>
            <span aria-hidden="true">●</span> {audio ? t({ ro: "Înregistrează din nou", ru: "Записать заново" }) : t({ ro: "Înregistrează", ru: "Записать" })}
          </button>
        ) : (
          <button type="button" className="btn min-h-10 bg-bad text-sm text-white" onClick={() => { rec.stop(); setRec(null); }}>
            <span aria-hidden="true">■</span> {t({ ro: "Oprește", ru: "Стоп" })} ({secs}s)
          </button>
        )}
        <label className="btn btn-quiet min-h-10 cursor-pointer text-sm">
          {t({ ro: "sau încarcă audio", ru: "или загрузить аудио" })}
          <input type="file" accept="audio/*" className="sr-only" onChange={(e) => setAudio(e.target.files?.[0] ?? null)} />
        </label>
        <span aria-live="polite" className="sr-only">{rec ? t({ ro: "Înregistrare pornită", ru: "Запись идёт" }) : audio ? t({ ro: "Înregistrare atașată", ru: "Запись прикреплена" }) : ""}</span>
      </div>
      {audio && !rec && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <audio controls src={URL.createObjectURL(audio)} className="h-10 max-w-full" />
          <button type="button" className="btn btn-quiet min-h-9 text-sm" onClick={() => setAudio(null)}>{t({ ro: "Elimină", ru: "Удалить" })}</button>
        </div>
      )}
      {err && <p role="alert" className="mt-1 text-sm text-bad">⚠ {err}</p>}
    </div>
  );
}

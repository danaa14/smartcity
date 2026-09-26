"use client";

import { useMemo, useRef, useState } from "react";
import { useLang } from "../LangProvider";
import { Notice } from "../ui";
import { BlurredPage, findLoose, Highlighted, MARK, ProgressBar, SEV } from "./parts";
import type { L10n } from "@/lib/i18n";
import { recognize, type OcrPage } from "@/lib/scan/browserOcr";
import { detectModel, detectRules, leftoverIdentifiers, mergeSpans, PLACEHOLDER, redactText, type PiiSpan, type PiiType } from "@/lib/scan/pii";
import type { DocReview } from "@/lib/scan/review";

type Stage = "pick" | "ocr" | "redact" | "sending" | "result";

const GOALS: L10n[] = [
  { ro: "Vând ceva — are contractul toate datele necesare?", ru: "Я продаю — есть ли в договоре все нужные данные?" },
  { ro: "Cumpăr ceva — sunt termenii corecți pentru mine?", ru: "Я покупаю — выгодны ли мне условия?" },
  { ro: "Semnez termeni și condiții — ce riscuri am?", ru: "Подписываю условия — какие риски?" },
  { ro: "Închiriez — verificați contractul de chirie", ru: "Аренда — проверьте договор аренды" },
];

export function AssistantScan() {
  const { lang, t } = useLang();
  const [stage, setStage] = useState<Stage>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [goal, setGoal] = useState("");
  const [pages, setPages] = useState<OcrPage[]>([]);
  const [text, setText] = useState("");
  const [spans, setSpans] = useState<PiiSpan[]>([]);
  const [progress, setProgress] = useState<{ label: L10n; pct: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [review, setReview] = useState<DocReview | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [editText, setEditText] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);

  const redacted = useMemo(() => redactText(text, spans), [text, spans]);
  const leftovers = useMemo(() => leftoverIdentifiers(redacted), [redacted]);

  const runDetection = async (t0: string) => {
    const rules = detectRules(t0);
    const mine = spans.filter((s) => s.source === "user" && t0.slice(s.start, s.end) === s.text);
    setSpans(mergeSpans([...rules, ...mine], t0));
    setProgress({ label: { ro: "Încarc modelul local de protecție a datelor…", ru: "Загружаю локальную модель защиты данных…" }, pct: 0 });
    try {
      const model = await detectModel(t0, (p) => setProgress({ label: { ro: "Descarc modelul local (~280 MB, o singură dată, apoi rămâne în browser)…", ru: "Скачиваю локальную модель (~280 МБ, один раз, затем она остаётся в браузере)…" }, pct: p }));
      setSpans((cur) => mergeSpans([...rules, ...model, ...cur.filter((s) => s.source === "user")], t0));
    } catch (e) {
      console.error("local PII model failed:", e);
      setErr(t({ ro: "Modelul local nu a putut porni pe acest dispozitiv. Au fost aplicate doar regulile automate — verificați cu atenție și marcați manual numele.", ru: "Локальная модель не запустилась на этом устройстве. Применены только автоматические правила — проверьте внимательно и отметьте имена вручную." }));
    }
    setProgress(null);
  };

  const start = async () => {
    if (!file) {
      setErr(t({ ro: "Alegeți o fotografie sau un PDF.", ru: "Выберите фото или PDF." }));
      inputRef.current?.focus();
      return;
    }
    setErr(null);
    setStage("ocr");
    try {
      const res = await recognize(file, (stage, pct, page, total) =>
        setProgress({
          label: stage === "load" ? { ro: "Pregătesc recunoașterea textului (RO + RU)…", ru: "Готовлю распознавание текста (RO + RU)…" } : stage === "render" ? { ro: `Pregătesc pagina ${page ?? 1}/${total ?? 1}…`, ru: `Готовлю страницу ${page ?? 1}/${total ?? 1}…` } : { ro: "Citesc textul…", ru: "Читаю текст…" },
          pct,
        }),
      );
      const full = res.map((p) => p.text.trim()).join("\n\n— — —\n\n");
      if (full.replace(/\s/g, "").length < 20) throw new Error("empty");
      setPages(res);
      setText(full);
      setStage("redact");
      requestAnimationFrame(() => headRef.current?.focus());
      await runDetection(full);
    } catch (e) {
      setStage("pick");
      setProgress(null);
      setErr((e as Error).message === "empty" ? t({ ro: "Nu am găsit text în imagine. Încercați o fotografie mai clară, dreaptă și bine luminată.", ru: "В изображении не найден текст. Попробуйте более чёткое, ровное и хорошо освещённое фото." }) : t({ ro: "Recunoașterea a eșuat pe acest dispozitiv. Încercați din nou sau alt fișier.", ru: "Распознавание не удалось на этом устройстве. Попробуйте ещё раз или другой файл." }));
    }
  };

  const toggle = (id: string) => setSpans((s) => s.map((x) => (x.id === id ? { ...x, redact: !x.redact } : x)));
  const addSelection = (type: PiiType) => {
    const el = document.getElementById("doc-text");
    const sel = window.getSelection();
    if (!el || !sel || sel.isCollapsed || !el.contains(sel.anchorNode)) {
      setErr(t({ ro: "Selectați mai întâi textul din document pe care vreți să-l ascundeți.", ru: "Сначала выделите в документе текст, который нужно скрыть." }));
      return;
    }
    const chosen = sel.toString().trim();
    if (chosen.length < 2) return;
    setErr(null);
    const next: PiiSpan[] = [];
    let from = 0;
    for (;;) {
      const i = text.indexOf(chosen, from);
      if (i < 0) break;
      next.push({ id: `u${i}`, start: i, end: i + chosen.length, text: chosen, type, source: "user", score: 1, redact: true });
      from = i + chosen.length;
    }
    setSpans((s) => mergeSpans([...s, ...next], text));
    sel.removeAllRanges();
  };

  const send = async () => {
    if (!confirmed || leftovers.length) return;
    setStage("sending");
    setErr(null);
    try {
      const r = await fetch("/api/scan/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: redacted, goal, confirmed: true }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setReview(j);
      setStage("result");
      requestAnimationFrame(() => headRef.current?.focus());
    } catch (e) {
      const code = (e as Error).message;
      setStage("redact");
      setErr(
        code === "pii_leak" ? t({ ro: "Serverul a refuzat textul: încă conține un identificator personal. Verificați lista.", ru: "Сервер отклонил текст: в нём ещё есть личный идентификатор. Проверьте список." })
        : code === "training_not_allowed" ? t({ ro: "Muse Spark nu este activat în contul OpenCode (setarea de confidențialitate). Nimic nu a fost trimis mai departe.", ru: "Muse Spark не включён в аккаунте OpenCode (настройка конфиденциальности). Дальше ничего не отправлено." })
        : code === "timeout" ? t({ ro: "Modelul nu a răspuns la timp. Încercați din nou.", ru: "Модель не ответила вовремя. Попробуйте ещё раз." })
        : t({ ro: "Analiza nu a reușit. Textul redactat este încă aici — încercați din nou.", ru: "Анализ не удался. Редактированный текст остался здесь — попробуйте ещё раз." }),
      );
    }
  };

  const reset = () => {
    setStage("pick"); setFile(null); setPages([]); setText(""); setSpans([]); setReview(null); setConfirmed(false); setErr(null); setFocus(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const active = spans.filter((s) => s.redact);
  const steps: { id: Stage[]; label: L10n }[] = [
    { id: ["pick", "ocr"], label: { ro: "Citire locală", ru: "Локальное чтение" } },
    { id: ["redact"], label: { ro: "Ascunderea datelor personale", ru: "Скрытие личных данных" } },
    { id: ["sending", "result"], label: { ro: "Analiza asistentului", ru: "Анализ помощника" } },
  ];
  const stepIdx = steps.findIndex((s) => s.id.includes(stage));

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t({ ro: "Asistentul pentru documente", ru: "Помощник по документам" })}</h1>
        <p className="max-w-3xl text-muted">{t({ ro: "Fotografiați un contract, o chitanță sau termeni și condiții. Textul se citește pe dispozitivul dvs., datele personale se ascund tot aici, iar asistentul verifică doar textul fără ele: ce lipsește, ce e riscant pentru dvs. și ce să cereți.", ru: "Сфотографируйте договор, квитанцию или условия. Текст читается на вашем устройстве, личные данные скрываются здесь же, а помощник проверяет только текст без них: чего не хватает, что для вас рискованно и что попросить изменить." })}</p>
      </header>

      <ol className="grid grid-cols-3 gap-1 text-xs sm:text-sm" aria-label={t({ ro: "Progres", ru: "Прогресс" })}>
        {steps.map((s, i) => (
          <li key={i} aria-current={i === stepIdx ? "step" : undefined} className={`rounded-lg border-b-4 bg-white px-2 py-2 font-semibold transition-colors ${i < stepIdx ? "border-ok text-ok" : i === stepIdx ? "border-brand text-brand-dark" : "border-line text-muted"}`}>
            <span aria-hidden="true">{i < stepIdx ? "✓ " : `${i + 1}. `}</span>{t(s.label)}
          </li>
        ))}
      </ol>

      <p aria-live="polite" className="sr-only">{progress ? t(progress.label) : ""}</p>
      {err && <p role="alert" className="rounded-lg border-l-4 border-bad bg-bad-soft p-3 font-semibold text-bad">⚠ {err}</p>}

      {(stage === "pick" || stage === "ocr") && (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="card space-y-4 p-4 sm:p-5">
            <div>
              <label htmlFor="as-file" className="field-label">{t({ ro: "Documentul", ru: "Документ" })}</label>
              <span id="as-file-hint" className="field-hint">{t({ ro: "Fotografie (JPG, PNG, WEBP) sau PDF (primele 5 pagini). Pe telefon puteți fotografia direct.", ru: "Фото (JPG, PNG, WEBP) или PDF (первые 5 страниц). На телефоне можно сфотографировать сразу." })}</span>
              <input ref={inputRef} id="as-file" type="file" accept="image/*,application/pdf" aria-describedby="as-file-hint" disabled={stage === "ocr"} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setErr(null); }} className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-brand file:bg-white file:px-4 file:font-semibold file:text-brand" />
            </div>
            <fieldset>
              <legend className="field-label">{t({ ro: "Ce vreți să verific? (opțional)", ru: "Что проверить? (необязательно)" })}</legend>
              <div className="flex flex-wrap gap-2">
                {GOALS.map((g) => (
                  <button key={g.ro} type="button" aria-pressed={goal === g[lang]} onClick={() => setGoal(goal === g[lang] ? "" : g[lang])} className={`pf-chip rounded-full border px-3 py-1.5 text-sm ${goal === g[lang] ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand"}`}>{g[lang]}</button>
                ))}
              </div>
              <label htmlFor="as-goal" className="sr-only">{t({ ro: "Scopul dvs.", ru: "Ваша цель" })}</label>
              <input id="as-goal" value={goal} maxLength={300} onChange={(e) => setGoal(e.target.value)} placeholder={t({ ro: "sau scrieți: „Vând apartamentul, sunt corecte clauzele de plată?”", ru: "или напишите: «Продаю квартиру, правильны ли условия оплаты?»" })} className="input mt-2" />
              <p className="mt-1 text-xs text-muted">{t({ ro: "Nu scrieți date personale aici — acest câmp se trimite asistentului.", ru: "Не пишите сюда личные данные — это поле отправляется помощнику." })}</p>
            </fieldset>
            <button type="button" onClick={start} disabled={stage === "ocr"} className="btn btn-primary w-full text-lg">
              {stage === "ocr" ? t({ ro: "Citesc documentul…", ru: "Читаю документ…" }) : t({ ro: "Citește documentul pe acest dispozitiv", ru: "Прочитать документ на этом устройстве" })}
            </button>
            {progress && <ProgressBar label={t(progress.label)} pct={progress.pct} />}
          </section>
          <aside className="space-y-3">
            <Notice tone="ok" title={t({ ro: "Ce rămâne pe dispozitiv", ru: "Что остаётся на устройстве" })}>
              {t({ ro: "Imaginea, textul complet și datele personale nu părăsesc browserul. Recunoașterea (Tesseract) și detectarea datelor personale (model multilingv) rulează local, inclusiv pe telefon. Modelul (~280 MB) se descarcă o singură dată de pe Hugging Face — fără niciun conținut din document.", ru: "Изображение, полный текст и личные данные не покидают браузер. Распознавание (Tesseract) и поиск личных данных (многоязычная модель) работают локально, в том числе на телефоне. Модель (~280 МБ) скачивается один раз с Hugging Face — без какого-либо содержимого документа." })}
            </Notice>
            <div className="card space-y-2 p-3">
              <p className="text-sm font-semibold">{t({ ro: "Nu aveți un document la îndemână?", ru: "Нет документа под рукой?" })}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/samples/contract-exemplu.jpg" alt={t({ ro: "Exemplu: contract fictiv de vânzare a unei mașini", ru: "Пример: вымышленный договор продажи автомобиля" })} className="max-h-40 w-full rounded border border-line object-cover object-top" />
              <button
                type="button"
                disabled={stage === "ocr"}
                className="btn btn-secondary w-full text-sm"
                onClick={async () => {
                  const blob = await (await fetch("/samples/contract-exemplu.jpg")).blob();
                  setFile(new File([blob], "contract-exemplu.jpg", { type: "image/jpeg" }));
                  setGoal(GOALS[0][lang]);
                  setErr(null);
                }}
              >
                {t({ ro: "Folosește contractul-exemplu (date fictive)", ru: "Взять пример договора (вымышленные данные)" })}
              </button>
              {file?.name === "contract-exemplu.jpg" && <p className="text-xs text-ok">✓ {t({ ro: "Exemplu ales — apăsați „Citește documentul”.", ru: "Пример выбран — нажмите «Прочитать документ»." })}</p>}
            </div>
            <Notice tone="warn" title={t({ ro: "Ce se trimite", ru: "Что отправляется" })}>
              {t({ ro: "Doar textul cu datele personale înlocuite, și doar după ce îl verificați și confirmați. Îl analizează modelul Muse Spark prin OpenCode.", ru: "Только текст с заменёнными личными данными и только после вашей проверки и подтверждения. Его анализирует модель Muse Spark через OpenCode." })}
            </Notice>
          </aside>
        </div>
      )}

      {(stage === "redact" || stage === "sending") && (
        <section aria-labelledby="red-h" className="space-y-4">
          <h2 id="red-h" ref={headRef} tabIndex={-1} className="text-xl font-bold">{t({ ro: "Verificați ce se ascunde înainte de trimitere", ru: "Проверьте, что скрыто, перед отправкой" })}</h2>
          {progress && <ProgressBar label={t(progress.label)} pct={progress.pct} />}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card space-y-2 p-3">
              <h3 className="font-bold">{t({ ro: "Documentul, cu datele personale estompate", ru: "Документ с размытыми личными данными" })}</h3>
              {pages.map((p, i) => <BlurredPage key={i} page={p} spans={active} pageIndex={i} pages={pages} />)}
              <p className="text-xs text-muted">{t({ ro: "Imaginea nu se trimite niciodată; estomparea vă arată ce a fost găsit.", ru: "Изображение никогда не отправляется; размытие показывает, что найдено." })}</p>
            </div>
            <div className="space-y-3">
              <div className="card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold">{t({ ro: "Date personale găsite", ru: "Найденные личные данные" })} ({active.length}/{spans.length})</h3>
                  <button type="button" className="btn btn-quiet min-h-9 text-sm" onClick={() => setSpans((s) => s.map((x) => ({ ...x, redact: true })))}>{t({ ro: "Ascunde tot", ru: "Скрыть всё" })}</button>
                </div>
                <p className="text-sm text-muted">{t({ ro: "Debifați doar ce nu este dată personală (de ex. numele unei firme publice).", ru: "Снимайте отметку только с того, что не является личными данными (напр. название публичной компании)." })}</p>
                <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                  {spans.map((s) => (
                    <li key={s.id}>
                      <label className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-2 py-1 text-sm transition-colors ${s.redact ? "border-ok bg-ok-soft" : "border-warn bg-warn-soft"}`}>
                        <input type="checkbox" checked={s.redact} onChange={() => toggle(s.id)} className="h-4 w-4" />
                        <span className="rounded bg-white px-1.5 text-xs font-bold">{PLACEHOLDER[s.type][lang]}</span>
                        <span className={s.redact ? "blur-[3px] hover:blur-0 focus-within:blur-0" : ""}>{s.text}</span>
                        <span className="ml-auto text-xs text-muted">{s.source === "rule" ? t({ ro: "regulă", ru: "правило" }) : s.source === "model" ? `${t({ ro: "model", ru: "модель" })} ${Math.round(s.score * 100)}%` : t({ ro: "manual", ru: "вручную" })}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card space-y-2 p-3">
                <h3 className="font-bold">{t({ ro: "Ați găsit ceva ce am ratat?", ru: "Нашли то, что мы пропустили?" })}</h3>
                <p className="text-sm text-muted">{t({ ro: "Selectați textul în documentul de mai jos, apoi alegeți tipul.", ru: "Выделите текст в документе ниже и выберите тип." })}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(["name", "address", "phone", "id_doc", "other"] as PiiType[]).map((ty) => (
                    <button key={ty} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => addSelection(ty)} className="pf-chip rounded-full border border-line bg-white px-2.5 py-1 text-xs font-semibold hover:border-brand">+ {PLACEHOLDER[ty][lang]}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card space-y-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold">{t({ ro: "Textul recunoscut", ru: "Распознанный текст" })}</h3>
              <button type="button" className="btn btn-secondary min-h-9 text-sm" onClick={() => setEditText((x) => !x)}>{editText ? t({ ro: "Gata", ru: "Готово" }) : t({ ro: "Corectează textul", ru: "Исправить текст" })}</button>
            </div>
            {editText ? (
              <>
                <label htmlFor="as-edit" className="sr-only">{t({ ro: "Corectați textul", ru: "Исправьте текст" })}</label>
                <textarea id="as-edit" className="input font-mono text-sm" rows={12} value={text} onChange={(e) => setText(e.target.value)} onBlur={() => void runDetection(text)} />
              </>
            ) : (
              <div id="doc-text" lang="ro" className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded bg-paper p-3 text-sm leading-relaxed">
                <Highlighted text={text} ranges={active.map((s) => ({ start: s.start, end: s.end, cls: "rounded bg-ink text-transparent px-0.5", masked: true, label: PLACEHOLDER[s.type][lang] }))} />
              </div>
            )}
            <p className="text-xs text-muted">{t({ ro: "Încrederea medie a recunoașterii:", ru: "Средняя уверенность распознавания:" })} {Math.round(pages.reduce((a, p) => a + p.confidence, 0) / Math.max(1, pages.length))}%</p>
          </div>

          <div className="card space-y-3 border-2 border-brand p-4">
            <h3 className="font-bold">{t({ ro: "Exact acest text va fi trimis", ru: "Будет отправлен именно этот текст" })}</h3>
            <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded bg-paper p-3 text-xs">{redacted}</pre>
            {leftovers.length > 0 && (
              <p role="alert" className="font-semibold text-bad">⚠ {t({ ro: "Textul încă pare să conțină identificatori:", ru: "В тексте, похоже, ещё есть идентификаторы:" })} {leftovers.join(", ")}. {t({ ro: "Ascundeți-i înainte de trimitere.", ru: "Скройте их перед отправкой." })}</p>
            )}
            <label className="flex min-h-11 items-start gap-3">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 h-5 w-5" />
              <span>{t({ ro: "Am verificat: toate datele personale sunt ascunse. Sunt de acord să trimit doar acest text către Muse Spark (OpenCode) pentru analiză.", ru: "Я проверил(а): все личные данные скрыты. Согласен(на) отправить только этот текст в Muse Spark (OpenCode) для анализа." })}</span>
            </label>
            <div className="flex flex-wrap justify-between gap-2">
              <button type="button" className="btn btn-quiet" onClick={reset}>{t({ ro: "Renunță", ru: "Отмена" })}</button>
              <button type="button" className="btn btn-primary min-w-56" disabled={!confirmed || leftovers.length > 0 || stage === "sending" || !!progress} onClick={send}>
                {stage === "sending" ? <><span aria-hidden="true" className="pf-spin h-4 w-4 rounded-full border-2 border-white border-t-transparent" />{t({ ro: "Asistentul analizează…", ru: "Помощник анализирует…" })}</> : t({ ro: "Trimite spre analiză", ru: "Отправить на анализ" })}
              </button>
            </div>
          </div>
        </section>
      )}

      {stage === "result" && review && (
        <section aria-labelledby="res-h" className="space-y-4">
          <div className="card space-y-2 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold ${review.verdict === "high_risk" ? SEV.risk.cls : review.verdict === "needs_attention" ? SEV.warn.cls : SEV.ok.cls}`}>
                <span aria-hidden="true">{review.verdict === "high_risk" ? "⚠" : review.verdict === "needs_attention" ? "!" : "✓"}</span>
                {review.verdict === "high_risk" ? t({ ro: "Risc ridicat pentru dvs.", ru: "Высокий риск для вас" }) : review.verdict === "needs_attention" ? t({ ro: "Necesită atenție", ru: "Требует внимания" }) : t({ ro: "Pare complet", ru: "Выглядит полным" })}
              </span>
              <span className="text-sm text-muted">{t(review.docType)}{review.userRole && ` · ${t({ ro: "rolul dvs.:", ru: "ваша роль:" })} ${t(review.userRole)}`}</span>
            </div>
            <h2 id="res-h" ref={headRef} tabIndex={-1} className="text-lg font-bold">{t(review.summary)}</h2>
            <p className="text-xs text-muted">{t({ ro: "Analiză asistată de", ru: "Анализ выполнен" })} {review.model} · {t({ ro: "nu este consultanță juridică; pentru decizii importante consultați un jurist sau notar.", ru: "это не юридическая консультация; для важных решений обратитесь к юристу или нотариусу." })}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="card p-3 lg:sticky lg:top-4 lg:self-start">
              <h3 className="mb-2 font-bold">{t({ ro: "Documentul, cu evidențieri", ru: "Документ с выделениями" })}</h3>
              <div lang="ro" className="max-h-[70vh] overflow-y-auto whitespace-pre-wrap rounded bg-paper p-3 text-sm leading-relaxed">
                <Highlighted
                  text={redacted}
                  ranges={review.findings.flatMap((f) => {
                    if (!f.quote || !f.quoteVerified) return [];
                    const i = findLoose(redacted, f.quote);
                    return i ? [{ start: i[0], end: i[1], cls: `${MARK[f.severity]} rounded px-0.5 transition-all ${focus === f.id ? "ring-2 ring-[#f0a500]" : ""}`, id: `hl-${f.id}` }] : [];
                  })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold">{t({ ro: "Observații și sugestii", ru: "Замечания и советы" })}</h3>
              <ul className="space-y-2">
                {review.findings.map((f, i) => (
                  <li key={f.id} className="pf-bot-in" style={{ animationDelay: `${i * 70}ms` }}>
                    <button
                      type="button"
                      onClick={() => {
                        setFocus(f.id);
                        document.getElementById(`hl-${f.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      className={`w-full rounded-xl border-l-4 bg-white p-3 text-left shadow-sm transition hover:shadow ${SEV[f.severity].cls.split(" ")[0]} ${focus === f.id ? "ring-2 ring-[#f0a500]" : ""}`}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${SEV[f.severity].cls}`}><span aria-hidden="true">{SEV[f.severity].icon} </span>{t(SEV[f.severity].label)}</span>
                        <span className="font-bold">{t(f.title)}</span>
                      </span>
                      <span className="mt-1 block text-sm">{t(f.explanation)}</span>
                      {f.suggestion && <span className="mt-2 block rounded-lg bg-brand-soft p-2 text-sm"><span className="font-semibold">{t({ ro: "Sugestie: ", ru: "Совет: " })}</span>{t(f.suggestion)}</span>}
                      {f.quote && (
                        <span className="mt-2 block text-xs text-muted">
                          {f.quoteVerified ? <>„{f.quote.slice(0, 140)}{f.quote.length > 140 ? "…" : ""}” · <span className="font-semibold text-brand">{t({ ro: "vezi în document", ru: "показать в документе" })}</span></> : t({ ro: "Citatul propus de model nu a fost găsit exact în document — tratați cu prudență.", ru: "Цитата модели не найдена в документе дословно — относитесь с осторожностью." })}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>

              <div className="card p-3">
                <h3 className="font-bold">{t({ ro: "Lista elementelor esențiale", ru: "Список важных элементов" })}</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {review.checklist.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span aria-hidden="true" className={c.present ? "text-ok" : "text-bad"}>{c.present ? "✓" : "✗"}</span>
                      <span><span className="sr-only">{c.present ? t({ ro: "Prezent: ", ru: "Есть: " }) : t({ ro: "Lipsește: ", ru: "Нет: " })}</span>{t(c.item)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary" onClick={reset}>{t({ ro: "Alt document", ru: "Другой документ" })}</button>
            <button type="button" className="btn btn-quiet" onClick={() => { setStage("redact"); setReview(null); setConfirmed(false); }}>{t({ ro: "Înapoi la redactare", ru: "Назад к редактированию" })}</button>
          </div>
        </section>
      )}
    </div>
  );
}


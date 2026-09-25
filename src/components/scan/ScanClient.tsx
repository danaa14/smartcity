"use client";

import { useRef, useState } from "react";
import { useLang } from "../LangProvider";
import { DemoBadge, ExternalLink, Notice } from "../ui";
import { Highlight } from "../ask/AnswerView";
import type { OcrResult } from "@/lib/ocr/adapter";
import type { Analysis } from "@/lib/ocr/analyze";
import type { EvidenceItem } from "@/lib/ocr/evidence";

type Resp = { result: OcrResult; analysis: Analysis; evidence: Record<string, EvidenceItem>; sample: boolean; external: boolean };

const ERR = {
  no_file: { ro: "Alegeți un fișier.", ru: "Выберите файл." },
  unsupported_type: { ro: "Formatul nu este acceptat. Folosiți JPG, PNG, WEBP, TIFF sau PDF.", ru: "Формат не поддерживается. Используйте JPG, PNG, WEBP, TIFF или PDF." },
  too_large: { ro: "Fișierul depășește 10 MB. Încercați o fotografie mai mică.", ru: "Файл больше 10 МБ. Попробуйте фото меньшего размера." },
  ocr_unavailable: { ro: "Motorul OCR local (Tesseract) nu este instalat pe acest computer. Vedeți README pentru instalare.", ru: "Локальный OCR (Tesseract) не установлен на этом компьютере. См. README." },
  ocr_failed: { ro: "Recunoașterea textului a eșuat. Încercați altă imagine sau introduceți textul manual.", ru: "Распознавание не удалось. Попробуйте другое изображение или введите текст вручную." },
  network: { ro: "Conexiunea a eșuat. Fișierul nu a fost trimis nicăieri altundeva — încercați din nou.", ru: "Сбой соединения. Файл никуда больше не отправлялся — попробуйте снова." },
};

export function ScanClient() {
  const { lang, t } = useLang();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Resp | null>(null);
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState("");
  const [corrected, setCorrected] = useState(false);
  const [focusLines, setFocusLines] = useState<string[]>([]);
  const [announce, setAnnounce] = useState("");
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = async (fd: FormData) => {
    setBusy(true);
    setErr(null);
    setAnnounce(t({ ro: "Se recunoaște textul local…", ru: "Идёт локальное распознавание…" }));
    try {
      const r = await fetch("/api/ocr", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) {
        setErr(t(ERR[j.error as keyof typeof ERR] ?? ERR.ocr_failed));
        setAnnounce("");
        return;
      }
      setData(j);
      setEdited(j.result.text);
      setCorrected(false);
      setEditing(false);
      setAnnounce(t({ ro: `Text recunoscut. ${j.analysis.observations.length} observații, ${j.analysis.suggestions.length} sugestii.`, ru: `Текст распознан. ${j.analysis.observations.length} наблюдений, ${j.analysis.suggestions.length} подсказок.` }));
      requestAnimationFrame(() => resultsRef.current?.focus());
    } catch {
      setErr(t(ERR.network));
    } finally {
      setBusy(false);
    }
  };

  const reanalyze = async () => {
    setBusy(true);
    const r = await fetch("/api/ocr/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: edited }) }).catch(() => null);
    setBusy(false);
    if (!r?.ok || !data) {
      setErr(t(ERR.network));
      return;
    }
    const j = await r.json();
    setData({ ...data, analysis: j.analysis, evidence: j.evidence });
    setCorrected(true);
    setEditing(false);
    setAnnounce(t({ ro: "Analiza a fost refăcută pe textul corectat.", ru: "Анализ пересчитан по исправленному тексту." }));
  };

  const reset = () => {
    setData(null);
    setFile(null);
    setPreview(null);
    setErr(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const a = data?.analysis;
  const img = data?.result.previewPng ?? preview;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t({ ro: "Scanează un document", ru: "Сканировать документ" })}</h1>
        <p className="max-w-3xl text-muted">
          {t({ ro: "Încărcați o cerere completată. Vedeți textul recunoscut, câmpurile care par goale și ce spun sursele publicate despre anexe. Nu declarăm documentul valid sau invalid.", ru: "Загрузите заполненное заявление. Вы увидите распознанный текст, поля, которые выглядят пустыми, и что говорят опубликованные источники о приложениях. Мы не признаём документ действительным или недействительным." })}
        </p>
      </header>

      <Notice tone="ok" title={t({ ro: "Confidențialitate", ru: "Конфиденциальность" })}>
        {t({ ro: "Recunoașterea rulează local cu Tesseract, pe computerul care găzduiește prototipul. Fișierul este procesat într-un dosar temporar șters imediat; nu este trimis niciunui serviciu extern și nu este păstrat.", ru: "Распознавание выполняется локально (Tesseract) на компьютере, где запущен прототип. Файл обрабатывается во временной папке, которая сразу удаляется; он не отправляется во внешние сервисы и не сохраняется." })}
      </Notice>

      {!data && (
        <div className="grid gap-4 md:grid-cols-2">
          <form
            className="card space-y-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!file) {
                setErr(t(ERR.no_file));
                inputRef.current?.focus();
                return;
              }
              const fd = new FormData();
              fd.append("file", file);
              void run(fd);
            }}
            noValidate
          >
            <h2 className="font-bold">{t({ ro: "1. Documentul dvs.", ru: "1. Ваш документ" })}</h2>
            <div>
              <label htmlFor="doc" className="field-label">{t({ ro: "Fotografie sau PDF", ru: "Фото или PDF" })}</label>
              <span id="doc-hint" className="field-hint">{t({ ro: "JPG, PNG, WEBP, TIFF sau PDF (prima pagină), maximum 10 MB. Fotografiați drept, cu lumină bună.", ru: "JPG, PNG, WEBP, TIFF или PDF (первая страница), до 10 МБ. Снимайте ровно, при хорошем освещении." })}</span>
              <input
                ref={inputRef}
                id="doc"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/tiff,application/pdf"
                capture="environment"
                aria-describedby={`doc-hint${err ? " doc-err" : ""}`}
                aria-invalid={!!err || undefined}
                className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-brand file:bg-white file:px-4 file:font-semibold file:text-brand"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  setErr(null);
                  setPreview(f && f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
                }}
              />
            </div>
            {preview && <img src={preview} alt={t({ ro: "Previzualizarea fișierului ales", ru: "Предпросмотр выбранного файла" })} className="max-h-64 rounded border border-line object-contain" />}
            {file && !preview && <p className="text-sm">📄 {file.name}</p>}
            {err && <p id="doc-err" role="alert" className="font-semibold text-bad">⚠ {err}</p>}
            <button className="btn btn-primary w-full" disabled={busy}>
              {busy ? t({ ro: "Se recunoaște…", ru: "Распознаётся…" }) : t({ ro: "Recunoaște textul", ru: "Распознать текст" })}
            </button>
          </form>

          <div className="card space-y-3 p-4">
            <h2 className="font-bold">{t({ ro: "Sau încercați exemplul", ru: "Или попробуйте пример" })}</h2>
            <div className="flex flex-wrap gap-1.5"><DemoBadge lang={lang} /></div>
            <p className="text-sm">
              {t({ ro: "Formularul real AGSV „Cerere pentru examinare fitosanitară a arborilor”, completat parțial cu date FICTIVE. OCR-ul rulează efectiv pe imagine — nu este text pregătit dinainte.", ru: "Реальная форма AGSV «Заявление на фитосанитарное обследование деревьев», частично заполненная ВЫМЫШЛЕННЫМИ данными. OCR действительно выполняется на изображении — текст не заготовлен." })}
            </p>
            <img src="/samples/agsv-cerere-exemplu.png" alt={t({ ro: "Exemplu: cerere AGSV completată parțial cu date fictive", ru: "Пример: заявление AGSV, частично заполненное вымышленными данными" })} className="max-h-64 w-full rounded border border-line object-contain object-top" />
            <button
              type="button"
              className="btn btn-secondary w-full"
              disabled={busy}
              onClick={() => {
                const fd = new FormData();
                fd.append("sample", "agsv");
                void run(fd);
              }}
            >
              {busy ? t({ ro: "Se recunoaște…", ru: "Распознаётся…" }) : t({ ro: "Scanează exemplul", ru: "Сканировать пример" })}
            </button>
            <p className="text-xs text-muted">
              {t({ ro: "Formular original:", ru: "Оригинальная форма:" })}{" "}
              <ExternalLink href="https://agsv.md/wp-content/uploads/2025/04/formular-examinare-fitosanitara-1.pdf" lang={lang}>agsv.md (PDF)</ExternalLink>
            </p>
          </div>
        </div>
      )}

      <p aria-live="polite" className="sr-only">{announce}</p>
      {data && err && <p role="alert" className="font-semibold text-bad">⚠ {err}</p>}

      {data && a && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 ref={resultsRef} tabIndex={-1} className="text-xl font-bold">
              {a.recognizedForm ? a.recognizedForm.title[lang] : t({ ro: "Document nerecunoscut", ru: "Документ не распознан" })}
            </h2>
            <button type="button" onClick={reset} className="btn btn-secondary">{t({ ro: "Alt document", ru: "Другой документ" })}</button>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {data.sample && <DemoBadge lang={lang} />}
            <span className="rounded bg-none-soft px-2 py-0.5">{data.result.engine}</span>
            <span className={`rounded px-2 py-0.5 ${data.result.meanConfidence >= 70 ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>
              {t({ ro: "Încredere medie OCR", ru: "Средняя уверенность OCR" })}: {data.result.meanConfidence}%
            </span>
            {corrected && <span className="rounded bg-brand-soft px-2 py-0.5 text-brand-dark">{t({ ro: "Analiză pe textul corectat de dvs.", ru: "Анализ по исправленному вами тексту" })}</span>}
          </div>

          {a.needsReview.length > 0 && (
            <Notice tone="warn" title={t({ ro: "Necesită verificare", ru: "Требуется проверка" })}>
              <ul className="list-disc pl-5">{a.needsReview.map((r, i) => <li key={i}>{r.reason[lang]}</li>)}</ul>
            </Notice>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <section aria-labelledby="prev-h" className="card p-3">
              <h3 id="prev-h" className="mb-2 font-bold">{t({ ro: "Previzualizare cu evidențieri", ru: "Предпросмотр с выделением" })}</h3>
              {img && (
                <div className="relative overflow-hidden rounded border border-line">
                  <img src={img} alt={t({ ro: "Documentul scanat", ru: "Отсканированный документ" })} className="block w-full" />
                  {!corrected &&
                    data.result.lines.map((l) => {
                      const obs = a.observations.find((o) => o.lineKeys.includes(l.key));
                      if (!obs) return null;
                      const { w, h } = data.result.pageSize;
                      const on = focusLines.includes(l.key);
                      const color = obs.kind === "blank_field" ? "border-warn bg-warn/15" : obs.kind === "low_confidence" ? "border-bad bg-bad/10" : "border-ok bg-ok/10";
                      return (
                        <span
                          key={l.key}
                          aria-hidden="true"
                          className={`pointer-events-none absolute rounded-sm border-2 ${color} ${on ? "ring-4 ring-[#f0a500]" : ""}`}
                          style={{ left: `${(l.box.x / w) * 100}%`, top: `${(l.box.y / h) * 100}%`, width: `${(l.box.w / w) * 100}%`, height: `${(l.box.h / h) * 100}%` }}
                        />
                      );
                    })}
                </div>
              )}
              <p className="mt-2 text-xs text-muted">
                {t({ ro: "Legendă: chenar verde = titlu detectat; portocaliu = câmp care pare gol; roșu = recunoaștere nesigură. Aceleași informații apar ca text în lista de observații.", ru: "Легенда: зелёная рамка — найденный заголовок; оранжевая — поле выглядит пустым; красная — ненадёжное распознавание. Те же сведения даны текстом в списке наблюдений." })}
              </p>
            </section>

            <div className="space-y-4">
              <section aria-labelledby="obs-h" className="card p-4">
                <h3 id="obs-h" className="font-bold">{t({ ro: "Observații (ce se vede în text)", ru: "Наблюдения (что видно в тексте)" })}</h3>
                <p className="text-sm text-muted">{t({ ro: "Extrase direct din textul recunoscut. Pot fi greșite dacă OCR-ul a greșit.", ru: "Получены напрямую из распознанного текста. Могут быть неверны, если ошибся OCR." })}</p>
                {a.observations.length === 0 ? (
                  <p className="mt-2 text-sm">{t({ ro: "Nicio observație.", ru: "Наблюдений нет." })}</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {a.observations.map((o) => (
                      <li key={o.id}>
                        <button
                          type="button"
                          onClick={() => setFocusLines(o.lineKeys)}
                          aria-pressed={focusLines.join() === o.lineKeys.join() && o.lineKeys.length > 0}
                          disabled={corrected || !o.lineKeys.length}
                          className="flex w-full gap-2 rounded-lg border border-line p-2 text-left text-sm hover:border-brand disabled:hover:border-line"
                        >
                          <span aria-hidden="true" className={o.kind === "blank_field" ? "text-warn" : o.kind === "low_confidence" ? "text-bad" : "text-ok"}>
                            {o.kind === "blank_field" ? "◻" : o.kind === "low_confidence" ? "?" : "✓"}
                          </span>
                          <span>
                            <span className="font-semibold">{t({ ro: "Observație: ", ru: "Наблюдение: " })}</span>
                            {o.text[lang]}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="sug-h" className="card p-4">
                <h3 id="sug-h" className="font-bold">{t({ ro: "Sugestii (deducții din sursele publicate)", ru: "Подсказки (выводы из опубликованных источников)" })}</h3>
                <p className="text-sm text-muted">{t({ ro: "Nu sunt verdicte. Fiecare sugestie are citatul care o susține.", ru: "Это не вердикты. У каждой подсказки есть подтверждающая цитата." })}</p>
                {a.suggestions.length === 0 ? (
                  <p className="mt-2 text-sm">{t({ ro: "Nu avem reguli publicate în corpus pentru acest tip de document.", ru: "В корпусе нет опубликованных правил для этого типа документа." })}</p>
                ) : (
                  <ul className="mt-2 space-y-3">
                    {a.suggestions.map((s) => {
                      const ev = data.evidence[s.factId];
                      return (
                        <li key={s.id} className="rounded-lg border border-line p-3">
                          <p className="text-sm">
                            <span className="font-semibold">{t({ ro: "Deducție: ", ru: "Вывод: " })}</span>
                            {s.text[lang]}
                          </p>
                          {ev?.cites.map((c) => (
                            <figure key={c.passage.id} className="mt-2 rounded bg-paper p-2 text-sm">
                              <blockquote lang={c.passage.lang} className="border-l-4 border-[#d9b400] pl-2">
                                <Highlight text={c.passage.text} quote={c.quote} />
                              </blockquote>
                              <figcaption className="mt-1 text-xs text-muted">
                                {c.doc.title} · {c.passage.locator[lang]} · {t({ ro: "preluat", ru: "получено" })} {c.doc.retrievedAt}{" "}
                                {c.doc.url && <ExternalLink href={c.doc.url} lang={lang}>{t({ ro: "sursa", ru: "источник" })}</ExternalLink>}
                              </figcaption>
                            </figure>
                          ))}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          </div>

          <section aria-labelledby="txt-h" className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="txt-h" className="font-bold">{t({ ro: "Textul recunoscut", ru: "Распознанный текст" })}</h3>
              {!editing && <button type="button" className="btn btn-secondary min-h-10" onClick={() => setEditing(true)}>{t({ ro: "Corectează textul", ru: "Исправить текст" })}</button>}
            </div>
            {editing ? (
              <div className="mt-2 space-y-2">
                <label htmlFor="ocr-edit" className="field-label">{t({ ro: "Corectați erorile de recunoaștere", ru: "Исправьте ошибки распознавания" })}</label>
                <span id="ocr-edit-hint" className="field-hint">{t({ ro: "Analiza va fi refăcută pe textul dvs.; evidențierile pe imagine nu mai sunt afișate după corectare.", ru: "Анализ будет выполнен по вашему тексту; выделения на изображении после исправления не показываются." })}</span>
                <textarea id="ocr-edit" aria-describedby="ocr-edit-hint" className="input font-mono text-sm" rows={14} value={edited} onChange={(e) => setEdited(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={reanalyze}>{t({ ro: "Reanalizează", ru: "Проанализировать заново" })}</button>
                  <button type="button" className="btn btn-quiet" onClick={() => { setEditing(false); setEdited(data.result.text); }}>{t({ ro: "Renunță", ru: "Отмена" })}</button>
                </div>
              </div>
            ) : (
              <pre lang="ro" className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded bg-paper p-3 text-sm">{corrected ? edited : data.result.text || "—"}</pre>
            )}
            {data.result.pdfTextLayer && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer font-semibold">{t({ ro: "Stratul de text din PDF (nu OCR)", ru: "Текстовый слой PDF (не OCR)" })}</summary>
                <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded bg-paper p-2 text-xs">{data.result.pdfTextLayer}</pre>
              </details>
            )}
          </section>

          <Notice tone="info" title={t({ ro: "Ce urmează", ru: "Что дальше" })}>
            {t({ ro: "Completați câmpurile care par goale, verificați anexele cerute de sursa citată și depuneți cererea prin canalul indicat de instituție. Acest instrument nu depune nimic.", ru: "Заполните поля, которые выглядят пустыми, проверьте приложения, требуемые процитированным источником, и подайте заявление через канал учреждения. Этот инструмент ничего не подаёт." })}
          </Notice>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "../LangProvider";
import { BlurredPage, findLoose, Highlighted, MARK, ProgressBar, SEV, VERDICT } from "../scan/parts";
import { Icon } from "./Icon";
import type { L10n } from "@/lib/i18n";
import { recognize, type OcrPage } from "@/lib/scan/browserOcr";
import { detectModel, detectRules, leftoverIdentifiers, mergeSpans, PLACEHOLDER, redactText, type PiiSpan, type PiiType } from "@/lib/scan/pii";
import type { DocReview } from "@/lib/scan/review";

export interface DocContext {
  name: string;
  /** Redacted text only — the original never leaves the browser. */
  text: string;
  docType: string;
  summary: string;
}

type Stage = "ocr" | "redact" | "sending" | "result";

/**
 * The document flow as conversation turns. OCR and personal-data detection run in the
 * browser; the redaction gate is the one step the user cannot skip, because confirming it
 * is what authorises the redacted text to leave the device.
 */
export function DocumentTurn({ file, goal, onReady }: { file: File; goal: string; onReady: (ctx: DocContext) => void }) {
  const { lang, t } = useLang();
  const [stage, setStage] = useState<Stage>("ocr");
  const [pages, setPages] = useState<OcrPage[]>([]);
  const [text, setText] = useState("");
  const [spans, setSpans] = useState<PiiSpan[]>([]);
  const [progress, setProgress] = useState<{ label: L10n; pct: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [review, setReview] = useState<DocReview | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const started = useRef(false);
  const gate = useRef<HTMLDivElement>(null);

  const redacted = useMemo(() => redactText(text, spans), [text, spans]);
  const leftovers = useMemo(() => leftoverIdentifiers(redacted), [redacted]);
  const active = spans.filter((s) => s.redact);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const res = await recognize(file, (phase, pct, page, total) =>
          setProgress({
            label: phase === "load"
              ? { ro: "Pregătesc recunoașterea textului (RO + RU)…", ru: "Готовлю распознавание текста (RO + RU)…" }
              : phase === "render"
                ? { ro: `Pregătesc pagina ${page ?? 1}/${total ?? 1}…`, ru: `Готовлю страницу ${page ?? 1}/${total ?? 1}…` }
                : { ro: "Citesc textul…", ru: "Читаю текст…" },
            pct,
          }),
        );
        const full = res.map((p) => p.text.trim()).join("\n\n— — —\n\n");
        if (full.replace(/\s/g, "").length < 20) throw new Error("empty");
        setPages(res);
        setText(full);
        setStage("redact");

        const rules = detectRules(full);
        setSpans(mergeSpans(rules, full));
        setProgress({ label: { ro: "Pornesc modelul local de protecție a datelor…", ru: "Запускаю локальную модель защиты данных…" }, pct: 0 });
        try {
          const model = await detectModel(full, (pct) =>
            setProgress({ label: { ro: "Descarc modelul local (~280 MB, o singură dată)…", ru: "Скачиваю локальную модель (~280 МБ, один раз)…" }, pct }),
          );
          setSpans((cur) => mergeSpans([...rules, ...model, ...cur.filter((s) => s.source === "user")], full));
        } catch {
          setErr(t({
            ro: "Modelul local nu a pornit pe acest dispozitiv. S-au aplicat doar regulile automate — verificați lista și marcați manual numele.",
            ru: "Локальная модель не запустилась. Применены только автоматические правила — проверьте список и отметьте имена вручную.",
          }));
        }
        setProgress(null);
      } catch (e) {
        setProgress(null);
        setErr((e as Error).message === "empty"
          ? t({ ro: "Nu am găsit text în fișier. Încercați o fotografie mai clară, dreaptă și bine luminată.", ru: "В файле не найден текст. Попробуйте более чёткое, ровное и хорошо освещённое фото." })
          : t({ ro: "Recunoașterea a eșuat pe acest dispozitiv. Încercați alt fișier.", ru: "Распознавание не удалось на этом устройстве. Попробуйте другой файл." }));
      }
    })();
  }, [file, t]);

  const addSelection = (type: PiiType) => {
    const el = gate.current?.querySelector("#doc-text-" + safeId(file.name));
    const sel = window.getSelection();
    if (!el || !sel || sel.isCollapsed || !el.contains(sel.anchorNode)) {
      setErr(t({ ro: "Selectați mai întâi, în textul de mai jos, ce vreți să ascundeți.", ru: "Сначала выделите в тексте ниже то, что нужно скрыть." }));
      return;
    }
    const chosen = sel.toString().trim();
    if (chosen.length < 2) return;
    setErr(null);
    const next: PiiSpan[] = [];
    for (let i = text.indexOf(chosen); i >= 0; i = text.indexOf(chosen, i + chosen.length))
      next.push({ id: `u${i}`, start: i, end: i + chosen.length, text: chosen, type, source: "user", score: 1, redact: true });
    setSpans((s) => mergeSpans([...s, ...next], text));
    sel.removeAllRanges();
  };

  const send = async () => {
    if (!confirmed || leftovers.length) return;
    setStage("sending");
    setErr(null);
    try {
      const r = await fetch("/api/scan/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: redacted, goal, confirmed: true }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      const doc = j as DocReview;
      setReview(doc);
      setStage("result");
      onReady({ name: file.name, text: redacted, docType: doc.docType[lang], summary: doc.summary[lang] });
    } catch (e) {
      const code = (e as Error).message;
      setStage("redact");
      setErr(
        code === "pii_leak" ? t({ ro: "Serverul a refuzat textul: încă are un identificator personal. Verificați lista.", ru: "Сервер отклонил текст: в нём ещё есть личный идентификатор. Проверьте список." })
        : code === "ai_disabled" ? t({ ro: "Analiza documentelor are nevoie de un model AI configurat. Nimic nu a fost trimis.", ru: "Для анализа документов нужна настроенная ИИ-модель. Ничего не отправлено." })
        : code === "training_not_allowed" ? t({ ro: "Modelul nu este activat în contul OpenCode. Nimic nu a fost trimis mai departe.", ru: "Модель не включена в аккаунте OpenCode. Дальше ничего не отправлено." })
        : t({ ro: "Analiza nu a reușit. Textul ascuns este încă aici — încercați din nou.", ru: "Анализ не удался. Скрытый текст остался здесь — попробуйте ещё раз." }),
      );
    }
  };

  const textId = "doc-text-" + safeId(file.name);

  return (
    <div className="doc-turn">
      {err && <p role="alert" className="doc-alert">⚠ {err}</p>}

      {stage === "ocr" && (
        <div className="doc-card">
          <p className="doc-card-title">{t({ ro: "Citesc documentul pe dispozitivul tău", ru: "Читаю документ на вашем устройстве" })}</p>
          <p className="doc-note">{t({ ro: "Imaginea și textul complet nu părăsesc browserul.", ru: "Изображение и полный текст не покидают браузер." })}</p>
          {progress && <ProgressBar label={t(progress.label)} pct={progress.pct} />}
        </div>
      )}

      {(stage === "redact" || stage === "sending") && (
        <div className="doc-card" ref={gate}>
          <p className="doc-card-title">{t({ ro: "Am citit documentul. Verifică ce se ascunde înainte de trimitere.", ru: "Документ прочитан. Проверьте, что скрыто, перед отправкой." })}</p>
          {progress ? <ProgressBar label={t(progress.label)} pct={progress.pct} /> : (
            <p className="doc-note">
              {spans.length
                ? t({ ro: `Am găsit ${spans.length} date personale. Debifează doar ce nu este dată personală.`, ru: `Найдено ${spans.length} личных данных. Снимите отметку только с того, что не является личными данными.` })
                : t({ ro: "Nu am găsit date personale evidente. Verifică textul de mai jos înainte de a-l trimite.", ru: "Очевидных личных данных не найдено. Проверьте текст ниже перед отправкой." })}
            </p>
          )}

          {pages[0] && <div className="doc-preview"><BlurredPage page={pages[0]} spans={active} pageIndex={0} pages={pages} /></div>}

          {spans.length > 0 && (
            <ul className="doc-pii">
              {spans.map((s) => (
                <li key={s.id}>
                  <label className={s.redact ? "on" : "off"}>
                    <input type="checkbox" checked={s.redact} onChange={() => setSpans((x) => x.map((y) => (y.id === s.id ? { ...y, redact: !y.redact } : y)))} />
                    <span className="doc-tag">{PLACEHOLDER[s.type][lang]}</span>
                    <span className={s.redact ? "doc-blur" : ""}>{s.text}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          <details className="doc-fold">
            <summary>{t({ ro: "Textul recunoscut — marchează ce am ratat", ru: "Распознанный текст — отметьте пропущенное" })}</summary>
            <div id={textId} lang="ro" className="doc-text">
              <Highlighted text={text} ranges={active.map((s) => ({ start: s.start, end: s.end, cls: "rounded bg-ink text-transparent px-0.5", masked: true, label: PLACEHOLDER[s.type][lang] }))} />
            </div>
            <div className="doc-chips">
              {(["name", "address", "phone", "id_doc", "other"] as PiiType[]).map((ty) => (
                <button key={ty} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => addSelection(ty)}>+ {PLACEHOLDER[ty][lang]}</button>
              ))}
            </div>
          </details>

          <details className="doc-fold">
            <summary>{t({ ro: "Exact acest text va fi trimis", ru: "Будет отправлен именно этот текст" })}</summary>
            <pre className="doc-outgoing">{redacted}</pre>
          </details>

          {leftovers.length > 0 && (
            <p role="alert" className="doc-alert">⚠ {t({ ro: "Textul încă pare să conțină identificatori:", ru: "В тексте, похоже, ещё есть идентификаторы:" })} {leftovers.join(", ")}.</p>
          )}

          {/* Confirming "everything is hidden" only means something once detection has stopped changing the list. */}
          {progress ? (
            <p className="doc-note">{t({ ro: "Poți trimite după ce se termină căutarea datelor personale.", ru: "Отправить можно после завершения поиска личных данных." })}</p>
          ) : (
            <>
              <label className="doc-confirm">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                <span>{t({ ro: "Am verificat: datele personale sunt ascunse. Trimit doar acest text spre analiză.", ru: "Я проверил(а): личные данные скрыты. Отправляю на анализ только этот текст." })}</span>
              </label>
              <button type="button" className="doc-send" disabled={!confirmed || leftovers.length > 0 || stage === "sending"} onClick={send}>
                {stage === "sending"
                  ? t({ ro: "Asistentul analizează…", ru: "Помощник анализирует…" })
                  : t({ ro: "Trimite textul ascuns", ru: "Отправить скрытый текст" })}
              </button>
            </>
          )}
        </div>
      )}

      {stage === "result" && review && (
        <div className="doc-result">
          <div className="doc-verdict">
            <span className={`doc-chip ${review.verdict}`}>
              <span aria-hidden="true">{SEV[VERDICT[review.verdict].sev].icon}</span> {t(VERDICT[review.verdict].label)}
            </span>
            <span className="doc-note">{t(review.docType)}{review.userRole && ` · ${t({ ro: "rolul tău:", ru: "ваша роль:" })} ${t(review.userRole)}`}</span>
          </div>
          <p className="doc-summary">{t(review.summary)}</p>

          <ul className="doc-findings">
            {review.findings.map((f) => (
              <li key={f.id}>
                <button type="button" className={`doc-finding ${f.severity} ${focus === f.id ? "focused" : ""}`} onClick={() => { setFocus(f.id); document.getElementById(`hl-${safeId(file.name)}-${f.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>
                  <span className="doc-finding-head">
                    <span className={`doc-sev ${f.severity}`}><span aria-hidden="true">{SEV[f.severity].icon} </span>{t(SEV[f.severity].label)}</span>
                    <strong>{t(f.title)}</strong>
                  </span>
                  <span className="doc-finding-body">{t(f.explanation)}</span>
                  {f.suggestion && <span className="doc-suggestion"><strong>{t({ ro: "Sugestie: ", ru: "Совет: " })}</strong>{t(f.suggestion)}</span>}
                  {f.quote && (
                    <span className="doc-quote">
                      {f.quoteVerified
                        ? <>„{f.quote.slice(0, 140)}{f.quote.length > 140 ? "…" : ""}” · {t({ ro: "vezi în document", ru: "показать в документе" })}</>
                        : t({ ro: "Citatul propus de model nu apare exact în document — tratează cu prudență.", ru: "Цитата модели не найдена дословно — относитесь с осторожностью." })}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          {review.checklist.length > 0 && (
            <details className="doc-fold">
              <summary>{t({ ro: "Lista elementelor esențiale", ru: "Список важных элементов" })}</summary>
              <ul className="doc-checklist">
                {review.checklist.map((c, i) => (
                  <li key={i} className={c.present ? "yes" : "no"}>
                    <span aria-hidden="true">{c.present ? "✓" : "✗"}</span>
                    <span><span className="sr-only">{c.present ? t({ ro: "Prezent: ", ru: "Есть: " }) : t({ ro: "Lipsește: ", ru: "Нет: " })}</span>{t(c.item)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <details className="doc-fold">
            <summary>{t({ ro: "Documentul, cu evidențieri", ru: "Документ с выделениями" })}</summary>
            <div lang="ro" className="doc-text">
              <Highlighted
                text={redacted}
                ranges={review.findings.flatMap((f) => {
                  if (!f.quote || !f.quoteVerified) return [];
                  const at = findLoose(redacted, f.quote);
                  return at ? [{ start: at[0], end: at[1], cls: `${MARK[f.severity]} rounded px-0.5`, id: `hl-${safeId(file.name)}-${f.id}` }] : [];
                })}
              />
            </div>
          </details>

          <p className="doc-followup"><Icon name="chat" />{t({ ro: "Poți întreba mai departe despre acest document — de exemplu „ce înseamnă clauza despre penalități?”.", ru: "Можно спросить дальше об этом документе — например «что значит пункт о штрафах?»." })}</p>
          <p className="doc-note">{t({ ro: "Analiză asistată de", ru: "Анализ выполнен" })} {review.model} · {t({ ro: "nu este consultanță juridică.", ru: "это не юридическая консультация." })}</p>
        </div>
      )}
    </div>
  );
}

const safeId = (name: string) => name.replace(/[^a-z0-9]/gi, "").slice(0, 24) || "doc";

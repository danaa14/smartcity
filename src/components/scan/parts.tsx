"use client";

import { useMemo } from "react";
import { useLang } from "../LangProvider";
import type { L10n } from "@/lib/i18n";
import type { OcrPage } from "@/lib/scan/browserOcr";
import type { PiiSpan } from "@/lib/scan/pii";
import type { ReviewFinding } from "@/lib/scan/review";

export const SEV: Record<ReviewFinding["severity"], { cls: string; icon: string; label: L10n }> = {
  risk: { cls: "border-bad bg-bad-soft text-bad", icon: "⚠", label: { ro: "Risc", ru: "Риск" } },
  warn: { cls: "border-warn bg-warn-soft text-warn", icon: "!", label: { ro: "Atenție", ru: "Внимание" } },
  info: { cls: "border-brand bg-brand-soft text-brand-dark", icon: "i", label: { ro: "Info", ru: "Инфо" } },
  ok: { cls: "border-ok bg-ok-soft text-ok", icon: "✓", label: { ro: "Bine", ru: "Хорошо" } },
};

export const MARK: Record<ReviewFinding["severity"], string> = {
  risk: "bg-[#f8d4d1] shadow-[inset_0_-2px_0_#a3261d]",
  warn: "bg-[#fbe3b6] shadow-[inset_0_-2px_0_#8a5300]",
  info: "bg-[#d8e3f5] shadow-[inset_0_-2px_0_#1f4e9c]",
  ok: "bg-[#d3ecdb] shadow-[inset_0_-2px_0_#1d6b3a]",
};

export const VERDICT: Record<string, { sev: ReviewFinding["severity"]; label: L10n }> = {
  high_risk: { sev: "risk", label: { ro: "Risc ridicat pentru dvs.", ru: "Высокий риск для вас" } },
  needs_attention: { sev: "warn", label: { ro: "Necesită atenție", ru: "Требует внимания" } },
  looks_complete: { sev: "ok", label: { ro: "Pare complet", ru: "Выглядит полным" } },
};

export function ProgressBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="space-y-1" aria-hidden="true">
      <div className="flex justify-between text-sm"><span className="pf-shimmer-text font-semibold">{label}</span><span className="tabular-nums text-muted">{Math.round(pct * 100)}%</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${Math.max(4, pct * 100)}%` }} /></div>
    </div>
  );
}

export function Highlighted({ text, ranges }: { text: string; ranges: { start: number; end: number; cls: string; id?: string; masked?: boolean; label?: string }[] }) {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out: React.ReactNode[] = [];
  let pos = 0;
  sorted.forEach((r, i) => {
    if (r.start < pos) return;
    out.push(text.slice(pos, r.start));
    const body = text.slice(r.start, r.end);
    // Masked spans use <span>: the global `mark` style would otherwise keep the text readable.
    out.push(r.masked
      ? <span key={i} className={r.cls} role="img" aria-label={`${r.label ?? ""} (ascuns / скрыто)`}><span aria-hidden="true">{body}</span></span>
      : <mark key={i} id={r.id} className={r.cls}>{body}</mark>);
    pos = r.end;
  });
  out.push(text.slice(pos));
  return <>{out}</>;
}

/** Locates a quote in text ignoring whitespace differences. */
export function findLoose(text: string, quote: string): [number, number] | null {
  const q = quote.replace(/\s+/g, " ").trim();
  const map: number[] = [];
  let flat = "";
  for (let i = 0; i < text.length; i++) {
    if (/\s/.test(text[i])) { if (flat.endsWith(" ")) continue; flat += " "; } else flat += text[i];
    map.push(i);
  }
  const j = flat.toLowerCase().indexOf(q.toLowerCase());
  if (j < 0) return null;
  return [map[j], map[j + q.length - 1] + 1];
}

/** Draws the page and blurs the OCR word boxes that fall inside redacted spans. */
export function BlurredPage({ page, spans, pageIndex, pages }: { page: OcrPage; spans: PiiSpan[]; pageIndex: number; pages: OcrPage[] }) {
  const { t } = useLang();
  const boxes = useMemo(() => {
    let offset = 0;
    for (let i = 0; i < pageIndex; i++) offset += pages[i].text.trim().length + "\n\n— — —\n\n".length;
    const pageText = page.text.trim();
    const out: { x0: number; y0: number; x1: number; y1: number }[] = [];
    let cursor = 0;
    for (const w of page.words) {
      const at = pageText.indexOf(w.text, cursor);
      if (at < 0) continue;
      cursor = at + w.text.length;
      const s = offset + at;
      const e = s + w.text.length;
      if (spans.some((sp) => sp.start < e && sp.end > s)) out.push(w.bbox);
    }
    return out;
  }, [page, spans, pageIndex, pages]);
  return (
    <div className="relative overflow-hidden rounded border border-line">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={page.image} alt={t({ ro: `Pagina ${pageIndex + 1}, cu datele personale estompate`, ru: `Страница ${pageIndex + 1} с размытыми личными данными` })} className="block w-full" />
      {boxes.map((b, i) => (
        <span key={i} aria-hidden="true" className="absolute rounded-sm bg-ink/40 backdrop-blur-md transition-opacity" style={{ left: `${(b.x0 / page.width) * 100}%`, top: `${(b.y0 / page.height) * 100}%`, width: `${((b.x1 - b.x0) / page.width) * 100}%`, height: `${((b.y1 - b.y0) / page.height) * 100}%` }} />
      ))}
    </div>
  );
}

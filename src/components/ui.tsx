import type { AnswerStatus } from "@/lib/answer/types";
import { UI, type Lang } from "@/lib/i18n";

const STATUS_STYLE: Record<AnswerStatus, { cls: string; icon: string }> = {
  supported: { cls: "bg-ok-soft text-ok border-ok", icon: "✓" },
  partial: { cls: "bg-warn-soft text-warn border-warn", icon: "◐" },
  missing: { cls: "bg-none-soft text-none border-none", icon: "∅" },
  contradiction: { cls: "bg-bad-soft text-bad border-bad", icon: "⚠" },
};

export function StatusBadge({ status, lang, size = "md" }: { status: AnswerStatus; lang: Lang; size?: "sm" | "md" }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-bold ${s.cls} ${size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"}`}>
      <span aria-hidden="true">{s.icon}</span>
      {UI.status[status][lang]}
    </span>
  );
}

export function DemoBadge({ lang }: { lang: Lang }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-demo bg-demo-soft px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-demo">
      <span aria-hidden="true">◇</span>
      {UI.demoBadge[lang]}
    </span>
  );
}

export function RealBadge({ lang }: { lang: Lang }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-ok bg-ok-soft px-1.5 py-0.5 text-xs font-bold text-ok">
      <span aria-hidden="true">●</span>
      {UI.realBadge[lang]}
    </span>
  );
}

export function ExternalLink({ href, children, lang, className = "link" }: { href: string; children: React.ReactNode; lang: Lang; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span aria-hidden="true"> ↗</span>
      <span className="sr-only"> {UI.externalNote[lang]}</span>
    </a>
  );
}

export function Notice({ tone, title, children }: { tone: "info" | "warn" | "demo" | "bad" | "ok"; title?: string; children: React.ReactNode }) {
  const cls = {
    info: "border-brand bg-brand-soft",
    warn: "border-warn bg-warn-soft",
    demo: "border-demo bg-demo-soft",
    bad: "border-bad bg-bad-soft",
    ok: "border-ok bg-ok-soft",
  }[tone];
  const icon = { info: "ℹ", warn: "!", demo: "◇", bad: "⚠", ok: "✓" }[tone];
  return (
    <div className={`flex gap-3 rounded-lg border-l-4 p-3 ${cls}`}>
      <span aria-hidden="true" className="mt-0.5 font-bold">{icon}</span>
      <div className="min-w-0 text-sm">
        {title && <p className="font-bold">{title}</p>}
        {children}
      </div>
    </div>
  );
}

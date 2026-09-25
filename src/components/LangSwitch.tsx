"use client";

import { useLang } from "./LangProvider";
import { UI } from "@/lib/i18n";

export function LangSwitch() {
  const { lang, setLang, t } = useLang();
  return (
    <div role="group" aria-label={t(UI.langLabel)} className="flex overflow-hidden rounded-lg border border-white/60">
      {(["ro", "ru"] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={`min-h-10 min-w-12 px-3 text-sm font-bold ${lang === l ? "bg-white text-brand-dark" : "text-white hover:bg-white/15"}`}
        >
          <span aria-hidden="true">{l.toUpperCase()}</span>
          <span className="sr-only">{l === "ro" ? "Română" : "Русский"}</span>
        </button>
      ))}
    </div>
  );
}

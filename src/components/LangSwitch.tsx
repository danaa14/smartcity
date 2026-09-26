"use client";

import { useLang } from "./LangProvider";
import { UI } from "@/lib/i18n";

export function LangSwitch() {
  const { lang, setLang, t } = useLang();
  return (
    <div role="group" aria-label={t(UI.langLabel)} className="language-switch">
      {(["ro", "ru"] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={lang === l ? "selected" : ""}
        >
          <span aria-hidden="true">{l.toUpperCase()}</span>
          <span className="sr-only">{l === "ro" ? "Română" : "Русский"}</span>
        </button>
      ))}
    </div>
  );
}

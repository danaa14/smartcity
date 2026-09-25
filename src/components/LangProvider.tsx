"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, type L10n, type Lang } from "@/lib/i18n";

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (x: L10n) => string }>({
  lang: "ro",
  setLang: () => {},
  t: (x) => x.ro,
});

export function LangProvider({ initial, children }: { initial: Lang; children: React.ReactNode }) {
  const [lang, setState] = useState<Lang>(initial);
  const router = useRouter();
  const setLang = useCallback(
    (l: Lang) => {
      document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = l;
      setState(l);
      router.refresh();
    },
    [router],
  );
  const t = useCallback((x: L10n) => x[lang], [lang]);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}

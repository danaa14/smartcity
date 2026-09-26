"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, type L10n, type Lang } from "@/lib/i18n";

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (x: L10n) => string }>({
  lang: "ro",
  setLang: () => {},
  t: (x) => x.ro,
});

const listeners = new Set<() => void>();
let stored: Lang | null = null;

function readCookie(): Lang | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )pefir_lang=(ro|ru)/);
  return m ? (m[1] as Lang) : null;
}

export function LangProvider({ initial, children }: { initial: Lang; children: React.ReactNode }) {
  const subscribe = useCallback((fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  const getSnapshot = useCallback((): Lang => stored ?? readCookie() ?? initial, [initial]);
  const getServerSnapshot = useCallback((): Lang => initial, [initial]);
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const router = useRouter();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback(
    (l: Lang) => {
      stored = l;
      document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = l;
      for (const fn of listeners) fn();
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

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "./LangProvider";
import { LangSwitch } from "./LangSwitch";
import { UI } from "@/lib/i18n";

export const NAV = [
  { href: "/intreaba", key: "ask" },
  { href: "/scaneaza", key: "scan" },
  { href: "/raporteaza", key: "report" },
  { href: "/suna", key: "call" },
  { href: "/surse", key: "sources" },
  { href: "/angajati", key: "staff" },
  { href: "/despre", key: "about" },
] as const;

export function SiteHeader() {
  const { t } = useLang();
  const path = usePathname();
  return (
    <header className="bg-brand text-white">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/" className="mr-auto flex items-center gap-2 rounded font-bold leading-tight">
          <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-lg bg-white text-lg text-brand">
            ⌁
          </span>
          <span>
            <span className="block text-base sm:text-lg">{t(UI.appName)}</span>
            <span className="block text-xs font-medium text-white/85">{t({ ro: "Prototip · nu este serviciu oficial", ru: "Прототип · не официальный сервис" })}</span>
          </span>
        </Link>
        <LangSwitch />
      </div>
      <nav aria-label={t(UI.mainNav)} className="hidden border-t border-white/20 md:block">
        <ul className="mx-auto flex max-w-6xl gap-1 px-4 sm:px-6">
          {NAV.map((n) => {
            const active = path === n.href || path.startsWith(n.href + "/");
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`block border-b-4 px-3 py-2.5 text-sm font-semibold ${active ? "border-white" : "border-transparent text-white/90 hover:border-white/50"}`}
                >
                  {t(UI.nav[n.key])}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}

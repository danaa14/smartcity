"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "./LangProvider";
import { UI } from "@/lib/i18n";

const ITEMS = [
  { href: "/intreaba", icon: "?", label: UI.navShort.ask },
  { href: "/scaneaza", icon: "▣", label: UI.navShort.scan },
  { href: "/raporteaza", icon: "!", label: UI.navShort.report },
  { href: "/suna", icon: "☏", label: UI.navShort.call },
  { href: "/despre", icon: "≡", label: UI.navShort.more },
];

export function MobileNav() {
  const { t } = useLang();
  const path = usePathname();
  return (
    <nav aria-label={t(UI.mainNav)} className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white md:hidden">
      <ul className="grid grid-cols-5">
        {ITEMS.map((i) => {
          const active = path === i.href || path.startsWith(i.href + "/");
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${active ? "bg-brand-soft text-brand-dark" : "text-muted"}`}
              >
                <span aria-hidden="true" className={`grid h-7 w-7 place-items-center rounded-full text-base ${active ? "bg-brand text-white" : "bg-none-soft"}`}>
                  {i.icon}
                </span>
                {t(i.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

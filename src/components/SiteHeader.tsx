"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "./LangProvider";
import { LangSwitch } from "./LangSwitch";
import { Icon } from "./chat/Icon";

export function SiteHeader() {
  const { t } = useLang();
  const path = usePathname();
  const chat = path === "/" || path === "/intreaba";
  return (
    <header className="site-header">
      <Link href="/" className="wordmark" aria-label={t({ ro: "Chișinău, pe fir — acasă", ru: "Кишинэу, на связи — главная" })}>
        <span className="brand-symbol"><Icon name="chat" /></span>
        <span>pe fir<span className="brand-period">.</span><small>CHIȘINĂU</small></span>
      </Link>
      <nav className="header-switch" aria-label={t({ ro: "Navigare principală", ru: "Основная навигация" })}>
        <Link href="/" aria-current={chat ? "page" : undefined}><Icon name="chat" /><span>{t({ ro: "Conversație", ru: "Диалог" })}</span></Link>
        <Link href="/raporteaza" aria-current={path === "/raporteaza" ? "page" : undefined}><Icon name="pin" /><span>{t({ ro: "Dă de veste", ru: "Сообщить" })}</span></Link>
      </nav>
      <LangSwitch />
    </header>
  );
}

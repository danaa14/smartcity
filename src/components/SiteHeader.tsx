"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useLang } from "./LangProvider";
import { LangSwitch } from "./LangSwitch";
import { Icon } from "./chat/Icon";

export function SiteHeader() {
  const { t } = useLang();
  const path = usePathname();
  const chat = path === "/" || path === "/intreaba";
  const reporting = path.startsWith("/raporteaza");
  const backOffice = path.startsWith("/angajati");

  return (
    <header className="site-header">
      <Link href="/" className="wordmark" aria-label={t({ ro: "Chișinău, pe fir — acasă", ru: "Кишинэу, на связи — главная" })}>
        <span className="brand-symbol"><Image src="/logo-civic-silhouette.png" alt="" width={36} height={42} priority /></span>
        <span>pe fir<span className="brand-period">.</span><small>CHIȘINĂU</small></span>
      </Link>
      {backOffice ? (
        <span className="bo-badge">{t({ ro: "BACK OFFICE", ru: "БЭК-ОФИС" })}</span>
      ) : (
        <nav className="header-switch" aria-label={t({ ro: "Navigare principală", ru: "Основная навигация" })}>
          <Link className="nav-chat" href="/" aria-current={chat ? "page" : undefined}><Icon name="chat" /><span>{t({ ro: "Conversație", ru: "Диалог" })}</span></Link>
          <Link className="nav-report" href="/raporteaza" aria-current={reporting ? "page" : undefined}><Icon name="pin" /><span>{t({ ro: "Dă de veste", ru: "Сообщить" })}</span></Link>
        </nav>
      )}
      <LangSwitch />
    </header>
  );
}

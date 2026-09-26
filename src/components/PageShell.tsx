"use client";

import { usePathname } from "next/navigation";

export function PageShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const chat = path === "/" || path === "/intreaba";
  const backOffice = path.startsWith("/angajati");
  return <main id="main" tabIndex={-1} className={chat ? "chat-main" : backOffice ? "bo-main" : "content-main"}>{children}</main>;
}

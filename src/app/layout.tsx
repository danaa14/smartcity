import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getLang } from "@/lib/i18n/server";
import { LangProvider } from "@/components/LangProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { MobileNav } from "@/components/MobileNav";
import { UI, tr } from "@/lib/i18n";
import Link from "next/link";

export const metadata: Metadata = {
  title: { default: "Chișinău, pe fir — prototip", template: "%s · Chișinău, pe fir" },
  description: "Prototip de asistent municipal cu răspunsuri verificabile, citări exacte și traseu de pași.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1f4e9c" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html lang={lang} className="h-full antialiased">
      <body className="flex min-h-full flex-col pb-20 md:pb-0">
        <LangProvider initial={lang}>
          <a href="#main" className="sr-only z-50 rounded bg-white px-4 py-2 font-semibold text-brand focus:not-sr-only focus:fixed focus:left-2 focus:top-2">
            {tr(UI.skip, lang)}
          </a>
          <SiteHeader />
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 sm:py-8">
            {children}
          </main>
          <footer className="border-t border-line bg-white">
            <div className="mx-auto max-w-6xl space-y-1 px-4 py-5 text-sm text-muted sm:px-6">
              <p className="font-semibold text-ink">{tr(UI.prototype, lang)}</p>
              <p>{tr(UI.footerData, lang)}</p>
              <p>
                <Link className="link" href="/despre">{tr(UI.nav.about, lang)}</Link> ·{" "}
                <Link className="link" href="/surse">{tr(UI.nav.sources, lang)}</Link> ·{" "}
                <Link className="link" href="/angajati">{tr(UI.nav.staff, lang)}</Link>
              </p>
            </div>
          </footer>
          <MobileNav />
        </LangProvider>
      </body>
    </html>
  );
}

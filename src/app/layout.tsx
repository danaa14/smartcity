import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getLang } from "@/lib/i18n/server";
import { LangProvider } from "@/components/LangProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { PageShell } from "@/components/PageShell";
import { UI, tr } from "@/lib/i18n";

export const metadata: Metadata = {
  title: { default: "Chișinău, pe fir — prototip", template: "%s · Chișinău, pe fir" },
  description: "Prototip de asistent municipal cu răspunsuri verificabile, citări exacte și traseu de pași.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff", interactiveWidget: "resizes-content" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html lang={lang} className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <LangProvider initial={lang}>
          <a href="#main" className="sr-only z-50 rounded bg-white px-4 py-2 font-semibold text-brand focus:not-sr-only focus:fixed focus:left-2 focus:top-2">
            {tr(UI.skip, lang)}
          </a>
          <SiteHeader />
          <PageShell>{children}</PageShell>
        </LangProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LangProvider } from "@/components/LangProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { ConversationProvider } from "@/components/ConversationProvider";
import { PageShell } from "@/components/PageShell";
import { UI, tr } from "@/lib/i18n";

export const metadata: Metadata = {
  title: { default: "Chișinău, pe fir — prototip", template: "%s · Chișinău, pe fir" },
  description: "Prototip de asistent municipal cu răspunsuri verificabile, citări exacte și traseu de pași.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff", interactiveWidget: "resizes-content" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Static-first: the language cookie is adopted client-side in LangProvider
  // (keeps pages prerenderable; see Vercel function budget).
  const lang = "ro" as const;
  return (
    <html lang={lang} className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <LangProvider initial={lang}>
          <a href="#main" className="sr-only z-50 rounded bg-white px-4 py-2 font-semibold text-brand focus:not-sr-only focus:fixed focus:left-2 focus:top-2">
            {tr(UI.skip, lang)}
          </a>
          <ConversationProvider>
          <SiteHeader />
          <PageShell>{children}</PageShell>
          </ConversationProvider>
        </LangProvider>
      </body>
    </html>
  );
}

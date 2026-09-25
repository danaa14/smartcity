import type { Metadata } from "next";
import { getLang } from "@/lib/i18n/server";
import { AskClient } from "@/components/ask/AskClient";
import { DOCS } from "@/lib/corpus/docs";

export const metadata: Metadata = { title: "Întreabă primăria" };

export default async function AskPage(props: PageProps<"/intreaba">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 500) : "";
  const lang = await getLang();
  const real = DOCS.filter((d) => d.kind === "real").length;
  const demo = DOCS.filter((d) => d.kind === "demo").length;
  return <AskClient key={q} initialQuestion={q} lang={lang} coverage={{ real, demo, retrievedAt: "2026-09-25" }} />;
}

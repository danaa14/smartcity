import type { Metadata } from "next";
import { ChatClient } from "@/components/chat/ChatClient";

export const metadata: Metadata = { title: "Conversație" };

export default async function AskPage(props: PageProps<"/intreaba">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 500) : "";
  return <ChatClient key={q} initialQuestion={q} />;
}

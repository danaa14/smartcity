import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Creează un tichet" };

export default function CreateTicketPage() {
  redirect("/raporteaza");
}

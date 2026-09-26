import type { Metadata } from "next";
import { ReportClient } from "@/components/report/ReportClient";
import { tickets } from "@/lib/tickets/repo";
import type { Ticket } from "@/lib/tickets/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Raportează o problemă" };

export default function ReportPage() {
  return <ReportData />;
}

async function ReportData() {
  const all = await tickets.all();
  const initialTickets = all.map((x: Ticket) => ({ id: x.id, title: x.title, city: x.city, status: x.status, location: x.location, description: x.description, createdAt: x.createdAt }));
  return <ReportClient initialTickets={initialTickets} />;
}

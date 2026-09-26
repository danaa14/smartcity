import type { Metadata } from "next";
import { ReportClient } from "@/components/report/ReportClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Raportează o problemă" };

export default function ReportPage() {
  return <ReportClient />;
}

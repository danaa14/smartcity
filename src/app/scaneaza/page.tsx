import type { Metadata } from "next";
import { ScanClient } from "@/components/scan/ScanClient";

export const metadata: Metadata = { title: "Scanează un document" };

export default function ScanPage() {
  return <ScanClient />;
}

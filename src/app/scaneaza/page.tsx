import type { Metadata } from "next";
import { AssistantScan } from "@/components/scan/AssistantScan";
import "@/components/ask/chat-motion.css";

export const metadata: Metadata = { title: "Asistentul pentru documente" };

export default function ScanPage() {
  return <AssistantScan />;
}

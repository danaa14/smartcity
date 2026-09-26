import type { Metadata } from "next";
import { PhoneClient } from "@/components/phone/PhoneClient";

export const metadata: Metadata = { title: "Sună — demonstrație de concept" };

export default function PhonePage() {
  return <PhoneClient />;
}

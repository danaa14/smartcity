import { NextResponse } from "next/server";
import { suggestCategory, suggestDescription } from "@/lib/tickets/classify";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = (b?.text ?? "").slice(0, 1000);
  return NextResponse.json({
    category: suggestCategory(text),
    description: suggestDescription(text),
    method: "keyword-rules",
  });
}

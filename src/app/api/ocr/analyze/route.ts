import { NextResponse } from "next/server";
import { analyzeOcr } from "@/lib/ocr/analyze";
import { evidenceFor } from "@/lib/ocr/evidence";

/** Re-runs the analysis on user-corrected text (no image involved). */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = b?.text?.slice(0, 20000);
  if (!text?.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });
  const analysis = analyzeOcr([], 100, text);
  return NextResponse.json({ analysis, evidence: evidenceFor(analysis.suggestions.map((s) => s.factId)) });
}

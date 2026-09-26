import { NextResponse } from "next/server";
import { reviewDocument } from "@/lib/scan/review";
import { AI } from "@/lib/ai/config";
import { ModelError } from "@/lib/ai/client";

export const runtime = "nodejs";
export const maxDuration = 120;

// Server-side safety net: refuse text that still contains structured identifiers.
const LEAKS: RegExp[] = [
  /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/u,
  /[\p{L}\p{N}._%+-]{2,}\s?(?:\(Q|\(a\)|\(@|©|®)\s?[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.(?:md|com|ru|ro|net|org|eu|ua)\b/iu,
  /\bMD\d{2}\s?(?:[A-Z0-9]{2,4}\s?){4,6}/,
  /\b[0-2]\d{12}\b/,
  /\b(?:\d{4}[\s-]?){3}\d{4}\b/,
];

/** Receives ONLY text the user already reviewed and redacted in the browser. Nothing is stored or logged. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { text?: string; goal?: string; confirmed?: boolean } | null;
  const text = b?.text?.trim();
  if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (b?.confirmed !== true) return NextResponse.json({ error: "not_confirmed" }, { status: 400 });
  if (LEAKS.some((re) => re.test(text))) return NextResponse.json({ error: "pii_leak" }, { status: 422 });
  if (!AI.enabled) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });
  try {
    const review = await reviewDocument(text, (b.goal ?? "").slice(0, 300));
    return NextResponse.json({ ...review, model: AI.model });
  } catch (e) {
    const code = e instanceof ModelError ? e.code : "bad_output";
    console.warn(`scan review failed: ${code}`);
    return NextResponse.json({ error: code }, { status: 502 });
  }
}

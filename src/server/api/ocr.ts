import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getOcrAdapter } from "@/lib/ocr/adapter";
import { analyzeOcr } from "@/lib/ocr/analyze";
import { evidenceFor } from "@/lib/ocr/evidence";

export const runtime = "nodejs";
const MAX = 10 * 1024 * 1024;
const TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/tiff", "application/pdf"]);

/** Upload is processed in memory + a temp dir that is deleted immediately; nothing is stored. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const sample = form?.get("sample");
  let buf: Buffer;
  let mime: string;
  if (sample === "agsv") {
    buf = await fs.readFile(path.join(process.cwd(), "public", "samples", "agsv-cerere-exemplu.png"));
    mime = "image/png";
  } else {
    const file = form?.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 });
    if (!TYPES.has(file.type)) return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
    if (file.size > MAX) return NextResponse.json({ error: "too_large" }, { status: 413 });
    buf = Buffer.from(await file.arrayBuffer());
    mime = file.type;
  }
  const ocr = getOcrAdapter();
  if (!(await ocr.available())) return NextResponse.json({ error: "ocr_unavailable" }, { status: 503 });
  try {
    const result = await ocr.recognize(buf, mime);
    const analysis = analyzeOcr(result.lines, result.meanConfidence);
    return NextResponse.json({ result, analysis, evidence: evidenceFor(analysis.suggestions.map((s) => s.factId)), sample: sample === "agsv", external: ocr.external });
  } catch (e) {
    console.error("ocr failed:", (e as Error).message);
    return NextResponse.json({ error: "ocr_failed" }, { status: 500 });
  }
}

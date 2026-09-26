import { NextResponse } from "next/server";
import { transcribeVideo } from "@/lib/stt/whisperAdapter";

const AUDIO = new Set(["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/x-m4a"]);
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "no_file" }, { status: 400 });
  if (!AUDIO.has(file.type.split(";")[0])) return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  if (file.size > 25 * 1024 * 1024) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const result = await transcribeVideo(Buffer.from(await file.arrayBuffer()), file.type);
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.error === "missing_tool" ? 503 : 422 });
  return NextResponse.json({ transcript: result.text });
}

import { NextResponse } from "next/server";
import { transcribeVideo } from "@/lib/stt/whisperAdapter";
import { summarizeVideo, type VideoSummary } from "@/lib/tickets/videoSummary";

export const runtime = "nodejs";
export const maxDuration = 300;
const MAX = 25 * 1024 * 1024;
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm", "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-m4a"]);

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 });
  if (!VIDEO_TYPES.has(file.type.split(";")[0])) return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  if (file.size > MAX) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const lang = form.get("lang") === "ru" ? "ru" : "ro";

  const t = await transcribeVideo(Buffer.from(await file.arrayBuffer()), file.type);
  if (t.error === "missing_tool")
    return NextResponse.json({ error: "whisper_missing", engine: t.engine }, { status: 503 });
  if (t.error === "no_audio") return NextResponse.json({ error: "no_audio" }, { status: 422 });
  if (t.error === "could_not_run") return NextResponse.json({ error: "transcribe_failed" }, { status: 500 });

  const s: VideoSummary = await summarizeVideo(t.text, { lat: t.lat, lng: t.lng }, lang);
  return NextResponse.json({
    transcript: t.text,
    description: s.description,
    location: s.location,
    category: s.category,
    lat: t.lat,
    lng: t.lng,
    ai: s.ai,
    engine: { transcript: t.engine, summary: s.engine },
  });
}
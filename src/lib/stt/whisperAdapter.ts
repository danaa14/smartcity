import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { DATA_DIR } from "../store/db";

const run = promisify(execFile);

const BIN_DIRS = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];
async function which(...names: string[]): Promise<string | null> {
  const want = names.find((n) => process.env[`${n.toUpperCase()}_PATH`]);
  if (want) return process.env[`${want.toUpperCase()}_PATH`]!;
  for (const d of BIN_DIRS) {
    for (const n of names) {
      try {
        await fs.access(path.join(/*turbopackIgnore: true*/ d, n));
        return path.join(/*turbopackIgnore: true*/ d, n);
      } catch {}
    }
  }
  return null;
}

export const WHISPER_MODEL = path.join(process.cwd(), "ocr", "whisper", "ggml-base.bin");
export interface Transcript {
  text: string;
  engine: string;
  lat?: number;
  lng?: number;
  /** null when a tool is missing; "no_audio"/"failed" when the video could not be decoded. */
  error: "missing_tool" | "no_audio" | "could_not_run" | null;
}

/** Audio + GPS metadata out of a video file. Everything runs locally in a temp dir. */
export async function transcribeVideo(data: Buffer, mime: string): Promise<Transcript> {
  const ffmpeg = await which("ffmpeg");
  const ffprobe = await which("ffprobe");
  const whisper = await which("whisper-cli", "whisper");
  if (!ffmpeg || !ffprobe || !whisper) return { text: "", engine: "", error: "missing_tool" };
  if (!(await fs.access(WHISPER_MODEL).then(() => true, () => false))) return { text: "", engine: "", error: "missing_tool" };

  const work = path.join(DATA_DIR, "work", randomBytes(6).toString("hex"));
  await fs.mkdir(work, { recursive: true });
  try {
    const ext = mime.split("/")[1] === "quicktime" ? "mov" : "mp4";
    const inFile = path.join(work, `in.${ext}`);
    await fs.writeFile(inFile, data);
    const gps = await readGps(ffprobe, inFile);
    const wav = path.join(work, "audio.wav");
    try {
      await run(ffmpeg, ["-y", "-i", inFile, "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", wav], { maxBuffer: 20 * 1024 * 1024 });
    } catch {
      return { text: "", engine: "ffmpeg", ...gps, error: "no_audio" };
    }
    const out = path.join(work, "out");
    try {
      await run(whisper, ["-m", WHISPER_MODEL, "-f", wav, "-l", "auto", "-nt", "-otxt", "-of", out], { maxBuffer: 20 * 1024 * 1024, timeout: 600_000 });
    } catch {
      return { text: "", engine: "whisper", ...gps, error: "could_not_run" };
    }
    const text = await fs.readFile(`${out}.txt`, "utf8").catch(() => "");
    return { text: text.trim(), engine: "Whisper (local)", ...gps, error: null };
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
}

/** QuickTime GPS tag, e.g. "+47.0131+028.8244/" → lat/lng. */
async function readGps(ffprobe: string, file: string): Promise<{ lat?: number; lng?: number }> {
  try {
    const { stdout } = await run(ffprobe, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], { maxBuffer: 20 * 1024 * 1024 });
    const j = JSON.parse(stdout) as { format?: { tags?: Record<string, string> }; streams?: { tags?: Record<string, string> }[] };
    const loc = j.format?.tags?.location ?? j.streams?.find((s) => s.tags?.location)?.tags?.location;
    const m = /([+-]\d{2}\.\d+)\s*([+-]\d{3}\.\d+)/.exec(loc ?? "");
    if (!m) return {};
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : {};
  } catch {
    return {};
  }
}
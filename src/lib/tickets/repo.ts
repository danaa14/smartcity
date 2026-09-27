import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { collection, UPLOAD_DIR } from "../store/db";
import type { Ticket, TicketMedia } from "./types";
import { mediaMime } from "./media";

export const tickets = collection<Ticket>("tickets");

export function newTicketId(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `SES-${ymd}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

const ALLOWED: Record<string, TicketMedia["kind"]> = {
  "image/jpeg": "photo", "image/png": "photo", "image/webp": "photo",
  "video/mp4": "video", "video/quicktime": "video", "video/webm": "video",
  "audio/webm": "audio", "audio/ogg": "audio", "audio/mpeg": "audio", "audio/mp4": "audio", "audio/wav": "audio", "audio/x-m4a": "audio",
};
export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

export async function validateMedia(file: File): Promise<string | null> {
  if (file.size > MAX_MEDIA_BYTES) return "too_large";
  const mime = mediaMime(file);
  if (!ALLOWED[mime]) return "unsupported_type";
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length));
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => bytes[i] === v);
  const webp = ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP";
  const webm = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  const ogg = ascii(0, 4) === "OggS";
  const wav = ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE";
  const mp4 = ascii(4, 4) === "ftyp";
  const mp3 = ascii(0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  const valid = mime === "image/jpeg" ? jpeg
    : mime === "image/png" ? png
    : mime === "image/webp" ? webp
    : mime === "video/webm" || mime === "audio/webm" ? webm
    : mime === "audio/ogg" ? ogg
    : mime === "audio/wav" ? wav
    : mime === "audio/mpeg" ? mp3
    : (mime === "video/mp4" || mime === "video/quicktime" || mime === "audio/mp4" || mime === "audio/x-m4a") ? mp4
    : false;
  if (!valid) return "unsupported_type";
  return null;
}

export async function saveMedia(ticketId: string, file: File): Promise<TicketMedia | { error: string }> {
  const mime = mediaMime(file);
  const kind = ALLOWED[mime];
  if (!kind) return { error: "unsupported_type" };
  if (file.size > MAX_MEDIA_BYTES) return { error: "too_large" };
  const ext = mime.split("/")[1].replace("quicktime", "mov").replace("mpeg", "mp3").replace("x-m4a", "m4a");
  const name = `${ticketId}-${randomBytes(4).toString("hex")}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return { kind, file: name, mime, bytes: file.size };
}

export async function deleteTicket(id: string): Promise<boolean> {
  const t = await tickets.get(id);
  if (!t) return false;
  for (const m of t.media) await fs.rm(path.join(UPLOAD_DIR, path.basename(m.file)), { force: true });
  return tickets.remove(id);
}

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { collection, UPLOAD_DIR } from "../store/db";
import type { Ticket, TicketMedia } from "./types";

export const tickets = collection<Ticket>("tickets");

export function newTicketId(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `DEMO-${ymd}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

const ALLOWED: Record<string, TicketMedia["kind"]> = {
  "image/jpeg": "photo", "image/png": "photo", "image/webp": "photo", "image/heic": "photo",
  "video/mp4": "video", "video/quicktime": "video", "video/webm": "video",
  "audio/webm": "audio", "audio/ogg": "audio", "audio/mpeg": "audio", "audio/mp4": "audio", "audio/wav": "audio", "audio/x-m4a": "audio",
};
export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

export async function saveMedia(ticketId: string, file: File): Promise<TicketMedia | { error: string }> {
  const mime = file.type.split(";")[0];
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

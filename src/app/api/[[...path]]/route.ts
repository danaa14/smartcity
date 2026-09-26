import { NextResponse } from "next/server";
import * as ask from "@/server/api/ask";
import * as feedback from "@/server/api/feedback";
import * as inventory from "@/server/api/inventory";
import * as ocr from "@/server/api/ocr";
import * as ocrAnalyze from "@/server/api/ocr-analyze";
import * as reportSuggest from "@/server/api/report-suggest";
import * as reportAudio from "@/server/api/report-audio";
import * as reportVideo from "@/server/api/report-video";
import * as review from "@/server/api/review";
import * as scanReview from "@/server/api/scan-review";
import * as tickets from "@/server/api/tickets";
import * as ticketsId from "@/server/api/tickets-id";
import * as ticketsIdMediaFile from "@/server/api/tickets-id-media-file";
import * as voice from "@/server/api/voice";

export const runtime = "nodejs";
// Single function serves every API route (Vercel Hobby caps functions at 12).
// Keep under the plan's duration ceiling; long media/OCR jobs stream progress.
export const maxDuration = 60;

type Ctx = { params: Promise<Record<string, string>> };
type Handler = (req: Request, ctx: Ctx) => Promise<Response> | Response;

const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 });

function pick(segments: string[], method: string): Handler | null {
  const call = (fn: unknown): Handler | null =>
    typeof fn === "function" ? (fn as Handler) : null;
  const [a, b, c, d] = segments;
  if (a === "ask" && !b) return method === "POST" ? call(ask.POST) : null;
  if (a === "voice" && b === "ready" && !c) return method === "GET" ? call(voice.ready) : null;
  if (a === "voice" && b === "token" && !c) return method === "POST" ? call(voice.token) : null;
  if (a === "voice" && b === "search" && !c) return method === "POST" ? call(voice.search) : null;
  if (a === "feedback" && !b) return method === "POST" ? call(feedback.POST) : null;
  if (a === "inventory" && !b) return method === "GET" ? call(inventory.GET) : null;
  if (a === "ocr" && !b) return method === "POST" ? call(ocr.POST) : null;
  if (a === "ocr" && b === "analyze" && !c) return method === "POST" ? call(ocrAnalyze.POST) : null;
  if (a === "report" && b === "suggest" && !c) return method === "POST" ? call(reportSuggest.POST) : null;
  if (a === "report" && b === "audio" && !c) return method === "POST" ? call(reportAudio.POST) : null;
  if (a === "report" && b === "video" && !c) return method === "POST" ? call(reportVideo.POST) : null;
  if (a === "review" && !b) return method === "PATCH" ? call(review.PATCH) : null;
  if (a === "scan" && b === "review" && !c) return method === "POST" ? call(scanReview.POST) : null;
  if (a === "tickets" && !b) {
    if (method === "GET") return call(tickets.GET);
    if (method === "POST") return call(tickets.POST);
    return null;
  }
  if (a === "tickets" && b && !c) {
    if (method === "GET") return call(ticketsId.GET);
    if (method === "DELETE") return call(ticketsId.DELETE);
    return null;
  }
  if (a === "tickets" && b && c === "media" && d && segments.length === 4) {
    if (method === "GET") return call(ticketsIdMediaFile.GET);
    return null;
  }
  return null;
}

async function dispatch(req: Request, segments: string[] | undefined) {
  const fn = pick(segments ?? [], req.method);
  if (!fn) return notFound();
  const [a, b, c, d] = segments ?? [];
  const params: Record<string, string> = {};
  if (a === "tickets" && b) params.id = b;
  if (a === "tickets" && c === "media" && d) params.file = d;
  return fn(req, { params: Promise.resolve(params) });
}

export function GET(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return ctx.params.then((p) => dispatch(req, p.path));
}

export function POST(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return ctx.params.then((p) => dispatch(req, p.path));
}

export function PATCH(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return ctx.params.then((p) => dispatch(req, p.path));
}

export function DELETE(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return ctx.params.then((p) => dispatch(req, p.path));
}

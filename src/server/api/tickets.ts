import { NextResponse } from "next/server";
import { CATEGORIES, SERVICES, type ServiceId, type CategoryId, type Ticket, type TicketMedia } from "@/lib/tickets/types";
import { newTicketId, saveMedia, validateMedia, tickets } from "@/lib/tickets/repo";
import { getSubmissionAdapter } from "@/lib/tickets/adapter";
import { RECIPIENTS, type RecipientId } from "@/lib/tickets/recipients";
import { gpsFromExif } from "@/lib/tickets/exif";

export const runtime = "nodejs";
const CAT_IDS = new Set(CATEGORIES.map((c) => c.id));

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const s = (k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string).trim() : "");

  const description = s("description").slice(0, 1000);
  const title = (s("title") || description).slice(0, 100);
  const service = (s("service") || "city") as ServiceId;
  const transcript = s("transcript").slice(0, 1000);
  const city = (s("city") || "Chișinău").slice(0, 80);
  const locationInput = s("location").slice(0, 300);
  const category = s("category") as CategoryId;
  const mediaFiles = form.getAll("media").filter((f): f is File => f instanceof File && f.size > 0);
  const recipient = s("recipient") || (service === "city" ? "city_hall" : service);
  const links = s("links").split(/\n/).map(value => value.trim()).filter(Boolean);
  const validLinks = links.length <= 5 && links.every(value => { try { return value.length <= 1000 && ["https:", "http:"].includes(new URL(value).protocol); } catch { return false; } });
  const errors: Record<string, string> = {};
  if (!SERVICES.some(item => item.id === service)) errors.service = "invalid_service";
  if (title.length < 3) errors.title = "title_short";
  if (!RECIPIENTS.some(r => r.id === recipient)) errors.recipient = "invalid_recipient";
  if (!validLinks) errors.links = "invalid_links";
  if (mediaFiles.length > 4) errors.media = "too_many_files";
  for (const file of mediaFiles) {
    const issue = validateMedia(file); if (issue) errors.media = issue;
  }
  if (!CAT_IDS.has(category)) errors.category = "category_missing";
  if (s("confirm") !== "yes") errors.confirm = "not_confirmed";
  const photoFile = mediaFiles.find((f) => f.type.startsWith("image/"));
  const photoGps = photoFile?.type === "image/jpeg" ? await photoFile.arrayBuffer().then(gpsFromExif).catch(() => null) : null;
  const location = locationInput || (photoGps ? `GPS ${photoGps.lat.toFixed(5)}, ${photoGps.lng.toFixed(5)}` : "");

  if (Object.keys(errors).length) return NextResponse.json({ error: "validation", fields: errors }, { status: 422 });

  const id = newTicketId();
  const media: TicketMedia[] = [];
  for (const f of mediaFiles) {
    if (f.size === 0) continue;
    const saved = await saveMedia(id, f);
    if ("error" in saved) return NextResponse.json({ error: "media", reason: saved.error, name: f.name }, { status: 422 });
    media.push(saved);
  }

  const lat = s("lat") ? Number(s("lat")) : photoGps?.lat;
  const lng = s("lng") ? Number(s("lng")) : photoGps?.lng;
  const suggested = s("categorySuggested") as CategoryId;
  const now = new Date().toISOString();
  const adapter = getSubmissionAdapter();

  const ticket: Ticket = {
    id,
    createdAt: now,
    channel: s("channel") === "phone-demo" ? "phone-demo" : "web",
    lang: s("lang") === "ru" ? "ru" : "ro",
    category,
    title,
    service,
    transcript,
    recipient: recipient as RecipientId,
    links,
    city,
    status: "active",
    categorySuggested: CAT_IDS.has(suggested) ? suggested : null,
    categoryChangedByUser: CAT_IDS.has(suggested) && suggested !== category,
    description,
    descriptionSuggested: s("descriptionSuggested") || null,
    location: { text: location, ...(Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat!) <= 90 && Math.abs(lng!) <= 180 ? { lat, lng } : {}), source: s("locationSource") === "device" ? "device" : photoGps || s("locationSource") === "photo" ? "photo" : "manual" },
    media,
    contactConsent: false,
    submission: { adapter: adapter.id, submitted: false, externalId: null, note: "" },
    events: [{ at: now, kind: "created_local" }],
  };
  const res = await adapter.submit(ticket);
  ticket.submission = { adapter: adapter.id, submitted: res.submitted, externalId: null, note: res.note };
  await tickets.insert(ticket);
  if (req.headers.get("accept")?.includes("text/html")) return NextResponse.redirect(new URL(`/tichet/${id}?nou=1`, req.url), 303);
  return NextResponse.json({ id });
}

export async function GET() {
  const all = await tickets.all();
  return NextResponse.json(all.map((t) => ({ id: t.id, createdAt: t.createdAt, category: t.category })));
}

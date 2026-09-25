import { NextResponse } from "next/server";
import { CATEGORIES, type CategoryId, type Ticket, type TicketMedia } from "@/lib/tickets/types";
import { newTicketId, saveMedia, tickets } from "@/lib/tickets/repo";
import { getSubmissionAdapter } from "@/lib/tickets/adapter";

export const runtime = "nodejs";
const CAT_IDS = new Set(CATEGORIES.map((c) => c.id));

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const s = (k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string).trim() : "");

  const description = s("description").slice(0, 1000);
  const location = s("location").slice(0, 300);
  const category = s("category") as CategoryId;
  const errors: Record<string, string> = {};
  if (description.length < 5) errors.description = "description_short";
  if (location.length < 3) errors.location = "location_missing";
  if (!CAT_IDS.has(category)) errors.category = "category_missing";
  if (s("confirm") !== "yes") errors.confirm = "not_confirmed";
  if (Object.keys(errors).length) return NextResponse.json({ error: "validation", fields: errors }, { status: 422 });

  const id = newTicketId();
  const media: TicketMedia[] = [];
  for (const f of form.getAll("media")) {
    if (!(f instanceof File) || f.size === 0) continue;
    const saved = await saveMedia(id, f);
    if ("error" in saved) return NextResponse.json({ error: "media", reason: saved.error, name: f.name }, { status: 422 });
    media.push(saved);
  }

  const lat = Number(s("lat"));
  const lng = Number(s("lng"));
  const suggested = s("categorySuggested") as CategoryId;
  const now = new Date().toISOString();
  const adapter = getSubmissionAdapter();

  const ticket: Ticket = {
    id,
    createdAt: now,
    channel: s("channel") === "phone-demo" ? "phone-demo" : "web",
    lang: s("lang") === "ru" ? "ru" : "ro",
    category,
    categorySuggested: CAT_IDS.has(suggested) ? suggested : null,
    categoryChangedByUser: CAT_IDS.has(suggested) && suggested !== category,
    description,
    descriptionSuggested: s("descriptionSuggested") || null,
    location: { text: location, ...(Number.isFinite(lat) && Number.isFinite(lng) && s("lat") ? { lat, lng } : {}), source: s("locationSource") === "device" ? "device" : "manual" },
    media,
    contactConsent: false,
    submission: { adapter: adapter.id, submitted: false, externalId: null, note: "" },
    events: [{ at: now, kind: "created_local" }],
  };
  const res = await adapter.submit(ticket);
  ticket.submission = { adapter: adapter.id, submitted: res.submitted, externalId: null, note: res.note };
  await tickets.insert(ticket);
  return NextResponse.json({ id });
}

export async function GET() {
  const all = await tickets.all();
  return NextResponse.json(all.map((t) => ({ id: t.id, createdAt: t.createdAt, category: t.category })));
}

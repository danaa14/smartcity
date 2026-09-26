import { NextResponse } from "next/server";
import { reviews, type ReviewState } from "@/lib/feedback";
import { staffSession } from "@/lib/staff/auth";

const STATES = new Set<ReviewState>(["new", "in_review", "resolved", "dismissed"]);

export async function PATCH(req: Request) {
  if ((await staffSession()) !== "ok") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { id?: string; state?: ReviewState } | null;
  if (!b?.id || !b.state || !STATES.has(b.state)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const item = await reviews.update(b.id, { state: b.state });
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(item);
}

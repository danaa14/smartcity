import { NextResponse } from "next/server";
import { deleteTicket, tickets } from "@/lib/tickets/repo";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const t = await tickets.get(id);
  return t ? NextResponse.json(t) : NextResponse.json({ error: "not_found" }, { status: 404 });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ok = await deleteTicket(id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null) as { status?: unknown } | null;
  if (body?.status !== "active" && body?.status !== "done") return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  const ticket = await tickets.get(id);
  if (!ticket) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const status = body.status;
  await tickets.update(id, { status, events: [...ticket.events, { at: new Date().toISOString(), kind: status === "done" ? "marked_done" : "reopened" }] });
  return NextResponse.json({ id, status });
}

import { NextResponse } from "next/server";
import { deleteTicket, tickets } from "@/lib/tickets/repo";

export async function GET(_req: Request, ctx: RouteContext<"/api/tickets/[id]">) {
  const { id } = await ctx.params;
  const t = await tickets.get(id);
  return t ? NextResponse.json(t) : NextResponse.json({ error: "not_found" }, { status: 404 });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/tickets/[id]">) {
  const { id } = await ctx.params;
  const ok = await deleteTicket(id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}

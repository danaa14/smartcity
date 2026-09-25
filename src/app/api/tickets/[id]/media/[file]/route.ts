import { promises as fs } from "node:fs";
import path from "node:path";
import { tickets } from "@/lib/tickets/repo";
import { UPLOAD_DIR } from "@/lib/store/db";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: RouteContext<"/api/tickets/[id]/media/[file]">) {
  const { id, file } = await ctx.params;
  const t = await tickets.get(id);
  const m = t?.media.find((x) => x.file === path.basename(file));
  if (!m) return new Response("not found", { status: 404 });
  const buf = await fs.readFile(path.join(UPLOAD_DIR, m.file)).catch(() => null);
  if (!buf) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(buf), { headers: { "content-type": m.mime, "cache-control": "private, no-store" } });
}

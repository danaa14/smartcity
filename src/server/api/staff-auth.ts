import { NextResponse } from "next/server";
import { STAFF_COOKIE, checkPassword, clearFailures, isLocked, issueToken, recordFailure, staffPassword } from "@/lib/staff/auth";

export const runtime = "nodejs";

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

export async function POST(req: Request) {
  const password = staffPassword();
  if (!password) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const ip = clientIp(req);
  if (isLocked(ip)) return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });

  const body = await req.json().catch(() => null);
  if (!checkPassword((body as { password?: unknown } | null)?.password, password)) {
    recordFailure(ip);
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  clearFailures(ip);
  const token = issueToken(password);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(STAFF_COOKIE, token.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: token.maxAge,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(STAFF_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return res;
}

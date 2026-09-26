import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const STAFF_COOKIE = "pefir_staff";
const TTL_MS = 8 * 60 * 60 * 1000;

/**
 * Key material comes from the password alone, never a per-process random: the API route
 * and the page are distinct module graphs (distinct instances once deployed), so a random
 * salt would sign with one key and verify with another. Rotating the password invalidates
 * every outstanding token, which is the behaviour we want anyway.
 */
const CONTEXT = "pefir-staff-session-v1";

export function staffPassword(): string | null {
  const raw = process.env.STAFF_PASSWORD;
  return raw && raw.length >= 8 ? raw : null;
}

function sign(expiry: number, password: string): string {
  return createHmac("sha256", `${CONTEXT}:${password}`).update(String(expiry)).digest("hex");
}

function equal(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function issueToken(password: string): { value: string; maxAge: number } {
  const expiry = Date.now() + TTL_MS;
  return { value: `${expiry}.${sign(expiry, password)}`, maxAge: Math.floor(TTL_MS / 1000) };
}

export function verifyToken(token: string | undefined, password: string): boolean {
  if (!token) return false;
  const cut = token.indexOf(".");
  if (cut < 1) return false;
  const expiry = Number(token.slice(0, cut));
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;
  return equal(token.slice(cut + 1), sign(expiry, password));
}

export function checkPassword(candidate: unknown, password: string): boolean {
  return typeof candidate === "string" && equal(candidate, password);
}

/** `unset` means no STAFF_PASSWORD is configured — the back office stays closed. */
export async function staffSession(): Promise<"ok" | "denied" | "unset"> {
  const password = staffPassword();
  if (!password) return "unset";
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  return verifyToken(token, password) ? "ok" : "denied";
}

const attempts = new Map<string, { count: number; until: number }>();

/** Coarse brute-force brake: 8 tries per IP per 10 minutes, in memory only. */
export function throttle(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.until < now) {
    attempts.set(ip, { count: 1, until: now + 10 * 60 * 1000 });
    return true;
  }
  rec.count += 1;
  return rec.count <= 8;
}

export function clearThrottle(ip: string) {
  attempts.delete(ip);
}

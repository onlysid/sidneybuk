import "server-only";
import { cookies, headers } from "next/headers";
import { same, sign } from "./secrets";

// There is one person who can sign in: me.
const COOKIE = "admin";
const DAYS = 30;

export async function signIn(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length < 8 || !same(password, expected)) return false;
  const until = String(Date.now() + DAYS * 86400000);
  // The cookie is marked "https only" whenever the site is being reached over https (directly or through a reverse proxy).
  const h = await headers();
  const https = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim() === "https" || (process.env.SITE_URL ?? "").startsWith("https://");
  (await cookies()).set(COOKIE, `${until}.${sign(until)}`, { httpOnly: true, sameSite: "lax", secure: https && process.env.INSECURE_COOKIES !== "1", path: "/", maxAge: DAYS * 86400 });
  return true;
}
export async function signOut() {
  (await cookies()).delete(COOKIE);
}
export async function signedIn() {
  const value = (await cookies()).get(COOKIE)?.value ?? "";
  const [until, mark] = value.split(".");
  if (!until || !mark) return false;
  try {
    return same(mark, sign(until)) && Number(until) > Date.now();
  } catch {
    return false;
  }
}

// Used at the top of every admin API route.
export async function guard(request: Request) {
  if (!(await signedIn())) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    const host = (await headers()).get("x-forwarded-host") ?? (await headers()).get("host");
    if (origin && host && new URL(origin).host !== host) return Response.json({ error: "Wrong origin" }, { status: 403 });
  }
  return null;
}

// A few wrong passwords in a row and the door stays shut for a while.
const tries = new Map<string, { count: number; until: number }>();
export function tooMany(who: string) {
  const t = tries.get(who);
  return !!t && t.count >= 6 && t.until > Date.now();
}
export function wrong(who: string) {
  const t = tries.get(who);
  const fresh = !t || t.until < Date.now();
  tries.set(who, { count: fresh ? 1 : t.count + 1, until: Date.now() + 10 * 60000 });
}
export const right = (who: string) => tries.delete(who);

// The address the site is being reached at, as the visitor's browser sees it (behind a reverse proxy too).
export async function siteOrigin(request: Request) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(request.url).host;
  // A proxy that adds HTTPS says so in x-forwarded-proto.
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || "http";
  return `${proto}://${host}`;
}

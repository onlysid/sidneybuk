import { NextResponse, type NextRequest } from "next/server";

// A limit on how often one address may call the site's APIs, so a script hammering them gets a 429 rather
// than a share of the server. (Real floods are stopped in front of the server: see the README.)
//
//   /api/admin/session POST   the sign-in: 10 a minute per address, on top of the ten-minute lock in auth.ts
//   /api/location, /api/health POST   the phone's updates: 30 a minute
//   anything else under /api  300 a minute
//
// Counted in memory per running copy of the site; the counts are forgotten when it restarts, which is fine.

type Bucket = { n: number; at: number };
const seen = new Map<string, Bucket>();
let sweep = 0;

function limited(key: string, max: number, windowMs: number) {
  const now = Date.now();
  // Now and then, forget addresses not seen for a while, so the map cannot grow without bound.
  if (now - sweep > 60000) {
    sweep = now;
    for (const [k, b] of seen) if (now - b.at > windowMs) seen.delete(k);
  }
  const b = seen.get(key);
  if (!b || now - b.at > windowMs) {
    seen.set(key, { n: 1, at: now });
    return false;
  }
  b.n += 1;
  return b.n > max;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/")) return NextResponse.next();
  const who = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "local";
  const post = request.method !== "GET" && request.method !== "HEAD";
  let max = 300, window = 60000, kind = "api";
  if (pathname === "/api/admin/session" && post) (max = 10), (kind = "signin");
  else if ((pathname === "/api/location" || pathname === "/api/health") && post) (max = 30), (kind = "phone");
  if (limited(`${kind}:${who}`, max, window)) {
    return NextResponse.json({ error: "Too many requests. Wait a minute and try again." }, { status: 429, headers: { "Retry-After": "60" } });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };

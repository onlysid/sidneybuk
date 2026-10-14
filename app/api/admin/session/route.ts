import { headers } from "next/headers";
import { right, signedIn, signIn, signOut, tooMany, wrong } from "@/lib/server/auth";
import { hasDatabase } from "@/lib/server/db";

export const dynamic = "force-dynamic";

// Am I signed in? (Also says whether there is a database, so the admin area can explain itself if not.)
export async function GET() {
  return Response.json({ signedIn: await signedIn(), database: hasDatabase(), passwordSet: (process.env.ADMIN_PASSWORD ?? "").length >= 8 });
}
// Sign in.
export async function POST(request: Request) {
  const who = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (tooMany(who)) return Response.json({ error: "Too many wrong passwords. Wait ten minutes and try again." }, { status: 429 });
  const { password } = (await request.json().catch(() => ({}))) as { password?: string };
  if (!(await signIn(String(password ?? "")))) {
    wrong(who);
    return Response.json({ error: "That is not the password." }, { status: 401 });
  }
  right(who);
  return Response.json({ signedIn: true });
}
// Sign out.
export async function DELETE() {
  await signOut();
  return Response.json({ signedIn: false });
}

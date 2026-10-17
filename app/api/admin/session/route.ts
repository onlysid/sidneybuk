import { headers } from "next/headers";
import { grant, halfway, right, rightPassword, signedIn, signOut, tooMany, wrong } from "@/lib/server/auth";
import { hasDatabase } from "@/lib/server/db";
import { listPasskeys, twoStep } from "@/lib/server/passkeys";

export const dynamic = "force-dynamic";

// Am I signed in? (Also says whether there is a database, so the admin area can explain itself if not, and
// whether a passkey can be offered instead of the password.)
export async function GET() {
  // "passkeys" here means a passkey alone can open the door; with the second step on, the password comes first.
  const alone = hasDatabase() ? await Promise.all([listPasskeys(), twoStep()]).then(([l, two]) => l.length > 0 && !two, () => false) : false;
  return Response.json({ signedIn: await signedIn(), database: hasDatabase(), passwordSet: (process.env.ADMIN_PASSWORD ?? "").length >= 8, passkeys: alone });
}
// Sign in.
export async function POST(request: Request) {
  const who = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (tooMany(who)) return Response.json({ error: "Too many wrong passwords. Wait ten minutes and try again." }, { status: 429 });
  const { password } = (await request.json().catch(() => ({}))) as { password?: string };
  if (!rightPassword(String(password ?? ""))) {
    wrong(who);
    return Response.json({ error: "That is not the password." }, { status: 401 });
  }
  right(who);
  // With "password and passkey" on (and a passkey to use), the password is only the first half.
  if (hasDatabase() && (await twoStep()) && (await listPasskeys()).length > 0) {
    await halfway();
    return Response.json({ signedIn: false, needPasskey: true });
  }
  await grant();
  return Response.json({ signedIn: true });
}
// Sign out.
export async function DELETE() {
  await signOut();
  return Response.json({ signedIn: false });
}

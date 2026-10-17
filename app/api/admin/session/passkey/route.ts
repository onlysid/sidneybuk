import { grant, isHalfway } from "@/lib/server/auth";
import { hasDatabase } from "@/lib/server/db";
import { authenticationOptions, finishAuthentication, twoStep } from "@/lib/server/passkeys";

export const dynamic = "force-dynamic";

// Signing in with a passkey. GET hands the browser a challenge; POST checks its answer and lets it in.
export async function GET() {
  if (!hasDatabase()) return Response.json({ error: "No database" }, { status: 503 });
  try {
    return Response.json(await authenticationOptions());
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
export async function POST(request: Request) {
  if (!hasDatabase()) return Response.json({ error: "No database" }, { status: 503 });
  try {
    const answer = await request.json();
    // With "password and passkey" on, the password must have been given first (in the last five minutes).
    if ((await twoStep()) && !(await isHalfway())) return Response.json({ error: "The password comes first." }, { status: 401 });
    const used = await finishAuthentication(answer);
    await grant();
    return Response.json({ signedIn: true, used: used.name });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 401 });
  }
}

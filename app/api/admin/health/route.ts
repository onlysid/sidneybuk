import { signedIn } from "@/lib/server/auth";
import { getHealth } from "@/lib/server/sport";

export const dynamic = "force-dynamic";

// My health numbers, every measure and every day. Only for me: nobody who is not signed in is given them.
export async function GET() {
  if (!(await signedIn())) return Response.json({ error: "Sign in first" }, { status: 401 });
  return Response.json({ health: await getHealth() });
}

import { signedIn, siteOrigin } from "@/lib/server/auth";
import { same, sign } from "@/lib/server/secrets";
import { finishConnect, sync } from "@/lib/server/sport";

export const dynamic = "force-dynamic";

// Step two: Strava sends me back here with a one-time code, which is swapped for the tokens.
export async function GET(request: Request) {
  const origin = await siteOrigin(request);
  const back = (said: string) => Response.redirect(`${origin}/admin/connections?strava=${encodeURIComponent(said)}`);
  if (!(await signedIn())) return Response.redirect(`${origin}/admin`);
  const p = new URL(request.url).searchParams;
  const [when, mark] = (p.get("state") ?? "").split(".");
  let fair = false;
  try {
    fair = !!when && !!mark && same(mark, sign(`strava:${when}`)) && Date.now() - Number(when) < 15 * 60000;
  } catch {}
  if (!fair) return back("That took too long, or did not start here. Press Connect again.");
  if (p.get("error") || !p.get("code")) return back("Strava was not connected: permission was not given.");
  if (!(p.get("scope") ?? "").includes("activity:read")) return back("Strava was connected without permission to read activities. Press Connect again and leave that box ticked.");
  try {
    await finishConnect(p.get("code")!);
  } catch (err) {
    return back((err as Error).message);
  }
  // Start bringing activities in, without making me wait for it.
  sync(true).catch((err) => console.error("[strava]", (err as Error).message));
  return back("connected");
}

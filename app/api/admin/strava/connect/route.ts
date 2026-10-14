import { signedIn, siteOrigin } from "@/lib/server/auth";
import { sign } from "@/lib/server/secrets";
import { authorizeUrl } from "@/lib/server/sport";

export const dynamic = "force-dynamic";

// Step one of connecting Strava: send me to Strava to say yes. Strava then sends me back to …/callback.
export async function GET(request: Request) {
  const origin = await siteOrigin(request);
  if (!(await signedIn())) return Response.redirect(`${origin}/admin`);
  try {
    const now = String(Date.now());
    return Response.redirect(await authorizeUrl(`${origin}/api/admin/strava/callback`, `${now}.${sign(`strava:${now}`)}`));
  } catch (err) {
    return Response.redirect(`${origin}/admin/connections?strava=${encodeURIComponent((err as Error).message)}`);
  }
}

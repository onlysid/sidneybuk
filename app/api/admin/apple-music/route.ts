import { guard } from "@/lib/server/auth";
import { developerToken, lastPlayed } from "@/lib/server/apple-music";
import { getKey } from "@/lib/server/store";

export const dynamic = "force-dynamic";

// For the Connections screen. GET says how far along Apple Music is and hands over the developer token, which
// the "Connect Apple Music" button needs to ask Apple who I am. (That token is not a secret in the way the
// private key is: Apple's own player puts it in the page of every site that uses it.)
export async function GET(request: Request) {
  const stop = await guard(request);
  if (stop) return stop;
  let developer = "", error = "";
  try {
    developer = await developerToken();
  } catch (err) {
    error = (err as Error).message;
  }
  const connected = !!(await getKey("APPLE_MUSIC_USER_TOKEN"));
  let works: boolean | null = null, track: { title: string; artist: string } | null = null, status = 0;
  if (developer && connected) {
    const r = await lastPlayed().catch(() => null);
    works = !!r?.ok;
    status = r?.status ?? 0;
    track = r?.track ?? null;
  }
  return Response.json({ developerToken: developer, hasKey: !!developer, connected, works, status, track, error });
}

// What is playing right now, for the bar at the bottom of every page.
//
// Three sources. Set the keys for the ones you use in the admin area under Connections (or as environment
// variables of the same names); you can set more than one.
//   Spotify:  SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN
//             (refresh token needs the user-read-currently-playing and user-read-recently-played scopes)
//   Apple Music: APPLE_MUSIC_TEAM_ID, APPLE_MUSIC_KEY_ID, APPLE_MUSIC_PRIVATE_KEY, APPLE_MUSIC_USER_TOKEN
//             Needs an Apple Developer account. The site signs its own developer token from the MusicKit key
//             (lib/server/apple-music.ts); the user token is fetched by the Connect button under Connections
//             and lasts about six months.
//             Apple only offers "recently played", never "playing right now", so this shows the last track.
//   Last.fm:  LASTFM_USER, LASTFM_API_KEY
//             The simpler route for Apple Music: scrobble it to Last.fm and use this, which does know
//             what is playing right now.
// The order: whatever Spotify or Last.fm says is playing now, then the most recent track from Last.fm,
// Spotify, and last Apple Music.
// With none set, it answers { configured: false } and the bar says nothing is connected.
import { lastPlayed } from "@/lib/server/apple-music";
import { hasDatabase, query } from "@/lib/server/db";
import { getKey } from "@/lib/server/store";

export const dynamic = "force-dynamic";

type Track = { configured: true; playing: boolean; title: string; artist: string; url: string; art: string; source: "Spotify" | "Apple Music" | "Last.fm" };

async function spotify(): Promise<Track | null> {
  const [id, secret, refresh] = await Promise.all([getKey("SPOTIFY_CLIENT_ID"), getKey("SPOTIFY_CLIENT_SECRET"), getKey("SPOTIFY_REFRESH_TOKEN")]);
  if (!id || !secret || !refresh) return null;
  const token = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }),
    cache: "no-store",
  }).then((r) => r.json());
  const headers = { Authorization: `Bearer ${token.access_token}` };
  type Item = { name: string; artists: { name: string }[]; external_urls: { spotify: string }; album: { images: { url: string }[] } };
  const shape = (item: Item, playing: boolean): Track => ({ configured: true, playing, title: item.name, artist: item.artists.map((a) => a.name).join(", "), url: item.external_urls.spotify, art: item.album.images.at(-1)?.url ?? "", source: "Spotify" });
  const now = await fetch("https://api.spotify.com/v1/me/player/currently-playing", { headers, cache: "no-store" });
  if (now.status === 200) {
    const body = await now.json();
    if (body?.item?.name) return shape(body.item, !!body.is_playing);
  }
  const recent = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=1", { headers, cache: "no-store" }).then((r) => r.json());
  const last = recent?.items?.[0]?.track;
  return last ? shape(last, false) : null;
}

async function lastfm(): Promise<Track | null> {
  const [user, key] = await Promise.all([getKey("LASTFM_USER"), getKey("LASTFM_API_KEY")]);
  if (!user || !key) return null;
  const body = await fetch(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(user)}&api_key=${key}&format=json&limit=1`, { cache: "no-store" }).then((r) => r.json());
  const t = body?.recenttracks?.track?.[0];
  if (!t) return null;
  return { configured: true, playing: t["@attr"]?.nowplaying === "true", title: t.name, artist: t.artist?.["#text"] ?? "", url: t.url, art: t.image?.[1]?.["#text"] ?? "", source: "Last.fm" };
}

async function appleMusic(): Promise<Track | null> {
  const r = await lastPlayed();
  return r.track ? { configured: true, playing: false, ...r.track, source: "Apple Music" } : null;
}

// A slow or failing source counts as having nothing to say, and none is waited on for more than six seconds.
const quiet = <T,>(p: Promise<T | null>) => Promise.race([p.catch(() => null), new Promise<null>((done) => setTimeout(() => done(null), 6000))]);

// The answer is remembered, in memory and in the database, so a visitor never waits on Apple or Spotify:
// they get what was last known straight away, and if that is more than 15 seconds old the services are
// asked again behind their back for the next visitor. When a service is slow or says nothing, the last
// track it did report carries on being shown as "last played".
type Known = { track: Track | null; at: number };
const memo = globalThis as unknown as { __track?: Known; __asking?: Promise<Track | null> | null };
const FRESH = 15000;

async function recall(): Promise<Track | null> {
  if (!hasDatabase()) return null;
  try {
    return (await query<{ value: Track }>("select value from settings where key = 'last-track'"))[0]?.value ?? null;
  } catch {
    return null;
  }
}
function ask() {
  memo.__asking ??= (async () => {
    try {
      const [s, a, l] = await Promise.all([quiet(spotify()), quiet(appleMusic()), quiet(lastfm())]);
      // Whatever is playing this second wins. Otherwise the most recent track: Last.fm and Spotify hear every
      // device, so they come before Apple Music, which is kept as the fallback.
      const found = [s, l].find((t) => t?.playing) ?? l ?? s ?? a ?? null;
      const before = memo.__track?.track ?? null;
      // Nothing heard this time: keep the last one, no longer "playing".
      const track = found ?? (before ? { ...before, playing: false } : null);
      memo.__track = { track, at: Date.now() };
      if (found && hasDatabase() && (found.title !== before?.title || found.artist !== before?.artist || found.playing !== before?.playing))
        query("insert into settings (key, value) values ('last-track', $1) on conflict (key) do update set value = excluded.value, updated_at = now()", [JSON.stringify({ ...found, playing: false })]).catch(() => {});
      return track;
    } finally {
      memo.__asking = null;
    }
  })();
  return memo.__asking;
}
async function configured() {
  const names = ["SPOTIFY_REFRESH_TOKEN", "APPLE_MUSIC_USER_TOKEN", "LASTFM_API_KEY"];
  return (await Promise.all(names.map((n) => getKey(n)))).some(Boolean);
}

export async function GET() {
  try {
    if (!(await configured())) return Response.json({ configured: false }, { headers: { "Cache-Control": "no-store" } });
    let known = memo.__track;
    if (!known) {
      // Just started: what was last saved will do while the services are asked.
      const saved = await recall();
      if (saved) known = memo.__track = { track: saved, at: 0 };
    }
    let track: Track | null;
    if (!known) track = await ask();
    else {
      if (Date.now() - known.at > FRESH) void ask().catch(() => {});
      track = known.track;
    }
    return Response.json(track ?? { configured: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ configured: false });
  }
}

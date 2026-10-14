import "server-only";
import { createPrivateKey, sign as signWith } from "node:crypto";
import { getKey } from "./store";

// Apple Music wants two things: a "developer token" that says which developer is asking, and a "music user token" that says whose listening it may read.
const b64 = (data: Buffer | string) => Buffer.from(data).toString("base64url");

// The .p8 file pasted into a one-line box loses its line breaks (and may lose its first and last lines): put it back into the shape the key reader…
function pem(pasted: string) {
  const body = pasted.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  return `-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g)?.join("\n") ?? ""}\n-----END PRIVATE KEY-----\n`;
}

let made: { token: string; until: number; from: string } | null = null;
export async function developerToken(): Promise<string> {
  const [team, kid, key] = await Promise.all([getKey("APPLE_MUSIC_TEAM_ID"), getKey("APPLE_MUSIC_KEY_ID"), getKey("APPLE_MUSIC_PRIVATE_KEY")]);
  if (!team || !kid || !key) return getKey("APPLE_MUSIC_DEVELOPER_TOKEN");
  const from = `${team}:${kid}:${key.length}`;
  const now = Math.floor(Date.now() / 1000);
  // Made to last a week and remade a day before it runs out.
  if (made && made.from === from && made.until - now > 86400) return made.token;
  const until = now + 7 * 86400;
  const head = b64(JSON.stringify({ alg: "ES256", kid }));
  const claims = b64(JSON.stringify({ iss: team, iat: now, exp: until }));
  let mark: Buffer;
  try {
    mark = signWith("sha256", Buffer.from(`${head}.${claims}`), { key: createPrivateKey(pem(key)), dsaEncoding: "ieee-p1363" });
  } catch {
    throw new Error("The Apple Music private key could not be read. Paste the whole contents of the .p8 file again.");
  }
  made = { token: `${head}.${claims}.${b64(mark)}`, until, from };
  return made.token;
}

// Asks Apple for the last track played, which also proves both tokens work.
export async function lastPlayed() {
  const [dev, user] = await Promise.all([developerToken().catch(() => ""), getKey("APPLE_MUSIC_USER_TOKEN")]);
  if (!dev || !user) return { ok: false as const, status: 0, track: null };
  const res = await fetch("https://api.music.apple.com/v1/me/recent/played/tracks?limit=1", { headers: { Authorization: `Bearer ${dev}`, "Music-User-Token": user }, cache: "no-store" });
  if (!res.ok) return { ok: false as const, status: res.status, track: null };
  const a = ((await res.json()) as { data?: { attributes?: { name: string; artistName: string; url?: string; artwork?: { url?: string } } }[] }).data?.[0]?.attributes;
  return { ok: true as const, status: 200, track: a ? { title: a.name, artist: a.artistName, url: a.url ?? "", art: (a.artwork?.url ?? "").replace("{w}", "120").replace("{h}", "120") } : null };
}

import "server-only";
import { isKind, KINDS, slugify, type Entry, type Kind } from "../admin/kinds";
import { sample, seed, seedSettings, type Content, type Settings } from "../content";
import seedRunRows from "../runlog-seed.json";
import { hasDatabase, query } from "./db";
import { lock, unlock } from "./secrets";

type Row = { id: string; kind: string; slug: string; title: string; data: Record<string, unknown>; published: boolean; position: number; updated_at: Date };
const toEntry = (r: Row): Entry => ({ id: r.id, kind: r.kind as Kind, slug: r.slug, title: r.title, data: r.data, published: r.published, position: r.position, updatedAt: r.updated_at.toISOString() });
const titleOf = (data: Record<string, unknown>) => String(data.title ?? data.name ?? "Untitled");

// ---- Content, as the site reads it -------------------------------------------------------------------
const memo = globalThis as unknown as { __content?: { value: Content; at: number } };
export const forget = () => (memo.__content = undefined);

// Everything the site shows.
export async function getContent(): Promise<Content> {
  if (!hasDatabase()) return seed;
  if (memo.__content && Date.now() - memo.__content.at < 15000) return memo.__content.value;
  try {
    await seedIfEmpty();
    const rows = await query<Row>("select * from entries where published order by position asc, created_at desc");
    const content: Content = { settings: await getSettings(), posts: [], books: [], repertoire: [], doses: [], projects: [], subjects: [], topics: [], notes: [], places: [], wishlist: [], pbs: [], goals: [], lifts: [], changes: [] };
    for (const r of rows) {
      if (!isKind(r.kind)) continue;
      const data = r.data as Record<string, unknown>;
      // Things saved before notes were Markdown kept their paragraphs as a list: read those as one text.
      if (r.kind === "note" && typeof data.md !== "string") data.md = Array.isArray(data.body) ? (data.body as string[]).join("\n\n") : "";
      if ((r.kind === "subject" || r.kind === "topic") && Array.isArray(data.about)) data.about = (data.about as string[]).join("\n\n");
      if (r.kind === "topic") (data.resources ??= []), (data.cards ??= []);
      if (r.kind === "note") data.tags ??= [];
      (content[KINDS[r.kind].list] as unknown[]).push({ ...data, slug: r.slug });
    }
    for (const kind of Object.keys(KINDS) as Kind[]) {
      if (KINDS[kind].byDate) (content[KINDS[kind].list] as { date?: string }[]).sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
    }
    memo.__content = { value: content, at: Date.now() };
    return content;
  } catch (err) {
    console.error("[content] could not read the database; showing the built-in content", err);
    return memo.__content?.value ?? seed;
  }
}

// The first time the app meets a database (or a kind of content the database has not seen before, after an update adds one), it is filled with the…
let seeded = false;
async function seedIfEmpty() {
  if (seeded) return;
  const kinds = Object.keys(KINDS) as Kind[];
  const rows = await query<{ value: string[] }>("select value from settings where key = 'seeded'");
  let done = rows[0]?.value;
  if (!done) {
    // A database from before this list was kept: whatever kinds it has entries for have been filled already.
    const [{ count }] = await query<{ count: string }>("select count(*) from entries");
    done = Number(count) === 0 ? ["tidy-1"] : ["post", "book", "piece", "dose", "project", "place", "wish"];
    if (Number(count) === 0) await query("insert into settings (key, value) values ('site', $1) on conflict do nothing", [JSON.stringify(seedSettings)]);
  }
  const fresh = kinds.filter((k) => !done.includes(k));
  for (const kind of fresh) {
    const list = seed[KINDS[kind].list] as unknown as Record<string, unknown>[];
    for (const [n, item] of list.entries()) {
      const slug = String(item.slug ?? slugify(titleOf(item)));
      await query("insert into entries (kind, slug, title, data, position) values ($1, $2, $3, $4, $5) on conflict do nothing", [kind, slug, titleOf(item), JSON.stringify(item), n]);
    }
  }
  if (fresh.length) {
    await query("insert into settings (key, value) values ('seeded', $1) on conflict (key) do update set value = excluded.value", [JSON.stringify([...done, ...fresh])]);
    console.log(`[db] filled in the starting content for: ${fresh.join(", ")}`);
  }
  await tidy([...done, ...fresh]);
  seeded = true;
}

// Earlier versions of the site filled a new database with made-up examples: blog posts, daily doses, film projects, three places to visit, personal…
async function tidy(done: string[]) {
  if (done.includes("tidy-1")) return;
  const never = "created_at = updated_at";
  const slugsOf = (list: { slug?: string; title?: string; name?: string }[]) => list.map((x) => String(x.slug ?? slugify(String(x.title ?? x.name ?? ""))));
  const gone: [Kind, string[]][] = [
    ["post", slugsOf(sample.posts)],
    ["dose", slugsOf(sample.doses)],
    ["project", slugsOf(sample.projects)],
    ["pb", slugsOf(sample.pbs)],
    ["goal", slugsOf(sample.goals)],
    ["wish", slugsOf(sample.wishlist.slice(1))],
  ];
  let removed = 0;
  for (const [kind, slugs] of gone) removed += (await query<{ id: string }>(`delete from entries where kind = $1 and slug = any($2) and ${never} returning id`, [kind, slugs])).length;
  // The one wish that stays loses its placeholder reason.
  await query(`update entries set data = jsonb_set(data, '{why}', '""') where kind = 'wish' and data->>'why' like 'Sample reason%'`);
  // The spreadsheet's runs, where nothing has been written on them since, and the health numbers that came with them.
  if (done.includes("runlog")) {
    const days = [...new Set((seedRunRows as [string, ...unknown[]][]).map((r) => r[0]))];
    const runs = await query<{ id: string }>(`delete from activities where id < 0 and summary->>'source' = 'hand' and left(start_local, 10) = any($1) and start_local like '%T12:00:00' returning id::text`, [days]);
    removed += runs.length;
    if (runs.length) await query("delete from health where metric in ('vo2max', 'weight') and to_char(day, 'YYYY-MM-DD') = any($1)", [days]);
  }
  // The place the site said I was in, if it is still the one it came with.
  const site = (await query<{ value: Partial<Settings> }>("select value from settings where key = 'site'"))[0]?.value;
  const at = site?.location;
  if (site && at && at.name === "California" && at.lat === 36.7783 && at.lon === -119.4179) await query("update settings set value = $1 where key = 'site'", [JSON.stringify({ ...site, location: null })]);
  await query("insert into settings (key, value) values ('seeded', $1) on conflict (key) do update set value = excluded.value", [JSON.stringify([...done.filter((d) => d !== "runlog"), "tidy-1"])]);
  if (removed) console.log(`[db] took out ${removed} made-up examples from an earlier version`);
}

// ---- Entries, as the admin area edits them -----------------------------------------------------------
export async function listEntries(kind: Kind) {
  await seedIfEmpty();
  return (await query<Row>(`select * from entries where kind = $1 order by ${KINDS[kind].byDate ? "data->>'date' desc nulls last," : ""} position asc, created_at desc`, [kind])).map(toEntry);
}
export async function getEntry(id: string) {
  const rows = await query<Row>("select * from entries where id = $1", [id]);
  return rows[0] ? toEntry(rows[0]) : null;
}
export async function saveEntry(kind: Kind, input: { id?: string; slug?: string; data: Record<string, unknown>; published?: boolean; position?: number }) {
  const title = titleOf(input.data);
  const slug = slugify(input.slug || String(input.data.slug ?? "") || title) || "untitled";
  const data = { ...input.data, slug };
  const clash = await query<{ id: string }>("select id from entries where kind = $1 and slug = $2 and id <> coalesce($3::uuid, '00000000-0000-0000-0000-000000000000')", [kind, slug, input.id ?? null]);
  if (clash.length) throw new Error(`Another ${kind} already uses the address "${slug}". Change the address and save again.`);
  let rows: Row[];
  if (input.id) {
    rows = await query<Row>("update entries set slug = $2, title = $3, data = $4, published = $5, position = coalesce($6, position), updated_at = now() where id = $1 returning *", [input.id, slug, title, JSON.stringify(data), input.published ?? true, input.position ?? null]);
  } else {
    // New things go to the front of their list.
    rows = await query<Row>("insert into entries (kind, slug, title, data, published, position) values ($1, $2, $3, $4, $5, coalesce($6, (select coalesce(min(position), 0) - 1 from entries where kind = $1))) returning *", [kind, slug, title, JSON.stringify(data), input.published ?? true, input.position ?? null]);
  }
  forget();
  return toEntry(rows[0]);
}
export async function deleteEntry(id: string) {
  await query("delete from entries where id = $1", [id]);
  forget();
}

// ---- Settings and keys -------------------------------------------------------------------------------
export async function getSettings(): Promise<Settings> {
  const rows = await query<{ value: Partial<Settings> }>("select value from settings where key = 'site'");
  const saved = rows[0]?.value ?? {};
  return { ...seedSettings, ...saved, location: saved.location ?? null, social: { ...seedSettings.social, ...saved.social }, integrations: { ...seedSettings.integrations, ...saved.integrations }, workingOn: { ...seedSettings.workingOn, ...saved.workingOn }, sport: { ...seedSettings.sport, ...saved.sport } };
}
export async function saveSettings(settings: Settings) {
  await query("insert into settings (key, value) values ('site', $1) on conflict (key) do update set value = excluded.value, updated_at = now()", [JSON.stringify(settings)]);
  forget();
}

// The names of the keys the site knows how to use, grouped by the service they belong to.
export const KEY_GROUPS: { service: string; about: string; keys: string[] }[] = [
  { service: "Spotify", about: "Now listening. Needs an app at developer.spotify.com and a refresh token with the user-read-currently-playing and user-read-recently-played scopes.", keys: ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET", "SPOTIFY_REFRESH_TOKEN"] },
  { service: "Apple Music", about: "Now listening: the last track played (Apple does not say what is playing this second). Needs a paid Apple Developer account. Paste the Team ID, the MusicKit key's Key ID and the whole contents of its .p8 file, save, then press Connect Apple Music: the user token fills itself in.", keys: ["APPLE_MUSIC_TEAM_ID", "APPLE_MUSIC_KEY_ID", "APPLE_MUSIC_PRIVATE_KEY", "APPLE_MUSIC_USER_TOKEN"] },
  { service: "Last.fm", about: "Now listening. The simple route for Apple Music: scrobble to Last.fm.", keys: ["LASTFM_USER", "LASTFM_API_KEY"] },
  { service: "Strava", about: "Your activities on the sport pages. Make an API application at strava.com/settings/api, paste its client ID and secret here and save, then press Connect. The refresh token fills itself in.", keys: ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET", "STRAVA_REFRESH_TOKEN"] },
  { service: "My phone", about: "A password of your own choosing, at least 12 characters. Your phone sends it with your location to /api/location, and with your health numbers to /api/health.", keys: ["LOCATION_TOKEN"] },
];
const KNOWN = new Set([...KEY_GROUPS.flatMap((g) => g.keys), "APPLE_MUSIC_DEVELOPER_TOKEN"]);

// A key's value: from the database if it has been set in the admin area, otherwise from the environment.
export async function getKey(name: string) {
  if (hasDatabase()) {
    try {
      const rows = await query<{ value: string }>("select value from settings where key = $1 and secret", [`key:${name}`]);
      const found = rows[0] ? unlock(String(rows[0].value)) : "";
      if (found) return found;
    } catch {}
  }
  return process.env[name] ?? "";
}
// Which keys are set, without ever saying what they are.
export async function keyStatus() {
  const rows = await query<{ key: string; updated_at: Date }>("select key, updated_at from settings where secret");
  const saved = new Map(rows.map((r) => [r.key.replace(/^key:/, ""), r.updated_at.toISOString()]));
  return KEY_GROUPS.map((g) => ({ ...g, keys: g.keys.map((name) => ({ name, set: saved.has(name) || !!process.env[name], from: saved.has(name) ? "admin" : process.env[name] ? "environment" : "", updatedAt: saved.get(name) ?? "" })) }));
}
export async function setKey(name: string, value: string) {
  if (!KNOWN.has(name)) throw new Error("Unknown key");
  if (!value) await query("delete from settings where key = $1", [`key:${name}`]);
  else await query("insert into settings (key, value, secret) values ($1, $2, true) on conflict (key) do update set value = excluded.value, updated_at = now()", [`key:${name}`, JSON.stringify(lock(value))]);
}

// A post kept as a draft (not published). The owner can open it at its address to see how it will look;
// anyone else gets told it is not theirs to see.
export async function getDraftPost(slug: string) {
  if (!hasDatabase()) return null;
  try {
    const rows = await query<Row>("select * from entries where kind = 'post' and slug = $1 and not published", [slug]);
    const r = rows[0];
    return r ? ({ tags: [], body: [], ...(r.data as Record<string, unknown>), slug: r.slug } as unknown as Content["posts"][number]) : null;
  } catch {
    return null;
  }
}

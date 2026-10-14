// Stand-in for lib/admin/api.ts in the single-file preview: the same calls, answered from memory, so the admin area can be tried without a server.
import { KINDS, slugify, type Entry, type Kind } from "@/lib/admin/kinds";
import { sample as seed, type Content, type Settings } from "@/lib/content";
const seedSettings = seed.settings;
import type { AdminActivity, KeyGroup, Media, StravaStatus } from "@/lib/admin/api";
import { seedHealth, seedRuns, typeName, withoutWeight, type LogRun, type RunLog } from "@/lib/runlog";
import type { Activity, ActivityDetail } from "@/lib/sport";
import { kindOfActivity, markOf, type ActivityLog, type PadelSession } from "@/lib/training";
import { sampleActivities, sampleDetail } from "@/lib/sport-sample";

const titleOf = (d: Record<string, unknown>) => String(d.title ?? d.name ?? "Untitled");
let next = 1;
const id = () => `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}`;
let entries: Entry[] = (Object.keys(KINDS) as Kind[]).flatMap((kind) =>
  (seed[KINDS[kind].list] as unknown as Record<string, unknown>[]).map((data, n) => ({ id: id(), kind, slug: String(data.slug ?? slugify(titleOf(data))), title: titleOf(data), data, published: true, position: n, updatedAt: new Date().toISOString() })),
);
let settings: Settings = seedSettings;
let signedIn = false;
const media: Media[] = [];
const keys = new Map<string, string>();
const GROUPS = [
  { service: "Spotify", about: "Now listening. Needs an app at developer.spotify.com and a refresh token.", keys: ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET", "SPOTIFY_REFRESH_TOKEN"] },
  { service: "Apple Music", about: "Now listening (last played only). Needs an Apple Developer account.", keys: ["APPLE_MUSIC_DEVELOPER_TOKEN", "APPLE_MUSIC_USER_TOKEN"] },
  { service: "Last.fm", about: "Now listening. The simple route for Apple Music: scrobble to Last.fm.", keys: ["LASTFM_USER", "LASTFM_API_KEY"] },
  { service: "Strava", about: "Your activities on the sport pages. Make an API application at strava.com/settings/api, paste its client ID and secret here and save, then press Connect.", keys: ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET", "STRAVA_REFRESH_TOKEN"] },
  { service: "My phone", about: "A password of your own choosing. Your phone sends it with your location to /api/location, and with your health numbers to /api/health.", keys: ["LOCATION_TOKEN"] },
];
const keyStatus = (): KeyGroup[] => GROUPS.map((g) => ({ ...g, keys: g.keys.map((name) => ({ name, set: keys.has(name), from: keys.has(name) ? "admin" : "", updatedAt: keys.get(name) ?? "" })) }));

// The site's content, rebuilt from the entries the same way the server does it.
function build(): Content {
  const content: Content = { settings, posts: [], books: [], repertoire: [], doses: [], projects: [], subjects: [], topics: [], notes: [], places: [], wishlist: [], pbs: [], goals: [], lifts: [], changes: [] };
  for (const e of [...entries].sort((a, b) => a.position - b.position)) if (e.published) (content[KINDS[e.kind].list] as unknown[]).push({ ...e.data, slug: e.slug });
  for (const kind of Object.keys(KINDS) as Kind[]) if (KINDS[kind].byDate) (content[KINDS[kind].list] as { date?: string }[]).sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
  return content;
}
let content = build();
const listeners = new Set<() => void>();
const changed = () => {
  content = build();
  listeners.forEach((l) => l());
};
export const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));
export const current = () => content;

const soon = <T,>(value: T) => new Promise<T>((done) => setTimeout(() => done(value), 120));
const order = (kind: Kind) =>
  entries.filter((e) => e.kind === kind).sort((a, b) => (KINDS[kind].byDate ? String(b.data.date ?? "").localeCompare(String(a.data.date ?? "")) : 0) || a.position - b.position);

const strava: StravaStatus = { hasApp: false, connected: false, running: false, activities: 0, detailed: 0, hidden: 0 };

// Sport in the preview: the runs are the ones from the spreadsheet; everything else (padel, the gym, cycling) is made up, so there is something of…
type Demo = Activity & { cadence?: number };
let acts: Demo[] = [
  ...seedRuns().map((r): Demo => ({ id: r.id, sport: "Run", name: "Run", start: `${r.date}T12:00:00`, distance: Math.round(r.km * 1000), moving: r.time, elapsed: r.time, climb: 0, hr: r.hr, cadence: r.cadence })),
  ...sampleActivities().filter((a) => a.sport !== "Run").map(({ route: _r, splits: _s, efforts: _e, description: _d, ...a }): Demo => a),
];
const logs = new Map<string, ActivityLog>(seedRuns().map((r) => [r.id, { type: r.type, note: r.note, efforts: r.efforts, cadence: r.cadence }]));
// A few of the made-up padel sessions come already written up, so the padel page has something on it.
acts.filter((a) => a.sport === "Padel").slice(-9).forEach((a, k) => {
  const sets: [number, number][][] = [[[6, 4], [6, 3]], [[3, 6], [4, 6]], [[4, 6], [6, 3], [7, 5]], [[6, 2], [6, 4]], [[6, 4], [2, 6], [4, 6]], [[7, 6], [3, 6], [6, 4]]];
  logs.set(a.id, k % 3 === 2 ? { padel: { kind: "Training" } } : { padel: { kind: k % 2 ? "Friendly" : "Match", sets: sets[k % sets.length], partner: "Sample partner" } });
});
const hiddenIds = new Set<string>();
const kindOf = (a: Demo) => kindOfActivity(a.sport, a.name, logs.get(a.id));
const shown = () => acts.filter((a) => !hiddenIds.has(a.id));
export const demoActivities = (): Activity[] => shown().map(({ cadence: _c, ...a }) => ({ ...a, mark: markOf(kindOf(a), logs.get(a.id), typeName) || undefined }));
export const demoLog = (): RunLog => {
  const runs: LogRun[] = shown().filter((a) => kindOf(a) === "run").map((a) => {
    const log = logs.get(a.id) ?? {};
    return { id: a.id, date: a.start.slice(0, 10), time: a.moving, km: Math.round(a.distance / 10) / 100, hr: a.hr ?? log.hr, cadence: log.cadence ?? a.cadence, efforts: log.efforts, type: log.type, feel: log.feel, note: withoutWeight(log.note), hand: a.id.startsWith("-") || undefined };
  }).sort((a, b) => a.date.localeCompare(b.date));
  return { runs, health: seedHealth(seedRuns()).filter((h) => h.metric !== "weight"), sample: false };
};
export const demoPadel = (): { sessions: PadelSession[]; sample: boolean } => ({ sessions: shown().filter((a) => kindOf(a) === "padel").map((a) => ({ id: a.id, date: a.start.slice(0, 10), name: a.name, moving: a.moving, log: logs.get(a.id) ?? {}, sample: a.sample })).reverse(), sample: true });
export const demoRides = () => ({ rides: shown().filter((a) => kindOf(a) === "ride").map((a) => ({ id: a.id, date: a.start.slice(0, 10), name: a.name, distance: a.distance, moving: a.moving, climb: a.climb, hr: a.hr, log: logs.get(a.id) ?? {} })).sort((a, b) => b.date.localeCompare(a.date)) });
export const demoDetail = (id: string): ActivityDetail | undefined => {
  const a = acts.find((x) => x.id === id);
  if (!a) return undefined;
  const { cadence, ...rest } = a;
  const log = logs.get(id) ?? {};
  return { ...(sampleDetail(id) ?? rest), hr: a.hr ?? log.hr, log: { ...log, cadence: log.cadence ?? cadence, kind: kindOf(a) } };
};
const adminOf = (a: Demo): AdminActivity => ({ id: a.id, sport: a.sport, name: a.name, start_local: a.start, distance: a.distance, moving: a.moving, hr: a.hr, hidden: hiddenIds.has(a.id), log: logs.get(a.id) ?? {}, kind: kindOf(a), has: { hr: !!a.hr, cadence: !!a.cadence } });

export const api = {
  demo: true,
  strava: () => soon({ ...strava, hasApp: keys.has("STRAVA_CLIENT_ID") && keys.has("STRAVA_CLIENT_SECRET") }),
  stravaDo: (_action: "sync" | "full" | "disconnect") => Promise.reject<{ added?: number; details?: number; status: StravaStatus }>(new Error("The preview cannot reach Strava. This works on the real site.")),
  stravaConnect: "",
  activities: (q: string, offset: number, kind = "") => {
    const found = acts.filter((a) => `${a.name} ${a.sport} ${a.start}`.toLowerCase().includes(q.trim().toLowerCase()) && (!kind || kindOf(a) === kind)).sort((a, b) => b.start.localeCompare(a.start));
    return soon({ total: found.length, items: found.slice(offset, offset + 50).map(adminOf) });
  },
  activity: (activityId: string) => {
    const a = acts.find((x) => x.id === activityId);
    return a ? soon(adminOf(a)) : Promise.reject<AdminActivity>(new Error("That activity is not there."));
  },
  hideActivity: (activityId: string, hidden: boolean) => soon(hidden ? hiddenIds.add(activityId) : hiddenIds.delete(activityId)),
  saveLog: (activityId: string, log: ActivityLog) => soon(logs.set(activityId, log)),
  addActivity: (input: { date: string; sport: string; name?: string; time: number; km?: number; hr?: number }) => {
    const made: Demo = { id: `-${input.date.replace(/-/g, "")}${acts.filter((a) => a.start.startsWith(input.date)).length}`, sport: input.sport, name: input.name ?? "", start: `${input.date}T12:00:00`, distance: Math.round((input.km ?? 0) * 1000), moving: input.time, elapsed: input.time, climb: 0, hr: input.hr };
    acts = [...acts, made];
    return soon({ id: made.id });
  },
  runLog: () => soon({ spreadsheet: seedRuns().length, byHand: seedRuns().length }),
  importRunLog: () => soon({ runs: seedRuns().length, added: 0 }),
  removeActivity: (activityId: string) => soon((acts = acts.filter((a) => a.id !== activityId))),
  session: () => soon({ signedIn, database: true, passwordSet: true }),
  signIn: (_password: string) => soon({ signedIn: (signedIn = true) }),
  signOut: () => soon({ signedIn: (signedIn = false) }),
  list: (kind: Kind) => soon(order(kind)),
  get: (entryId: string) => {
    const found = entries.find((e) => e.id === entryId);
    return found ? soon(found) : Promise.reject(new Error("Not found"));
  },
  save: (kind: Kind, input: { id?: string; slug: string; data: Record<string, unknown>; published: boolean; position?: number }) => {
    const slug = slugify(input.slug || titleOf(input.data)) || "untitled";
    if (entries.some((e) => e.kind === kind && e.slug === slug && e.id !== input.id)) return Promise.reject(new Error(`Another ${kind} already uses the address "${slug}". Change the address and save again.`));
    const before = entries.find((e) => e.id === input.id);
    const saved: Entry = {
      id: before?.id ?? id(),
      kind,
      slug,
      title: titleOf(input.data),
      data: { ...input.data, slug },
      published: input.published,
      position: input.position ?? before?.position ?? Math.min(0, ...entries.filter((e) => e.kind === kind).map((e) => e.position)) - 1,
      updatedAt: new Date().toISOString(),
    };
    entries = before ? entries.map((e) => (e.id === saved.id ? saved : e)) : [...entries, saved];
    changed();
    return soon(saved);
  },
  remove: (entryId: string) => {
    entries = entries.filter((e) => e.id !== entryId);
    changed();
    return soon({ ok: true });
  },
  appleMusic: () => soon({ developerToken: "", hasKey: false, connected: false, works: null, status: 0, track: null, error: "" }),
  settings: () => soon({ settings, keys: keyStatus() }),
  saveSettings: (body: { settings?: Settings; keys?: Record<string, string> }) => {
    if (body.settings) settings = body.settings;
    for (const [name, value] of Object.entries(body.keys ?? {})) value ? keys.set(name, new Date().toISOString()) : keys.delete(name);
    changed();
    return soon({ settings, keys: keyStatus() });
  },
  media: () => soon([...media]),
  // Uploads are held in the page itself, as data addresses.
  upload: (file: File) =>
    new Promise<Media>((done, fail) => {
      if (file.size > 6 * 1024 * 1024) return fail(new Error("The preview can only hold files up to 6 MB. The real site takes 200 MB."));
      const reader = new FileReader();
      reader.onerror = () => fail(new Error("Could not read that file"));
      reader.onload = () => {
        const item: Media = { id: id(), url: String(reader.result), name: file.name, mime: file.type || "application/octet-stream", size: file.size, createdAt: new Date().toISOString() };
        media.unshift(item);
        done(item);
      };
      reader.readAsDataURL(file);
    }),
  removeMedia: (mediaId: string) => {
    const at = media.findIndex((m) => m.id === mediaId);
    if (at >= 0) media.splice(at, 1);
    return soon({ ok: true });
  },
};

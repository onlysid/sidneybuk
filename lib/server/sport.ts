import "server-only";
import { METRIC_INFO, decodePolyline, listActivities, summarise, trimRoute, type Activity, type ActivityDetail, type Effort, type HealthSeries, type ListQuery, type Metric, type Split, type SportSummary } from "../sport";
import { hasDatabase, query } from "./db";
import { healthIn, seedRuns, typeName, withoutWeight, type LogRun, type RunLog, type RunNote } from "../runlog";
import { kindOfActivity, markOf, RIDE_SPORTS, tidyLog, type ActivityLog, type Kind, type PadelSession, type RideSession } from "../training";
import { getKey, getSettings, setKey } from "./store";

// ---- Reading: what the sport pages ask for ----------------------------------------------------------------
type Row = { id: string; sport: string; name: string; start_local: string; distance: number; moving: number; elapsed: number; climb: number; hr: number | null; max_hr: number | null; kudos: number; has_map: boolean; efforts: Effort[] | null; log?: ActivityLog | null };
const toActivity = (r: Row): Activity & { efforts?: Effort[] } => ({ id: String(r.id), sport: r.sport, name: r.name, start: r.start_local, distance: r.distance, moving: r.moving, elapsed: r.elapsed, climb: r.climb, hr: r.hr ?? undefined, maxHr: r.max_hr ?? undefined, kudos: r.kudos, map: r.has_map, efforts: r.efforts ?? undefined });
const efforts = (list: unknown): Effort[] | undefined => (Array.isArray(list) ? list.map((e) => ({ name: nameEffort(String(e.name)), distance: Number(e.distance), time: Number(e.elapsed_time) })) : undefined);
// Strava calls them "5K" and "Half-Marathon"; the site says "5 km" and "Half marathon".
const nameEffort = (n: string) => n.replace(/^(\d+)[kK]$/, "$1 km").replace(/^(\d+)m$/, "$1 m").replace(/-/g, " ").replace(/\b([A-Z])([a-z]+) ([A-Z])/g, (_, a, b, c) => `${a}${b} ${c.toLowerCase()}`);

const memo = globalThis as unknown as { __acts?: { list: (Activity & { efforts?: Effort[] })[]; sample: boolean; at: number } };
export const forgetSport = () => (memo.__acts = undefined);

// Every activity that is shown, in the short form lists need.
async function everything() {
  if (!hasDatabase()) return { list: [], sample: false };
  if (memo.__acts && Date.now() - memo.__acts.at < 60000) return memo.__acts;
  try {
    const rows = await query<Row>(`select id::text, sport, name, start_local, distance, moving, elapsed, climb, hr, max_hr, kudos, (polyline is not null and polyline <> '') as has_map, null as efforts, log from activities where not hidden`);
    const withEfforts = await query<{ id: string; best: unknown }>(`select id::text, detail->'best_efforts' as best from activities where not hidden and jsonb_array_length(coalesce(detail->'best_efforts', '[]'::jsonb)) > 0`);
    const best = new Map(withEfforts.map((r) => [r.id, efforts(r.best)]));
    const showMaps = (await getSettings()).sport.showMaps;
    const list = rows.map((r) => ({ ...toActivity(r), hr: r.hr ?? r.log?.hr ?? undefined, mark: markOf(kindOfActivity(r.sport, r.name, r.log), r.log, typeName) || undefined, map: showMaps && r.has_map, efforts: best.get(String(r.id)) }));
    memo.__acts = { list, sample: false, at: Date.now() };
    return memo.__acts;
  } catch (err) {
    console.error("[sport] could not read activities", err);
    return memo.__acts ?? { list: [] as (Activity & { efforts?: Effort[] })[], sample: false };
  }
}

export async function getSummary(): Promise<SportSummary> {
  maybeSync();
  const { list, sample } = await everything();
  return { sample, ...summarise(list), health: [], lastSync: hasDatabase() ? ((await getState()).lastSync ?? "") : "" };
}
export async function getList(q: ListQuery) {
  const { list, sample } = await everything();
  const found = listActivities(list.map(({ efforts: _e, ...a }) => a), q);
  return { ...found, sample };
}
export async function getActivity(id: string): Promise<ActivityDetail | undefined> {
  if (!hasDatabase() || !/^-?\d{1,19}$/.test(id)) return undefined;
  const rows = await query<Row & { polyline: string | null; detail: Record<string, unknown> | null; cadence: number | null }>(`select id::text, sport, name, start_local, distance, moving, elapsed, climb, hr, max_hr, kudos, (polyline is not null and polyline <> '') as has_map, null as efforts, polyline, detail, log, (summary->>'average_cadence')::real as cadence from activities where id = $1 and not hidden`, [id]);
  const r = rows[0];
  if (!r) return undefined;
  const { showMaps, trim, showNotes, showWeight } = (await getSettings()).sport;
  // What I wrote on it myself.
  const mine = (r.log ?? {}) as ActivityLog;
  const cadence = mine.cadence ?? (r.cadence ? Math.round(r.cadence < 120 ? r.cadence * 2 : r.cadence) : undefined);
  const note = !showNotes ? undefined : showWeight ? mine.note : withoutWeight(mine.note);
  const kind = kindOfActivity(r.sport, r.name, mine);
  const log = { ...mine, note, cadence, kind };
  const d = r.detail ?? {};
  const line = String((d.map as { polyline?: string } | undefined)?.polyline || r.polyline || "");
  const route = showMaps && line ? thin(trimRoute(decodePolyline(line), trim)) : undefined;
  const splits: Split[] | undefined = Array.isArray(d.splits_metric) ? (d.splits_metric as Record<string, number>[]).map((s) => ({ n: s.split, distance: s.distance, time: s.moving_time ?? s.elapsed_time, climb: s.elevation_difference ?? 0, hr: s.average_heartrate })) : undefined;
  return { ...toActivity(r), hr: r.hr ?? mine.hr ?? undefined, map: !!route?.length, route: route?.length ? route : undefined, efforts: efforts(d.best_efforts), splits, description: d.description ? String(d.description) : undefined, calories: d.calories ? Number(d.calories) : undefined, device: d.device_name ? String(d.device_name) : undefined, log };
}
// A page does not need ten thousand points to draw a line.
const thin = (route: [number, number][]) => {
  const step = Math.ceil(route.length / 600);
  return route.filter((_, n) => n % step === 0 || n === route.length - 1).map(([a, b]): [number, number] => [Math.round(a * 1e5) / 1e5, Math.round(b * 1e5) / 1e5]);
};

// ---- Health numbers from my phone ---------------------------------------------------------------------------
const METRICS = Object.keys(METRIC_INFO) as Metric[];
// Health numbers are private: only /api/admin/health, which needs me to be signed in, hands them out.
export async function getHealth(): Promise<HealthSeries[]> {
  if (!hasDatabase()) return [];
  try {
    const rows = await query<{ metric: Metric; day: string; value: number }>("select metric, to_char(day, 'YYYY-MM-DD') as day, value from health order by day asc");
    if (!rows.length) return [];
    const by = new Map<string, { day: string; value: number }[]>();
    for (const r of rows) (by.get(r.metric) ?? by.set(r.metric, []).get(r.metric)!).push({ day: r.day, value: r.value });
    return METRICS.map((metric) => ({ metric, points: by.get(metric) ?? [] })).filter((s) => s.points.length);
  } catch {
    return [];
  }
}
// The names other apps (and Apple's Health) use for the same things, lower-cased, with spaces or underscores.
const NAMES: Record<Metric, string[]> = {
  vo2max: ["vo2max", "vo2 max", "cardio fitness"],
  restingHr: ["restinghr", "resting heart rate", "resting hr"],
  weight: ["weight", "weight body mass", "body mass"],
  hrv: ["hrv", "heart rate variability", "heart rate variability sdnn"],
  walkingHr: ["walkinghr", "walking heart rate", "walking heart rate average"],
  bodyFat: ["bodyfat", "body fat", "body fat percentage"],
  steps: ["steps", "step count"],
  activeEnergy: ["activeenergy", "active energy", "active energy burned", "active calories"],
  exerciseMinutes: ["exerciseminutes", "exercise minutes", "exercise time", "apple exercise time"],
  respiratoryRate: ["respiratoryrate", "respiratory rate", "breathing rate"],
  bloodOxygen: ["bloodoxygen", "blood oxygen", "blood oxygen saturation", "oxygen saturation", "spo2"],
  sleepHours: ["sleephours", "sleep hours", "sleep", "sleep analysis"],
};
const ALIAS = new Map<string, Metric>(METRICS.flatMap((m) => NAMES[m].map((n) => [n, m] as [string, Metric])));
const metricOf = (name: unknown) => ALIAS.get(String(name ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " "));

// One value is kept per measure per day.
export async function saveHealth(samples: { metric: string; date: string; value: number }[]) {
  const days = new Map<string, { metric: Metric; day: string; sum: number; n: number }>();
  for (const s of samples) {
    const metric = metricOf(s.metric);
    const when = new Date(String(s.date));
    let value = Number(s.value);
    if (!metric || Number.isNaN(when.getTime()) || !Number.isFinite(value)) continue;
    // Percentages sometimes arrive as a fraction (0.18 for 18%).
    if ((metric === "bodyFat" || metric === "bloodOxygen") && value > 0 && value <= 1) value *= 100;
    const info = METRIC_INFO[metric];
    if (!info.add && (value < info.range[0] || value > info.range[1])) continue;
    if (info.add && (value <= 0 || value > info.range[1])) continue;
    // Keep the calendar day as written when the date starts with one, rather than shifting it to UTC.
    const day = /^\d{4}-\d{2}-\d{2}/.test(String(s.date)) ? String(s.date).slice(0, 10) : when.toISOString().slice(0, 10);
    const key = `${metric}|${day}`, was = days.get(key);
    if (was) (was.sum += value), (was.n += 1);
    else days.set(key, { metric, day, sum: value, n: 1 });
  }
  const rows = [...days.values()]
    .map((d) => ({ metric: d.metric, day: d.day, value: METRIC_INFO[d.metric].add ? d.sum : d.sum / d.n }))
    .filter((r) => r.value >= METRIC_INFO[r.metric].range[0] && r.value <= METRIC_INFO[r.metric].range[1]);
  // Written a thousand at a time, so years of history arrive in seconds.
  for (let k = 0; k < rows.length; k += 1000) {
    const part = rows.slice(k, k + 1000);
    await query("insert into health (metric, day, value) select * from unnest($1::text[], $2::date[], $3::float8[]) on conflict (metric, day) do update set value = excluded.value", [part.map((r) => r.metric), part.map((r) => r.day), part.map((r) => Math.round(r.value * 100) / 100)]);
  }
  return rows.length;
}

// ---- Strava ----------------------------------------------------------------------------------------------------- (STRAVA_API exists so the tests…
const API = () => process.env.STRAVA_API || "https://www.strava.com";
type State = { lastSync?: string; athlete?: string; error?: string; running?: boolean };
async function getState(): Promise<State> {
  const rows = await query<{ value: State }>("select value from settings where key = 'strava'");
  return rows[0]?.value ?? {};
}
const setState = (state: State) => query("insert into settings (key, value) values ('strava', $1) on conflict (key) do update set value = excluded.value, updated_at = now()", [JSON.stringify(state)]);

export async function stravaStatus() {
  const [id, secret, refresh, state, counts] = await Promise.all([getKey("STRAVA_CLIENT_ID"), getKey("STRAVA_CLIENT_SECRET"), getKey("STRAVA_REFRESH_TOKEN"), getState(), query<{ all: string; detailed: string; hidden: string }>("select count(*) as all, count(detail) as detailed, count(*) filter (where hidden) as hidden from activities")]);
  return { hasApp: !!id && !!secret, connected: !!refresh, ...state, running: !!running, activities: Number(counts[0].all), detailed: Number(counts[0].detailed), hidden: Number(counts[0].hidden) };
}
// Where to send me to give the site permission. Only activities visible to followers or everyone are asked for.
export async function authorizeUrl(redirect: string, state: string) {
  const id = await getKey("STRAVA_CLIENT_ID");
  if (!id || !(await getKey("STRAVA_CLIENT_SECRET"))) throw new Error("Save the Strava client ID and client secret first.");
  return `${API()}/oauth/authorize?${new URLSearchParams({ client_id: id, redirect_uri: redirect, response_type: "code", approval_prompt: "auto", scope: "read,activity:read", state })}`;
}
let access: { token: string; until: number } | null = null;
async function tokenCall(body: Record<string, string>) {
  const res = await fetch(`${API()}/oauth/token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: await getKey("STRAVA_CLIENT_ID"), client_secret: await getKey("STRAVA_CLIENT_SECRET"), ...body }), cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_at?: number; athlete?: { firstname?: string; lastname?: string }; message?: string };
  if (!res.ok || !json.access_token || !json.refresh_token) throw new Error(`Strava did not accept that (${res.status}${json.message ? `: ${json.message}` : ""}).`);
  access = { token: json.access_token, until: (json.expires_at ?? 0) * 1000 };
  // Strava may hand back a new refresh token; the old one stops working, so keep the new one.
  if (json.refresh_token !== (await getKey("STRAVA_REFRESH_TOKEN"))) await setKey("STRAVA_REFRESH_TOKEN", json.refresh_token);
  return json;
}
export async function finishConnect(code: string) {
  const json = await tokenCall({ code, grant_type: "authorization_code" });
  await setState({ ...(await getState()), athlete: [json.athlete?.firstname, json.athlete?.lastname].filter(Boolean).join(" "), error: undefined });
}
async function token() {
  if (access && access.until - 120000 > Date.now()) return access.token;
  const refresh = await getKey("STRAVA_REFRESH_TOKEN");
  if (!refresh) throw new Error("Strava is not connected.");
  await tokenCall({ refresh_token: refresh, grant_type: "refresh_token" });
  return access!.token;
}
async function strava<T>(path: string): Promise<T> {
  const res = await fetch(`${API()}/api/v3${path}`, { headers: { Authorization: `Bearer ${await token()}` }, cache: "no-store" });
  if (res.status === 429) throw new Error("Strava says the site has asked too much for now. It will carry on at the next sync.");
  // A token that was not made by the Connect button (the "refresh token" shown on Strava's own API page, say) may sign in but not read activities.
  if (res.status === 401 || res.status === 403) throw new Error("Strava would not let this token read activities. Press Disconnect, then Connect Strava, and leave the activity box ticked. (The refresh token shown on Strava's API page cannot read activities, so it must not be pasted in.)");
  if (!res.ok) throw new Error(`Strava answered ${res.status} for ${path.split("?")[0]}.`);
  return (await res.json()) as T;
}

type Raw = { id: number; name?: string; sport_type?: string; type?: string; start_date: string; start_date_local?: string; distance?: number; moving_time?: number; elapsed_time?: number; total_elevation_gain?: number; average_heartrate?: number; max_heartrate?: number; kudos_count?: number; map?: { summary_polyline?: string | null } };
// Strava allows a new app about 100 requests in 15 minutes and 1,000 a day.
const DETAILS_PER_SYNC = 70;
let running: Promise<{ added: number; details: number }> | null = null;

// Brings in what is new.
export function sync(full = false) {
  running ??= (async () => {
    const state = await getState();
    try {
      const newest = full ? [] : await query<{ at: Date }>("select max(start_utc) as at from activities");
      // Go back a fortnight from the newest one, so edits to recent activities are picked up too.
      const after = !full && newest[0]?.at ? Math.floor(newest[0].at.getTime() / 1000) - 14 * 86400 : 0;
      const seen: string[] = [];
      let added = 0;
      for (let page = 1; page <= 60; page++) {
        const list = await strava<Raw[]>(`/athlete/activities?per_page=200&page=${page}${after ? `&after=${after}` : ""}`);
        for (const a of list) {
          seen.push(String(a.id));
          const local = (a.start_date_local ?? a.start_date).replace(/Z$/, "").slice(0, 19);
          const r = await query<{ fresh: boolean }>(
            `insert into activities (id, sport, name, start_utc, start_local, distance, moving, elapsed, climb, hr, max_hr, kudos, polyline, summary)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             on conflict (id) do update set sport = excluded.sport, name = excluded.name, start_utc = excluded.start_utc, start_local = excluded.start_local, distance = excluded.distance, moving = excluded.moving,
               elapsed = excluded.elapsed, climb = excluded.climb, hr = excluded.hr, max_hr = excluded.max_hr, kudos = excluded.kudos, polyline = excluded.polyline, summary = excluded.summary, updated_at = now()
             returning (xmax = 0) as fresh`,
            [a.id, a.sport_type ?? a.type ?? "Workout", a.name ?? "", a.start_date, local, a.distance ?? 0, Math.round(a.moving_time ?? 0), Math.round(a.elapsed_time ?? 0), a.total_elevation_gain ?? 0, a.average_heartrate ?? null, a.max_heartrate ?? null, a.kudos_count ?? 0, a.map?.summary_polyline ?? null, JSON.stringify(a)],
          );
          if (r[0]?.fresh) added++;
        }
        if (list.length < 200) break;
      }
      if (full && seen.length) await query("delete from activities where id > 0 and not (id::text = any($1))", [seen]);
      await mergeHandRuns();
      const todo = await query<{ id: string }>("select id::text from activities where detail is null and id > 0 order by start_utc desc limit $1", [DETAILS_PER_SYNC]);
      let details = 0;
      for (const { id } of todo) {
        await query("update activities set detail = $2 where id = $1", [id, JSON.stringify(await strava<Record<string, unknown>>(`/activities/${id}`))]);
        details++;
      }
      await setState({ ...state, lastSync: new Date().toISOString(), error: undefined });
      return { added, details };
    } catch (err) {
      await setState({ ...state, lastSync: new Date().toISOString(), error: (err as Error).message });
      throw err;
    } finally {
      forgetSport();
      running = null;
    }
  })();
  return running;
}
// The site keeps itself in step with Strava: every 15 minutes, for as long as the server is running, it looks for new activities and fills in more…
const EVERY = 15 * 60000;
const timer = globalThis as unknown as { __stravaTimer?: ReturnType<typeof setInterval> };
export function keepInStep() {
  if (timer.__stravaTimer || !hasDatabase()) return;
  const tick = async () => {
    try {
      if (!(await getKey("STRAVA_REFRESH_TOKEN"))) return;
      const r = await sync();
      if (r.added || r.details) console.log(`[strava] ${r.added} new, ${r.details} filled in`);
    } catch (err) {
      console.error("[strava]", (err as Error).message);
    }
  };
  timer.__stravaTimer = setInterval(tick, EVERY);
  timer.__stravaTimer.unref?.();
  // And once shortly after starting, so a restart catches up straight away.
  setTimeout(tick, 20000).unref?.();
}
// A fallback for the same thing: whenever someone looks at the sport page and it has been an hour, look again.
let checked = 0;
function maybeSync() {
  if (!hasDatabase() || Date.now() - checked < 5 * 60000) return;
  checked = Date.now();
  (async () => {
    if (!(await getKey("STRAVA_REFRESH_TOKEN"))) return;
    const last = (await getState()).lastSync;
    if (!last || Date.now() - new Date(last).getTime() > 3600000) await sync();
  })().catch((err) => console.error("[strava]", (err as Error).message));
}
export async function disconnect() {
  await setKey("STRAVA_REFRESH_TOKEN", "");
  access = null;
  await setState({});
}

// ---- For the admin area: every activity, with a way to hide one ---------------------------------------------
const KINDS_SQL: Record<Kind, string> = {
  run: "coalesce(log->>'as', case when sport in ('Run', 'TrailRun', 'VirtualRun') and name !~* 'padel' then 'run' end) = 'run'",
  padel: "coalesce(log->>'as', case when name ~* 'padel' or sport in ('Padel', 'Racquetball', 'Squash', 'Tennis', 'Pickleball') then 'padel' end) = 'padel'",
  ride: `coalesce(log->>'as', case when name !~* 'padel' and sport in (${RIDE_SPORTS.map((x) => `'${x}'`).join(", ")}) then 'ride' end) = 'ride'`,
  gym: "coalesce(log->>'as', case when name !~* 'padel' and sport in ('WeightTraining', 'Workout', 'Crossfit', 'HighIntensityIntervalTraining') then 'gym' end) = 'gym'",
  other: "true",
};
export async function adminActivities(q: string, offset: number, kind = "") {
  const like = `%${q.trim().toLowerCase()}%`;
  const where = `lower(name || ' ' || sport || ' ' || start_local) like $1 and ${kind in KINDS_SQL ? KINDS_SQL[kind as Kind] : "true"}`;
  const rows = await query<{ id: string; sport: string; name: string; start_local: string; distance: number; moving: number; hr: number | null; hidden: boolean; log: ActivityLog | null }>(`select id::text, sport, name, start_local, distance, moving, hr, hidden, log from activities where ${where} order by start_local desc limit 50 offset $2`, [like, offset]);
  const [{ count }] = await query<{ count: string }>(`select count(*) from activities where ${where}`, [like]);
  return { total: Number(count), items: rows.map((r) => ({ ...r, hr: r.hr ?? undefined, log: r.log ?? {}, kind: kindOfActivity(r.sport, r.name, r.log) })) };
}
export async function adminActivity(id: string) {
  const rows = await query<{ id: string; sport: string; name: string; start_local: string; distance: number; moving: number; hr: number | null; hidden: boolean; log: ActivityLog | null; cadence: number | null }>("select id::text, sport, name, start_local, distance, moving, hr, hidden, log, (summary->>'average_cadence')::real as cadence from activities where id = $1", [id]);
  const r = rows[0];
  if (!r) return undefined;
  const { cadence, ...rest } = r;
  return { ...rest, hr: r.hr ?? undefined, log: r.log ?? {}, kind: kindOfActivity(r.sport, r.name, r.log), has: { hr: r.hr !== null, cadence: cadence !== null } };
}
export async function setHidden(id: string, hidden: boolean) {
  await query("update activities set hidden = $2 where id = $1", [id, hidden]);
  forgetSport();
}


// ---- The run log --------------------------------------------------------------------------------------------------- The log began as a…
export async function importRunLog() {
  const runs = seedRuns();
  const [{ count: before }] = await query<{ count: string }>("select count(*) from activities where id < 0");
  for (const r of runs) await insertHandRun(r);
  for (const r of runs) {
    const h = healthIn(r.note);
    if (h.vo2max) await query("insert into health (metric, day, value) values ('vo2max', $1, $2) on conflict do nothing", [r.date, h.vo2max]);
    if (h.weight) await query("insert into health (metric, day, value) values ('weight', $1, $2) on conflict do nothing", [r.date, h.weight]);
  }
  await mergeHandRuns();
  const [{ count: after }] = await query<{ count: string }>("select count(*) from activities where id < 0");
  forgetSport();
  return { runs: runs.length, added: Number(after) - Number(before) };
}
// How many runs the spreadsheet holds, and how many hand-made activities are in the database already.
export async function runLogState() {
  const [{ count }] = await query<{ count: string }>("select count(*) from activities where id < 0");
  return { spreadsheet: seedRuns().length, byHand: Number(count) };
}
const logOf = (r: LogRun): RunNote => ({ type: r.type || undefined, feel: r.feel || undefined, note: r.note || undefined, efforts: r.efforts || undefined, cadence: r.cadence || undefined });
async function insertHandRun(r: LogRun) {
  await query(
    `insert into activities (id, sport, name, start_utc, start_local, distance, moving, elapsed, climb, hr, summary, log)
     values ($1, 'Run', $2, $3, $4, $5, $6, $6, 0, $7, '{"source":"hand"}', $8) on conflict (id) do nothing`,
    [r.id, r.type === "S" ? "Race" : "Run", `${r.date}T12:00:00Z`, `${r.date}T12:00:00`, Math.round(r.km * 1000), Math.round(r.time), r.hr ?? null, JSON.stringify(logOf(r))],
  );
}
// When Strava brings in a run that was already typed in by hand (same day, within three per cent of the distance), the typed one's notes move onto…
async function mergeHandRuns() {
  const pairs = await query<{ hand: string; real: string; log: RunNote; had: RunNote }>(
    `select h.id::text as hand, s.id::text as real, h.log, s.log as had from activities h join activities s
       on s.id > 0 and s.sport in ('Run', 'TrailRun', 'VirtualRun') and left(s.start_local, 10) = left(h.start_local, 10) and abs(s.distance - h.distance) <= greatest(150, h.distance * 0.03)
     where h.id < 0`,
  );
  const used = new Set<string>();
  for (const p of pairs) {
    if (used.has(p.real) || used.has(p.hand)) continue;
    used.add(p.real).add(p.hand);
    await query("update activities set log = $2 where id = $1", [p.real, JSON.stringify({ ...p.log, ...p.had })]);
    await query("delete from activities where id = $1", [p.hand]);
  }
}

type LogRow = { id: string; day: string; distance: number; moving: number; hr: number | null; cadence: number | null; log: ActivityLog | null; hidden?: boolean; name?: string };
const toRun = (r: LogRow): LogRun => {
  const log = r.log ?? {};
  // Strava counts one foot's steps; the log, like a watch, counts both.
  const cadence = log.cadence ?? (r.cadence ? Math.round(r.cadence < 120 ? r.cadence * 2 : r.cadence) : undefined);
  return { id: String(r.id), date: r.day, time: r.moving, km: Math.round(r.distance / 10) / 100, hr: r.hr ? Math.round(r.hr) : log.hr, cadence, efforts: log.efforts, type: log.type, feel: log.feel, note: log.note, hand: Number(r.id) < 0 || undefined };
};
const RUNS = KINDS_SQL.run;
const LOG_COLUMNS = "id::text, left(start_local, 10) as day, distance, moving, hr, (summary->>'average_cadence')::real as cadence, log";
// Strava's own best efforts, written the way the spreadsheet wrote them, for runs where I wrote none.
const SHORT: Record<string, string> = { "5 km": "5K", "10 km": "10K", "15 km": "15K", "20 km": "20K", "Half marathon": "1/2", Marathon: "Marathon" };
const written = (list: Effort[] | undefined) => (list ?? []).filter((e) => SHORT[e.name]).map((e) => `${clockOf(e.time)} (${SHORT[e.name]})`).join(" ") || undefined;
const clockOf = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

export async function getLog(): Promise<RunLog> {
  if (!hasDatabase()) return { runs: [], health: [], sample: false };
  maybeSync();
  const { showWeight, showNotes } = (await getSettings()).sport;
  const rows = await query<LogRow & { best: unknown }>(`select ${LOG_COLUMNS}, detail->'best_efforts' as best from activities where not hidden and ${RUNS} order by start_local asc`);
  const runs = rows.map((r) => {
    const run = toRun(r);
    return { ...run, efforts: run.efforts ?? written(efforts(r.best)), note: !showNotes ? undefined : showWeight ? run.note : withoutWeight(run.note) };
  });
  return { runs, health: [], sample: false };
}

// A weight or a VO2 max written in a note is also kept as a health number, as it always was in the spreadsheet.
async function healthFrom(day: string, note?: string) {
  const h = healthIn(note);
  if (h.vo2max && h.vo2max >= 25 && h.vo2max <= 90) await query("insert into health (metric, day, value) values ('vo2max', $1, $2) on conflict (metric, day) do update set value = excluded.value", [day, h.vo2max]);
  if (h.weight && h.weight >= 40 && h.weight <= 200) await query("insert into health (metric, day, value) values ('weight', $1, $2) on conflict (metric, day) do update set value = excluded.value", [day, h.weight]);
}
// Saves what I wrote on an activity. It replaces what was there, so the form sends the whole of it.
export async function saveLog(id: string, raw: Record<string, unknown>) {
  const log = tidyLog(raw);
  const rows = await query<{ day: string }>("update activities set log = $2, updated_at = now() where id = $1 returning left(start_local, 10) as day", [id, JSON.stringify(log)]);
  if (rows[0]) await healthFrom(rows[0].day, log.note);
  forgetSport();
  return !!rows[0];
}
// Something Strava never saw, typed in by hand: { date, sport, name, time (seconds), km, hr }.
export async function addActivity(input: Record<string, unknown>) {
  const date = String(input.date ?? ""), time = Math.round(Number(input.time)), km = Number(input.km) || 0;
  const sport = /^[A-Za-z]{2,40}$/.test(String(input.sport ?? "")) ? String(input.sport) : "Run";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(time > 0 && time < 200000) || km < 0 || km > 500) throw new Error("It needs a date and how long it took.");
  if (sport === "Run" && !(km > 0)) throw new Error("A run needs a distance.");
  let id = "";
  for (let n = 0; n < 40 && !id; n++) {
    const tryId = `-${date.replace(/-/g, "")}${n}`;
    if (!(await query("select 1 from activities where id = $1", [tryId])).length) id = tryId;
  }
  if (!id) throw new Error("That day is full.");
  await query(
    `insert into activities (id, sport, name, start_utc, start_local, distance, moving, elapsed, climb, hr, summary, log)
     values ($1, $2, $3, $4, $5, $6, $7, $7, 0, $8, '{"source":"hand"}', '{}')`,
    [id, sport, String(input.name ?? "").trim().slice(0, 120), `${date}T12:00:00Z`, `${date}T12:00:00`, Math.round(km * 1000), time, Number(input.hr) > 30 ? Math.round(Number(input.hr)) : null],
  );
  forgetSport();
  return id;
}
// Only something made by hand can be removed here; one from Strava is hidden instead.
export async function removeActivity(id: string) {
  if (!/^-\d{1,19}$/.test(id)) throw new Error("An activity from Strava cannot be deleted here. Hide it instead.");
  await query("delete from activities where id = $1", [id]);
  forgetSport();
}

// ---- Padel ---------------------------------------------------------------------------------------------------------
export async function getPadel(): Promise<{ sessions: PadelSession[]; sample: boolean }> {
  if (!hasDatabase()) return { sessions: [], sample: false };
  const { showNotes } = (await getSettings()).sport;
  const rows = await query<{ id: string; day: string; name: string; moving: number; log: ActivityLog | null }>(`select id::text, left(start_local, 10) as day, name, moving, log from activities where not hidden and ${KINDS_SQL.padel} order by start_local desc`);
  return { sessions: rows.map((r) => ({ id: r.id, date: r.day, name: r.name, moving: r.moving, log: { ...(r.log ?? {}), note: showNotes ? r.log?.note : undefined } })), sample: false };
}

// ---- Cycling -------------------------------------------------------------------------------------------------------
export async function getRides(): Promise<{ rides: RideSession[] }> {
  if (!hasDatabase()) return { rides: [] };
  maybeSync();
  const { showNotes } = (await getSettings()).sport;
  const rows = await query<{ id: string; day: string; name: string; distance: number; moving: number; climb: number; hr: number | null; watts: number | null; log: ActivityLog | null }>(
    `select id::text, left(start_local, 10) as day, name, distance, moving, climb, hr, (summary->>'average_watts')::real as watts, log from activities where not hidden and ${KINDS_SQL.ride} order by start_local desc`,
  );
  return { rides: rows.map((r) => ({ id: r.id, date: r.day, name: r.name, distance: r.distance, moving: r.moving, climb: r.climb, hr: r.hr ? Math.round(r.hr) : undefined, watts: r.watts ? Math.round(r.watts) : undefined, log: { ...(r.log ?? {}), note: showNotes ? r.log?.note : undefined } })) };
}

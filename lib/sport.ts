import type { ActivityLog, Kind } from "./training";

// Sport: the shapes, the arithmetic and the wording.

// One activity, as lists show it. Distances are metres, times are seconds, as Strava gives them.
export type Activity = {
  id: string;
  sport: string; // Strava's name for it: Run, Ride, Swim, Hike, WeightTraining, Padel…
  name: string;
  start: string; // local time where it happened, "2026-09-14T07:32:00"
  distance: number;
  moving: number;
  elapsed: number;
  climb: number;
  hr?: number;
  maxHr?: number;
  kudos?: number;
  map?: boolean;
  sample?: boolean;
  mark?: string; // a few words from what I wrote on it: "Tempo", "Won 6-4 6-3"
};
export type Split = { n: number; distance: number; time: number; climb: number; hr?: number };
export type Effort = { name: string; distance: number; time: number };
// One activity with everything known about it, for its own page.
export type ActivityDetail = Activity & { description?: string; route?: [number, number][]; splits?: Split[]; efforts?: Effort[]; calories?: number; device?: string; log?: ActivityLog & { kind?: Kind } };

// A month of one sport, added up. Every chart and total on the sport page is worked out from these.
export type Bucket = { month: string; sport: string; count: number; distance: number; moving: number; climb: number };
export type Best = Effort & { id: string; date: string };
export type HealthSeries = { metric: Metric; points: { day: string; value: number }[] };
export type Metric = "vo2max" | "restingHr" | "weight" | "hrv" | "walkingHr" | "bodyFat" | "steps" | "activeEnergy" | "exerciseMinutes" | "respiratoryRate" | "bloodOxygen" | "sleepHours";
// Everything my phone can send about me.
export const METRIC_INFO: Record<Metric, { name: string; add?: boolean; digits: number; range: [number, number]; mine?: boolean }> = {
  vo2max: { name: "VO₂ max, ml/kg/min", digits: 1, range: [10, 100] },
  restingHr: { name: "Resting heart rate, beats a minute", digits: 0, range: [25, 150] },
  hrv: { name: "Heart rate variability, ms", digits: 0, range: [3, 300] },
  walkingHr: { name: "Walking heart rate, beats a minute", digits: 0, range: [40, 200] },
  respiratoryRate: { name: "Breathing rate, breaths a minute", digits: 1, range: [5, 40] },
  bloodOxygen: { name: "Blood oxygen, %", digits: 1, range: [70, 100] },
  sleepHours: { name: "Sleep, hours a night", add: true, digits: 1, range: [0.5, 20] },
  steps: { name: "Steps a day", add: true, digits: 0, range: [1, 150000] },
  exerciseMinutes: { name: "Exercise, minutes a day", add: true, digits: 0, range: [1, 1440] },
  activeEnergy: { name: "Active energy, kcal a day", add: true, digits: 0, range: [1, 20000] },
  weight: { name: "Weight", digits: 1, range: [30, 300], mine: true },
  bodyFat: { name: "Body fat, %", digits: 1, range: [2, 70], mine: true },
};
export type SportSummary = { sample: boolean; buckets: Bucket[]; best: Best[]; latest: Activity[]; health: HealthSeries[]; lastSync: string };

// What I have typed in myself, in the admin area.
export type Pb = { slug: string; title: string; sport: string; result: string; date: string; where?: string; note?: string; activity?: string; sample?: boolean };
export const MEASURES = ["By hand", "Distance this year (km)", "Activities this year", "Hours this year"] as const;
export type Goal = { slug: string; title: string; sport?: string; measure: (typeof MEASURES)[number]; target?: number; progress?: number; due?: string; done?: boolean; note: string; sample?: boolean };

// The running ones are from my run log (they were the "best times" table in the spreadsheet).
export const seedPbs: Pb[] = [
  { slug: "5-km", title: "5 km", sport: "Running", result: "22:48", date: "2024-12-10", activity: "-202412100" },
  { slug: "10-km", title: "10 km", sport: "Running", result: "47:51", date: "2024-12-29", activity: "-202412290" },
  { slug: "half-marathon", title: "Half marathon", sport: "Running", result: "1:56:16", date: "2024-12-22", activity: "-202412220" },
  { slug: "padel-level", title: "Padel level", sport: "Padel", result: "3.6", date: "2026-08-01", note: "Sample: the highest rating so far.", sample: true },
];
export const seedGoals: Goal[] = [
  { slug: "run-1000-km", title: "Run 1,000 km this year", sport: "Run", measure: "Distance this year (km)", target: 1000, note: "Sample goal: counted from Strava by itself.", sample: true },
  { slug: "sub-20-5k", title: "5 km in under 20 minutes", sport: "Run", measure: "By hand", progress: 55, note: "Sample goal: set how far along you are by hand.", sample: true },
  { slug: "padel-twice-a-week", title: "100 padel sessions this year", sport: "Padel", measure: "Activities this year", target: 100, note: "Sample goal.", sample: true },
];

// ---- What kind of sport it is decides what is worth showing -------------------------------------------
const FOOT = new Set(["Run", "TrailRun", "VirtualRun", "Walk", "Hike", "Snowshoe"]);
const SWIM = new Set(["Swim"]);
export const kindOf = (sport: string, distance = 1): "foot" | "swim" | "wheel" | "time" => (distance < 50 ? "time" : FOOT.has(sport) ? "foot" : SWIM.has(sport) ? "swim" : "wheel");
const NAMES: Record<string, string> = { Run: "Running", TrailRun: "Trail running", VirtualRun: "Treadmill", Ride: "Cycling", VirtualRide: "Indoor cycling", GravelRide: "Gravel", MountainBikeRide: "Mountain biking", EBikeRide: "E-bike", Swim: "Swimming", Walk: "Walking", Hike: "Hiking", WeightTraining: "Weights", Workout: "Workout", HighIntensityIntervalTraining: "HIIT", Racquetball: "Racquetball", TableTennis: "Table tennis", AlpineSki: "Skiing", NordicSki: "Cross-country skiing", RockClimbing: "Climbing", StandUpPaddling: "Paddleboarding" };
// "WeightTraining" to "Weights"; anything Strava adds later is split into words: "InlineSkate" to "Inline skate".
export const sportName = (sport: string) => NAMES[sport] ?? sport.replace(/([a-z])([A-Z])/g, (_, a: string, b: string) => `${a} ${b.toLowerCase()}`);

// ---- Units ----------------------------------------------------------------------------------------------
export type Units = "km" | "mi";
const MILE = 1609.344;
export const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
};
export const hours = (seconds: number) => (seconds >= 36000 ? `${Math.round(seconds / 3600).toLocaleString("en-GB")} h` : seconds >= 3600 ? `${Math.floor(Math.round(seconds / 60) / 60)} h${Math.round(seconds / 60) % 60 ? ` ${Math.round(seconds / 60) % 60} min` : ""}` : `${Math.round(seconds / 60)} min`);
export const dist = (metres: number, units: Units, places?: number) => {
  const v = metres / (units === "mi" ? MILE : 1000);
  return `${v.toLocaleString("en-GB", { maximumFractionDigits: places ?? (v >= 100 ? 0 : v >= 10 ? 1 : 2), minimumFractionDigits: places ?? 0 })} ${units}`;
};
export const height = (metres: number, units: Units) => (units === "mi" ? `${Math.round(metres * 3.28084).toLocaleString("en-GB")} ft` : `${Math.round(metres).toLocaleString("en-GB")} m`);
// Pace for things done on foot or in water, speed for things on wheels. "" when there is no distance.
export function rate(sport: string, metres: number, seconds: number, units: Units) {
  const kind = kindOf(sport, metres);
  if (kind === "time" || seconds <= 0) return "";
  if (kind === "swim") return `${clock((seconds / metres) * (units === "mi" ? 91.44 : 100))} /100 ${units === "mi" ? "yd" : "m"}`;
  if (kind === "foot") return `${clock((seconds / metres) * (units === "mi" ? MILE : 1000))} /${units}`;
  return `${((metres / seconds) * (units === "mi" ? 3600 / MILE : 3.6)).toFixed(1)} ${units === "mi" ? "mph" : "km/h"}`;
}
export const rateWord = (sport: string) => (kindOf(sport) === "wheel" ? "Speed" : "Pace");
export const weight = (kg: number, units: Units) => (units === "mi" ? `${(kg * 2.20462).toFixed(1)} lb` : `${kg.toFixed(1)} kg`);

// "Thu 26 Sep 2024".
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const shortDay = (date: string) => {
  const d = new Date(date.slice(0, 10) + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? date : `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
};
export const dayOf = (start: string) => `${shortDay(start)} ${start.slice(0, 4)}`;
export const timeOf = (start: string) => start.slice(11, 16);

// ---- Adding up --------------------------------------------------------------------------------------------
export function summarise(all: (Activity & { efforts?: Effort[] })[]): Pick<SportSummary, "buckets" | "best" | "latest"> {
  const buckets = new Map<string, Bucket>();
  const best = new Map<string, Best>();
  for (const a of all) {
    const key = `${a.start.slice(0, 7)}|${a.sport}`;
    const b = buckets.get(key) ?? { month: a.start.slice(0, 7), sport: a.sport, count: 0, distance: 0, moving: 0, climb: 0 };
    b.count++;
    b.distance += a.distance;
    b.moving += a.moving;
    b.climb += a.climb;
    buckets.set(key, b);
    for (const e of a.efforts ?? []) {
      const was = best.get(e.name);
      if (!was || e.time < was.time) best.set(e.name, { ...e, id: a.id, date: a.start.slice(0, 10) });
    }
  }
  const byStart = [...all].sort((a, b) => b.start.localeCompare(a.start));
  return {
    buckets: [...buckets.values()].map((b) => ({ ...b, distance: Math.round(b.distance), climb: Math.round(b.climb) })).sort((a, b) => a.month.localeCompare(b.month)),
    best: [...best.values()].sort((a, b) => a.distance - b.distance),
    latest: byStart.slice(0, 6).map(({ efforts: _efforts, ...a }) => a),
  };
}
export type ListQuery = { sport?: string; year?: string; q?: string; offset?: number; limit?: number };
export function listActivities(all: Activity[], { sport, year, q, offset = 0, limit = 30 }: ListQuery) {
  const words = (q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const found = all
    .filter((a) => (!sport || a.sport === sport) && (!year || a.start.startsWith(year)) && words.every((w) => `${a.name} ${sportName(a.sport)} ${a.start.slice(0, 10)}`.toLowerCase().includes(w)))
    .sort((a, b) => b.start.localeCompare(a.start));
  return { total: found.length, items: found.slice(offset, offset + Math.min(100, limit)) };
}
// Totals for a sport ("" for all) in a year ("" for all time).
export function total(buckets: Bucket[], sport: string, year: string) {
  const out = { count: 0, distance: 0, moving: 0, climb: 0 };
  for (const b of buckets) {
    if ((sport && b.sport !== sport) || (year && !b.month.startsWith(year))) continue;
    out.count += b.count;
    out.distance += b.distance;
    out.moving += b.moving;
    out.climb += b.climb;
  }
  return out;
}
// How far along a goal is, from 0 to 1, with the words that go next to it.
export function goalProgress(goal: Goal, buckets: Bucket[], thisYear: string) {
  if (goal.measure === "By hand" || !goal.target) return { part: goal.done ? 1 : Math.max(0, Math.min(100, goal.progress ?? 0)) / 100, words: goal.done ? "Done" : `${Math.round(goal.progress ?? 0)}%` };
  const t = total(buckets, goal.sport ?? "", thisYear);
  const have = goal.measure === "Distance this year (km)" ? t.distance / 1000 : goal.measure === "Hours this year" ? t.moving / 3600 : t.count;
  const unit = goal.measure === "Distance this year (km)" ? " km" : goal.measure === "Hours this year" ? " hours" : "";
  return { part: Math.min(1, have / goal.target), words: `${Math.round(have).toLocaleString("en-GB")} of ${goal.target.toLocaleString("en-GB")}${unit}` };
}

// ---- Routes ------------------------------------------------------------------------------------------------ Strava sends a route as one packed…
export function decodePolyline(text: string) {
  const out: [number, number][] = [];
  let at = 0, lat = 0, lon = 0;
  const next = () => {
    let shift = 0, result = 0, byte: number;
    do {
      byte = text.charCodeAt(at++) - 63;
      result |= (byte & 31) << shift;
      shift += 5;
    } while (byte >= 32 && at < text.length + 1);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (at < text.length) {
    lat += next();
    lon += next();
    out.push([lat / 1e5, lon / 1e5]);
  }
  return out;
}
const metresBetween = (a: [number, number], b: [number, number]) => {
  const rad = Math.PI / 180, x = (b[1] - a[1]) * rad * Math.cos(((a[0] + b[0]) / 2) * rad), y = (b[0] - a[0]) * rad;
  return Math.sqrt(x * x + y * y) * 6371000;
};
// Cuts the start and the end off a route, so a map never shows the front door it began and finished at.
export function trimRoute(route: [number, number][], metres: number) {
  if (metres <= 0 || route.length < 2) return route;
  let from = 0, to = route.length - 1;
  while (from < route.length && metresBetween(route[0], route[from]) < metres) from++;
  while (to > from && metresBetween(route[route.length - 1], route[to]) < metres) to--;
  // Also drop any later pass close to either end (an out-and-back comes home the way it left).
  const kept = route.slice(from, to + 1).filter((p) => metresBetween(route[0], p) >= metres && metresBetween(route[route.length - 1], p) >= metres);
  return kept.length >= 2 ? kept : [];
}

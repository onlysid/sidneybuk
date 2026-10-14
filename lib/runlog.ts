// The run log: every run with what I thought of it, a quarter at a time.
import seed from "./runlog-seed.json";
import type { HealthSeries } from "./sport";

// What I add to a run myself: what kind of run it was, how it felt, and anything worth remembering.
export type RunNote = { type?: string; feel?: number; note?: string; efforts?: string; cadence?: number };
export type LogRun = { id: string; date: string; time: number; km: number; hr?: number; cadence?: number; efforts?: string; type?: string; feel?: number; note?: string; hand?: boolean };
export type RunLog = { runs: LogRun[]; health: HealthSeries[]; sample: boolean };

// The letters from the spreadsheet's TYPE column, in the order they are offered.
export const TYPES: [string, string, string][] = [
  ["E", "Easy", "Comfortable enough to talk."],
  ["T", "Tempo", "Comfortably hard, held steady."],
  ["F", "Fast", "As quick as the distance allows."],
  ["I", "Intervals", "Hard efforts with rests between."],
  ["L", "Long", "The week's long one."],
  ["H", "Hills", "Up and down on purpose."],
  ["S", "Speed", "A race, or short and flat out."],
  ["R", "Recovery", "Coming back from a hard day or an injury."],
];
export const typeName = (letter?: string) => TYPES.find((t) => t[0] === letter)?.[1] ?? "";
export const FEELS = ["Awful", "Rough", "Fine", "Good", "Flying"];

// ---- Quarters ------------------------------------------------------------------------------------------------
export const quarterOf = (date: string) => `${date.slice(0, 4)}-Q${Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1}`;
export const quarterName = (q: string) => `${q.slice(5)} ${q.slice(0, 4)}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const quarterMonths = (q: string) => {
  const first = (Number(q.slice(6)) - 1) * 3;
  return `${MONTHS[first]} to ${MONTHS[first + 2]}`;
};
export function quartersOf(runs: LogRun[]) {
  return [...new Set(runs.map((r) => quarterOf(r.date)))].sort();
}

// ---- Any stretch of time: a week, a month, a quarter or a year ------------------------------------------------------- Every stretch has a key…
export type Span = "week" | "month" | "quarter" | "year";
export const SPANS: [Span, string][] = [["week", "Week"], ["month", "Month"], ["quarter", "Quarter"], ["year", "Year"]];
const utc = (date: string) => new Date(`${date.slice(0, 10)}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
export function spanKey(date: string, span: Span) {
  if (span === "year") return date.slice(0, 4);
  if (span === "month") return date.slice(0, 7);
  if (span === "quarter") return quarterOf(date);
  const d = utc(date);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return iso(d);
}
function nextKey(key: string, span: Span) {
  if (span === "year") return String(Number(key) + 1);
  if (span === "quarter") return key.endsWith("Q4") ? `${Number(key.slice(0, 4)) + 1}-Q1` : `${key.slice(0, 6)}${Number(key.slice(6)) + 1}`;
  if (span === "month") return key.endsWith("-12") ? `${Number(key.slice(0, 4)) + 1}-01` : `${key.slice(0, 5)}${String(Number(key.slice(5)) + 1).padStart(2, "0")}`;
  const d = utc(key);
  d.setUTCDate(d.getUTCDate() + 7);
  return iso(d);
}
// Every stretch from the first run to the last, the empty ones included, so a gap shows as a gap.
export function spansOf(runs: LogRun[], span: Span) {
  if (!runs.length) return [];
  const keys = runs.map((r) => spanKey(r.date, span)).sort();
  const out: string[] = [];
  for (let k = keys[0]; k <= keys[keys.length - 1] && out.length < 2000; k = nextKey(k, span)) out.push(k);
  return out;
}
export function spanName(key: string, span: Span) {
  if (span === "year") return key;
  if (span === "quarter") return quarterName(key);
  if (span === "month") return `${MONTHS_LONG[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`;
  const from = utc(key), to = utc(key);
  to.setUTCDate(to.getUTCDate() + 6);
  const same = from.getUTCMonth() === to.getUTCMonth();
  return `${from.getUTCDate()}${same ? "" : ` ${MONTHS[from.getUTCMonth()]}`} to ${to.getUTCDate()} ${MONTHS[to.getUTCMonth()]} ${to.getUTCFullYear()}`;
}
// What goes under a bar: short, and for weeks only where a month begins.
export function spanTick(key: string, span: Span): [string, string] {
  if (span === "year") return [key, ""];
  if (span === "quarter") return [key.slice(5), key.slice(2, 4)];
  if (span === "month") return [MONTHS[Number(key.slice(5)) - 1], key.slice(5) === "01" ? key.slice(2, 4) : ""];
  const d = utc(key);
  return d.getUTCDate() <= 7 ? [MONTHS[d.getUTCMonth()], d.getUTCMonth() === 0 ? String(d.getUTCFullYear()).slice(2) : ""] : ["", ""];
}
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ---- Best times ---------------------------------------------------------------------------------------------- The spreadsheet's "Time (Distance)"…
export const DISTANCES: [string, string, number][] = [
  ["5K", "5 km", 5],
  ["10K", "10 km", 10],
  ["15K", "15 km", 15],
  ["20K", "20 km", 20],
  ["HALF", "Half marathon", 21.0975],
  ["MARATHON", "Marathon", 42.195],
];
const keyOf = (label: string) => {
  const k = label.toUpperCase().replace(/[\s.]/g, "");
  return k === "1/2" || k.startsWith("HALF") || k === "HM" || k === "1/2MARATHON" ? "HALF" : k === "FULL" || k === "MARATHON" ? "MARATHON" : k.replace(/KM$/, "K");
};
export function effortsIn(text?: string): { key: string; time: number }[] {
  const out: { key: string; time: number }[] = [];
  for (const m of (text ?? "").matchAll(/(\d+(?::\d+){1,2}|\d+\s*m\s*\d+\s*s)\s*\(([^)]+)\)/gi)) {
    const parts = m[1].includes(":") ? m[1].split(":").map(Number) : (m[1].match(/\d+/g) ?? []).map(Number);
    out.push({ key: keyOf(m[2]), time: parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + (parts[1] ?? 0) });
  }
  return out;
}
export type Best = { key: string; name: string; time: number; date: string; id: string };
// The best time for each distance among these runs: from the times written beside a run, and from any run that was the distance itself (within two…
export function bestsOf(runs: LogRun[]): Best[] {
  const best = new Map<string, Best>();
  const offer = (key: string, time: number, r: LogRun) => {
    const d = DISTANCES.find((x) => x[0] === key);
    if (!d || time <= 0) return;
    const was = best.get(key);
    if (!was || time < was.time) best.set(key, { key, name: d[1], time, date: r.date, id: r.id });
  };
  for (const r of runs) {
    for (const e of effortsIn(r.efforts)) offer(e.key, e.time, r);
    for (const [key, , km] of DISTANCES) if (r.km >= km && r.km <= km * 1.02) offer(key, Math.round((r.time * km) / r.km), r);
  }
  return DISTANCES.map((d) => best.get(d[0])).filter((b): b is Best => !!b);
}

// ---- The averages under each sheet ------------------------------------------------------------------------------
const mean = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
export function statsOf(runs: LogRun[]) {
  const km = runs.reduce((a, r) => a + r.km, 0), time = runs.reduce((a, r) => a + r.time, 0);
  const typed = runs.filter((r) => r.type);
  const paces = runs.filter((r) => r.km >= 1).map((r) => r.time / r.km);
  const felt = runs.filter((r) => r.feel);
  return {
    count: runs.length,
    km,
    time,
    avgKm: runs.length ? km / runs.length : 0,
    avgTime: runs.length ? time / runs.length : 0,
    // The average of each run's pace, as the spreadsheet had it (not total time over total distance).
    avgPace: mean(paces),
    bestPace: paces.length ? Math.min(...paces) : 0,
    furthest: runs.length ? Math.max(...runs.map((r) => r.km)) : 0,
    hr: mean(runs.filter((r) => r.hr).map((r) => r.hr!)),
    cadence: mean(runs.filter((r) => r.cadence).map((r) => r.cadence!)),
    easy: typed.length ? typed.filter((r) => r.type === "E" || r.type === "R").length / typed.length : null,
    feel: felt.length ? mean(felt.map((r) => r.feel!)) : null,
  };
}
export const paceOf = (r: LogRun) => (r.km > 0 ? r.time / r.km : 0);

// ---- Weight and VO2 max, which I used to write in the notes --------------------------------------------------------
export function healthIn(note: string | undefined) {
  const text = note ?? "";
  const vo2 = /(\d{2}(?:\.\d+)?)\s*vo2/i.exec(text) ?? /vo2\s*max[^0-9]{0,24}?(\d{2}(?:\.\d+)?)/i.exec(text);
  const kg = /(\d{2,3}(?:\.\d+)?)\s*kg/i.exec(text);
  return { vo2max: vo2 ? Number(vo2[1]) : undefined, weight: kg ? Number(kg[1]) : undefined };
}
// With weight kept private, a note that mentions it has that part taken out before anyone else sees it.
export const withoutWeight = (note?: string) => {
  const out = (note ?? "").replace(/(weight\s*)?\d{2,3}(\.\d+)?\s*kg!?(\s*\([^)]*\))?/gi, "").replace(/^[\s.,;:!]+|[\s,;:]+$/g, "").replace(/\s{2,}/g, " ").trim();
  return out || undefined;
};

// ---- The spreadsheet itself, brought in as the starting log ---------------------------------------------------------
type SeedRow = [date: string, seconds: number, km: number, hr: number | null, cadence: number | null, efforts: string | null, type: string | null, note: string | null];
export function seedRuns(): LogRun[] {
  const seen = new Map<string, number>();
  return (seed as SeedRow[]).map(([date, time, km, hr, cadence, efforts, type, note]) => {
    const n = seen.get(date) ?? 0;
    seen.set(date, n + 1);
    // A made-by-hand run has a negative number, so it can never collide with one from Strava.
    return { id: `-${date.replace(/-/g, "")}${n}`, date, time, km, hr: hr ?? undefined, cadence: cadence ?? undefined, efforts: efforts ?? undefined, type: type ?? undefined, note: note ?? undefined, hand: true };
  });
}
export function seedHealth(runs: LogRun[]): HealthSeries[] {
  const vo2: { day: string; value: number }[] = [], kg: { day: string; value: number }[] = [];
  for (const r of runs) {
    const h = healthIn(r.note);
    if (h.vo2max && h.vo2max >= 25 && h.vo2max <= 90) vo2.push({ day: r.date, value: h.vo2max });
    if (h.weight && h.weight >= 40 && h.weight <= 200) kg.push({ day: r.date, value: h.weight });
  }
  return [
    { metric: "vo2max", points: vo2 },
    { metric: "weight", points: kg },
  ];
}

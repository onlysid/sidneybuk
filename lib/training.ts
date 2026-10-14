// What I add to an activity after it has arrived from Strava.
import type { RunNote } from "./runlog";

export type PadelNote = { kind?: string; sets?: [number, number][]; partner?: string; opponents?: string; side?: string };
export type MediaItem = { src: string; caption?: string };
export type Extra = { label: string; value: string };
// A ride: what sort of ride it was, which bike, and who came.
export type RideNote = { kind?: string; bike?: string; with?: string };
export type ActivityLog = RunNote & { as?: Kind; hr?: number; padel?: PadelNote; ride?: RideNote; media?: MediaItem[]; extras?: Extra[] };

export type Kind = "run" | "ride" | "gym" | "padel" | "other";
export const KIND_NAMES: Record<Kind, string> = { run: "Run", ride: "Ride", gym: "Gym", padel: "Padel", other: "Something else" };
export const RIDE_SPORTS = ["Ride", "VirtualRide", "EBikeRide", "GravelRide", "MountainBikeRide", "EMountainBikeRide", "Handcycle", "Velomobile"];
const RIDE = new Set(RIDE_SPORTS);
export const RIDE_KINDS = ["Easy", "Endurance", "Tempo", "Intervals", "Hills", "Commute", "Social", "Race"];
const RUN = new Set(["Run", "TrailRun", "VirtualRun"]);
const GYM = new Set(["WeightTraining", "Workout", "Crossfit", "HighIntensityIntervalTraining"]);
const PADEL = new Set(["Padel", "Racquetball", "Squash", "Tennis", "Pickleball"]);
// What an activity is taken to be: what I said it was, or else worked out from Strava's sport and its name.
export function kindOfActivity(sport: string, name = "", log?: ActivityLog | null): Kind {
  if (log?.as) return log.as;
  if (/padel/i.test(name)) return "padel";
  return RUN.has(sport) ? "run" : RIDE.has(sport) ? "ride" : PADEL.has(sport) ? "padel" : GYM.has(sport) ? "gym" : "other";
}

export const PADEL_KINDS = ["Match", "Friendly", "Training", "League", "Tournament"];
// Sets as "6-4 3-6 7-5", my side first.
export const scoreOf = (sets?: [number, number][]) => (sets ?? []).map(([a, b]) => `${a}-${b}`).join(" ");
// Who won: the side with more sets (or more games, if the sets are level and it was left there).
export function padelResult(sets?: [number, number][]): "won" | "lost" | "drew" | null {
  const played = (sets ?? []).filter(([a, b]) => a + b > 0);
  if (!played.length) return null;
  const mine = played.filter(([a, b]) => a > b).length, theirs = played.filter(([a, b]) => b > a).length;
  if (mine !== theirs) return mine > theirs ? "won" : "lost";
  const games = played.reduce((n, [a, b]) => n + a - b, 0);
  return games > 0 ? "won" : games < 0 ? "lost" : "drew";
}

// Has anything been written on it yet?
export const writtenUp = (log?: ActivityLog | null) =>
  !!log && !!(log.type || log.feel || log.note || log.efforts || log.ride?.kind || log.ride?.bike || log.padel?.kind || log.padel?.sets?.length || log.media?.length || log.extras?.length);
// A few words for a row in a list: "Tempo", "Won 6-4 6-3", "Training".
export function markOf(kind: Kind, log?: ActivityLog | null, typeName: (letter?: string) => string = (l) => l ?? "") {
  if (!log) return "";
  if (kind === "padel") {
    const result = padelResult(log.padel?.sets);
    return result ? `${result[0].toUpperCase()}${result.slice(1)} ${scoreOf(log.padel?.sets)}` : (log.padel?.kind ?? "");
  }
  if (kind === "ride") return log.ride?.kind ?? "";
  return kind === "run" ? typeName(log.type) : "";
}

const text = (v: unknown, most: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, most) : undefined);
// Whatever arrives from a form, cut down to what is allowed.
export function tidyLog(n: Record<string, unknown>): ActivityLog {
  const padel = (n.padel ?? {}) as Record<string, unknown>;
  const sets = (Array.isArray(padel.sets) ? padel.sets : [])
    .map((s) => (Array.isArray(s) ? [Math.round(Number(s[0])), Math.round(Number(s[1]))] : [NaN, NaN]) as [number, number])
    .filter(([a, b]) => a >= 0 && b >= 0 && a <= 99 && b <= 99)
    .slice(0, 9);
  const p: PadelNote = { kind: text(padel.kind, 30), sets: sets.length ? sets : undefined, partner: text(padel.partner, 80), opponents: text(padel.opponents, 120), side: text(padel.side, 20) };
  const ride = (n.ride ?? {}) as Record<string, unknown>;
  const r: RideNote = { kind: text(ride.kind, 30), bike: text(ride.bike, 60), with: text(ride.with, 120) };
  const media = (Array.isArray(n.media) ? n.media : []).map((m) => ({ src: text((m as MediaItem)?.src, 500000) ?? "", caption: text((m as MediaItem)?.caption, 200) })).filter((m) => m.src).slice(0, 24);
  const extras = (Array.isArray(n.extras) ? n.extras : []).map((e) => ({ label: text((e as Extra)?.label, 40) ?? "", value: text((e as Extra)?.value, 120) ?? "" })).filter((e) => e.label && e.value).slice(0, 20);
  return {
    as: n.as === "run" || n.as === "ride" || n.as === "gym" || n.as === "padel" || n.as === "other" ? n.as : undefined,
    type: typeof n.type === "string" && /^[A-Z]$/.test(n.type) ? n.type : undefined,
    feel: Number(n.feel) >= 1 && Number(n.feel) <= 5 ? Math.round(Number(n.feel)) : undefined,
    note: text(n.note, 4000),
    efforts: text(n.efforts, 120),
    cadence: Number(n.cadence) >= 60 && Number(n.cadence) <= 260 ? Math.round(Number(n.cadence)) : undefined,
    hr: Number(n.hr) >= 30 && Number(n.hr) <= 240 ? Math.round(Number(n.hr)) : undefined,
    padel: Object.values(p).some(Boolean) ? p : undefined,
    ride: Object.values(r).some(Boolean) ? r : undefined,
    media: media.length ? media : undefined,
    extras: extras.length ? extras : undefined,
  };
}

// ---- Padel, added up ---------------------------------------------------------------------------------------------
export type PadelSession = { id: string; date: string; name: string; moving: number; log: ActivityLog; sample?: boolean };
export function padelStats(list: PadelSession[]) {
  const scored = list.filter((s) => padelResult(s.log.padel?.sets));
  const won = scored.filter((s) => padelResult(s.log.padel?.sets) === "won").length, lost = scored.filter((s) => padelResult(s.log.padel?.sets) === "lost").length;
  let setsWon = 0, setsLost = 0, streak = 0;
  for (const s of scored) for (const [a, b] of s.log.padel?.sets ?? []) a > b ? setsWon++ : b > a ? setsLost++ : 0;
  for (const s of [...scored].sort((a, b) => b.date.localeCompare(a.date))) {
    if (padelResult(s.log.padel?.sets) !== "won") break;
    streak++;
  }
  const kinds = new Map<string, number>();
  for (const s of list) kinds.set(s.log.padel?.kind ?? "Not said", (kinds.get(s.log.padel?.kind ?? "Not said") ?? 0) + 1);
  return { sessions: list.length, time: list.reduce((n, s) => n + s.moving, 0), played: scored.length, won, lost, setsWon, setsLost, streak, kinds: [...kinds.entries()].sort((a, b) => b[1] - a[1]) };
}

// ---- Cycling, added up ---------------------------------------------------------------------------------------------
export type RideSession = { id: string; date: string; name: string; distance: number; moving: number; climb: number; hr?: number; watts?: number; log: ActivityLog };
export function rideStats(list: RideSession[]) {
  const distance = list.reduce((n, r) => n + r.distance, 0), moving = list.reduce((n, r) => n + r.moving, 0);
  const kinds = new Map<string, number>();
  for (const r of list) kinds.set(r.log.ride?.kind ?? "Not said", (kinds.get(r.log.ride?.kind ?? "Not said") ?? 0) + 1);
  return {
    rides: list.length,
    distance,
    moving,
    climb: list.reduce((n, r) => n + r.climb, 0),
    // Metres a second over everything, so a long ride counts for more than a short one.
    speed: moving ? distance / moving : 0,
    longest: list.reduce((best, r) => (r.distance > (best?.distance ?? 0) ? r : best), null as RideSession | null),
    kinds: [...kinds.entries()].sort((a, b) => b[1] - a[1]),
  };
}

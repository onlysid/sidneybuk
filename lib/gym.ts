// The gym log: each machine or exercise, and the weight it has been done at, time after time.
export type LiftEntry = { date: string; value: string; note?: string };
export type Lift = { slug: string; title: string; unit: string; step: number; note?: string; start?: string; log: LiftEntry[] };

// The machines I use, from the note on my phone.
const machine = (title: string, start: number | string, note?: string, unit = "kg"): Lift => ({ slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"), title, unit, step: 2.5, note, start: start === "" ? undefined : String(start), log: [] });
export const seedLifts: Lift[] = [
  machine("Rowing", "5 min · 1.25 km", "Warm-up.", ""),
  machine("Adductor", 60, "Cannot get my legs very wide."),
  machine("Low row", 52.5),
  machine("Shoulder press", 25, "Harder."),
  machine("Abductor", 70, "Maxed out."),
  machine("Chest press", 42.5),
  machine("Leg extensions", 40),
  machine("Pectorals", 30),
  machine("Leg curls", 47.5),
  machine("Leg press", 110),
  machine("Lat machine", ""),
];

export const numberOf = (value?: string) => {
  const n = parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
// Only entries with a day count: an entry without one is not a session.
export const dated = (lift: Lift) => lift.log.filter((e) => !!e.date).sort((a, b) => a.date.localeCompare(b.date));
export const lastOf = (lift: Lift): LiftEntry | undefined => dated(lift).slice(-1)[0];
// Is it a weight (a number with a unit), or something written out, like "5 min · 1.25 km"?
export const counted = (lift: Lift) => !!lift.unit;
export const say = (lift: Lift, value?: string) => (value === undefined || value === "" ? "–" : counted(lift) ? `${value} ${lift.unit}` : value);
// The days there is a record of going, newest first, with what was done on each.
export function sessions(lifts: Lift[]) {
  const days = new Map<string, { title: string; value: string }[]>();
  for (const l of lifts) for (const e of l.log) if (e.date) days.set(e.date, [...(days.get(e.date) ?? []), { title: l.title, value: say(l, e.value) }]);
  return [...days.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, done]) => ({ date, done }));
}
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// Marks an exercise as done on a day at a value: one entry a day, so doing it again that day changes it.
export function logged(lift: Lift, date: string, value: string): Lift {
  const rest = lift.log.filter((e) => e.date !== date);
  return { ...lift, log: [...rest, { date, value }] };
}
export const unlogged = (lift: Lift, date: string): Lift => ({ ...lift, log: lift.log.filter((e) => e.date !== date) });

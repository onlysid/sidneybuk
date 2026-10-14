// Made-up activities, so the sport pages have something to show before Strava is connected (and in the preview, which has no server).
import type { Activity, ActivityDetail, Effort, HealthSeries, Split } from "./sport";

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pad = (n: number) => String(n).padStart(2, "0");
const EFFORTS: [string, number][] = [["1 km", 1000], ["1 mile", 1609], ["5 km", 5000], ["10 km", 10000], ["Half marathon", 21097]];
const RUNS = ["Morning run", "Easy miles", "Tempo", "Long run", "Lunch run", "Intervals", "Recovery jog", "River loop"];
const RIDES = ["Coffee ride", "Hills", "Evening spin", "Long ride", "Commute"];
const PADEL = ["Padel", "Padel: league match", "Padel with friends", "Padel: lesson"];

let made: ActivityDetail[] | null = null;
export function sampleActivities(today = new Date()): ActivityDetail[] {
  if (made) return made;
  const rnd = seeded(20260914);
  const out: ActivityDetail[] = [];
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const first = Date.UTC(today.getUTCFullYear() - 3, 0, 1);
  let id = 9000000000;
  for (let day = first; day <= end; day += 86400000) {
    const date = new Date(day);
    const years = (day - first) / (365.25 * 86400000); // fitter as the years go by
    const season = 0.85 + 0.25 * Math.sin(((date.getUTCMonth() - 2) / 12) * Math.PI * 2); // more in summer
    const add = (sport: string, names: string[], hour: number, fill: (a: ActivityDetail) => void) => {
      const a: ActivityDetail = { id: String(id++), sport, name: names[Math.floor(rnd() * names.length)], start: `${date.toISOString().slice(0, 10)}T${pad(hour)}:${pad(Math.floor(rnd() * 60))}:00`, distance: 0, moving: 0, elapsed: 0, climb: 0, kudos: Math.floor(rnd() * 14), sample: true };
      fill(a);
      a.elapsed = Math.round(a.moving * (1.02 + rnd() * 0.12));
      out.push(a);
    };
    if (rnd() < 0.36 * season) {
      add("Run", RUNS, rnd() < 0.6 ? 7 : 18, (a) => {
        const long = date.getUTCDay() === 0;
        const km = long ? 14 + rnd() * 9 : 4 + rnd() * 7;
        const pace = (332 - years * 14) * (0.94 + rnd() * 0.14) * (long ? 1.05 : 1); // seconds per km
        if (long) a.name = "Long run";
        a.distance = Math.round(km * 1000);
        a.moving = Math.round(km * pace);
        a.climb = Math.round(km * (4 + rnd() * 9));
        a.hr = Math.round(146 + rnd() * 16);
        a.maxHr = a.hr + Math.round(12 + rnd() * 14);
        a.map = true;
        a.calories = Math.round(km * 68);
        a.device = "Sample watch";
        a.efforts = EFFORTS.filter(([, m]) => m <= a.distance).map(([name, m]): Effort => ({ name, distance: m, time: Math.round((m / 1000) * pace * (0.84 + 0.045 * Math.log2(m / 1000 + 1) + rnd() * 0.03)) }));
      });
    }
    if (rnd() < 0.13 * season) {
      add("Ride", RIDES, 9, (a) => {
        const km = 22 + rnd() * 60;
        a.distance = Math.round(km * 1000);
        a.moving = Math.round((km / (24.5 + years * 0.8 + rnd() * 4)) * 3600);
        a.climb = Math.round(km * (6 + rnd() * 10));
        a.hr = Math.round(132 + rnd() * 18);
        a.map = true;
        a.calories = Math.round(km * 26);
      });
    }
    if (rnd() < 0.24) add("Padel", PADEL, 19, (a) => ((a.moving = 3600 + Math.round(rnd() * 3) * 900), (a.hr = Math.round(128 + rnd() * 16)), (a.calories = Math.round(a.moving / 6))));
    if (rnd() < 0.2) add("WeightTraining", ["Weights", "Legs", "Upper body", "Core"], 12, (a) => ((a.moving = 2100 + Math.round(rnd() * 1800)), (a.hr = Math.round(104 + rnd() * 14))));
    if (rnd() < 0.05 * season) add("Swim", ["Pool swim", "Open water"], 6, (a) => ((a.distance = 800 + Math.round(rnd() * 12) * 100), (a.moving = Math.round((a.distance / 100) * (118 + rnd() * 14)))));
    if (rnd() < 0.035 * season) {
      add("Hike", ["Hike", "Up a hill and back", "Coast path"], 10, (a) => {
        const km = 8 + rnd() * 14;
        a.distance = Math.round(km * 1000);
        a.moving = Math.round(km * (760 + rnd() * 160));
        a.climb = Math.round(km * (30 + rnd() * 45));
        a.map = true;
      });
    }
  }
  return (made = out);
}

// The rest of one sample activity: a route to draw, and how each kilometre went.
export function sampleDetail(id: string): ActivityDetail | undefined {
  const a = sampleActivities().find((x) => x.id === id);
  if (!a) return undefined;
  const rnd = seeded(Number(id.slice(-6)));
  const out: ActivityDetail = { ...a, description: "A sample activity. Connect Strava in the admin area and your own take its place, with whatever you wrote on Strava shown here." };
  if (a.map) {
    // A wobbly loop, the right length for the distance. It follows no real roads; it is centred on Cambridge so the map has something under it.
    const n = 140, r = a.distance / (2 * Math.PI) / 111000 / 1.25, wob = [rnd() * 6, rnd() * 6, rnd() * 6];
    out.route = Array.from({ length: n + 1 }, (_, k): [number, number] => {
      const t = (k / n) * Math.PI * 2;
      const rr = r * (1 + 0.28 * Math.sin(2 * t + wob[0]) + 0.16 * Math.sin(3 * t + wob[1]) + 0.08 * Math.sin(7 * t + wob[2]));
      return [52.215 + rr * Math.sin(t), 0.095 + (rr * Math.cos(t)) / Math.cos((52.2 * Math.PI) / 180)];
    });
  }
  if (a.sport === "Run" || a.sport === "Hike") {
    const whole = Math.floor(a.distance / 1000), pace = a.moving / (a.distance / 1000);
    const splits: Split[] = Array.from({ length: whole }, (_, k) => ({ n: k + 1, distance: 1000, time: Math.round(pace * (0.94 + rnd() * 0.12)), climb: Math.round((rnd() - 0.5) * 24), hr: a.hr ? Math.round(a.hr - 8 + (k / Math.max(1, whole)) * 14 + rnd() * 4) : undefined }));
    const rest = a.distance - whole * 1000;
    if (rest > 50) splits.push({ n: whole + 1, distance: rest, time: Math.round((pace * rest) / 1000), climb: 0, hr: a.hr });
    out.splits = splits;
  }
  return out;
}

export function sampleHealth(today = new Date()): HealthSeries[] {
  const rnd = seeded(77);
  const vo2: HealthSeries = { metric: "vo2max", points: [] }, rest: HealthSeries = { metric: "restingHr", points: [] };
  for (let w = 130; w >= 0; w--) {
    const day = new Date(today.getTime() - w * 7 * 86400000).toISOString().slice(0, 10);
    const fit = (130 - w) / 130;
    vo2.points.push({ day, value: Math.round((44.5 + fit * 6.5 + Math.sin(w / 9) * 1.1 + (rnd() - 0.5) * 0.8) * 10) / 10 });
    rest.points.push({ day, value: Math.round(58 - fit * 7 + Math.sin(w / 7) * 1.5 + (rnd() - 0.5) * 2) });
  }
  return [vo2, rest];
}
export const sampleList = (): Activity[] => sampleActivities().map(({ efforts: _e, calories: _c, device: _d, ...a }) => a);

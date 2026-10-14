// Shared by the globe on the travel page and the map in the admin area: naming what is at a point, and the lines between states, provinces and regions.

export type City = [name: string, country: string, lat: number, lon: number];

// Every city of 50,000 people or more and every capital (from GeoNames), biggest first.
let cities: City[] | null = null;
export const loadCities = () => (cities ? Promise.resolve(cities) : import("@/lib/cities.json").then((m) => (cities = (m.default ?? m) as unknown as City[])));
export const citiesNow = () => cities;

export const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
};
const kmBetween = (aLat: number, aLon: number, bLat: number, bLon: number) => {
  const rad = Math.PI / 180, x = (bLon - aLon) * rad * Math.cos(((aLat + bLat) / 2) * rad), y = (bLat - aLat) * rad;
  return Math.sqrt(x * x + y * y) * 6371;
};

// What to call a point on the map.
export function nearestCity(lat: number, lon: number, reach = 40) {
  reach = Math.max(2, Math.min(120, reach));
  const far = Math.max(60, reach * 2);
  const span = far / 100; // degrees of latitude worth looking at
  let big: City | null = null, bigKm = 0, close: City | null = null, closeKm = far;
  for (const c of cities ?? []) {
    if (Math.abs(c[2] - lat) > span) continue;
    const d = kmBetween(lat, lon, c[2], c[3]);
    if (!big && d <= reach) (big = c), (bigKm = d);
    if (d < closeKm) (close = c), (closeKm = d);
    if (big && close === big) break;
  }
  const best = big ?? close;
  if (!best) return null;
  const km = big ? bigKm : closeKm;
  return { name: best[0], code: best[1], country: countryName(best[1]), km: Math.round(km), within: !!big };
}

// The lines between states, provinces and regions (Natural Earth, thinned and packed small).
let states: number[][][] | null = null;
let asking: Promise<number[][][]> | null = null;
export const statesNow = () => states;
export function loadStates(): Promise<number[][][]> {
  if (states) return Promise.resolve(states);
  asking ??= fetch("/geo/states.json")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no lines"))))
    .then((packed: number[][]) => {
      // Each line is stored as steps from the point before, in hundredths of a degree.
      states = packed.map((flat) => {
        const line: number[][] = [];
        let x = 0, y = 0;
        for (let k = 0; k < flat.length; k += 2) {
          x += flat[k];
          y += flat[k + 1];
          line.push([x / 100, y / 100]);
        }
        return line;
      });
      return states;
    })
    .catch((err) => {
      asking = null;
      throw err;
    });
  return asking;
}

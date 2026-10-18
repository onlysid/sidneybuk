"use client";

import { geoGraticule10, geoMercator, geoPath } from "d3-geo";
import { api } from "@/lib/admin/api";
import { citiesNow, countryName, loadCities, loadStates, nearestCity, statesNow, type City } from "@/lib/near";
import type { FeatureCollection } from "geojson";
import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import atlas from "world-atlas/countries-110m.json";

// Choosing where a place is, without ever typing a latitude.
export type Picked = { lat: number; lon: number; name?: string; country?: string; timeZone?: string };
type Found = { id: number | string; name: string; country?: string; admin1?: string; latitude: number; longitude: number; timezone?: string };
const plain = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const coarse = feature(atlas as any, (atlas as any).objects.countries) as unknown as FeatureCollection;
let fine: FeatureCollection | null = null;
const round = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const graticule = geoGraticule10();
const MOST = 64; // as far in as the globe on the travel page goes
// The places already in the travel log and on the wish list, drawn faintly for bearings, as the globe shows them.
type Other = { name: string; lat: number; lon: number; wish: boolean };
let others: Other[] | null = null;
const loadOthers = () =>
  others
    ? Promise.resolve(others)
    : Promise.all([api.list("place").catch(() => []), api.list("wish").catch(() => [])]).then(([been, wish]) => {
        const spot = (wishing: boolean) => (e: { title: string; data: Record<string, unknown> }) => ({ name: String(e.data.name ?? e.title ?? ""), lat: Number(e.data.lat), lon: Number(e.data.lon), wish: wishing });
        return (others = [...been.map(spot(false)), ...wish.map(spot(true))].filter((o) => Number.isFinite(o.lat) && Number.isFinite(o.lon) && (o.lat !== 0 || o.lon !== 0)));
      });

// `named` is the name the place already has, if any: a tap on the map only fills the name in when there is none.
export function PlacePicker({ lat, lon, named = "", onPick }: { lat: number; lon: number; named?: string; onPick: (p: Picked) => void }) {
  const has = Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0);
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [mid, setMid] = useState<[number, number]>(has ? [lon, lat] : [10, 35]); // the middle of the map: [lon, lat]
  const [zoom, setZoom] = useState(has ? 6 : 1);
  const [world, setWorld] = useState<FeatureCollection>(fine ?? coarse);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [state, setState] = useState<"" | "looking" | "failed">("");
  const [ready, setReady] = useState(!!citiesNow());
  const [near, setNear] = useState<{ name: string; country?: string; km?: number } | null>(null);
  const asked = useRef(0);
  const zoomNow = useRef(zoom);
  zoomNow.current = zoom;
  const wNow = useRef(w);
  wNow.current = w;
  // Pinching on a trackpad arrives as a wheel turn with Ctrl held (and, in Safari, as its own gesture).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => clamp(z * Math.exp(-e.deltaY * 0.012), 1, MOST));
    };
    let from = 1;
    const start = (e: Event) => (e.preventDefault(), setZoom((z) => ((from = z), z)));
    const change = (e: Event) => (e.preventDefault(), setZoom(clamp(from * ((e as Event & { scale?: number }).scale ?? 1), 1, MOST)));
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("gesturestart", start);
    el.addEventListener("gesturechange", change);
    el.addEventListener("gestureend", start);
    return () => {
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("gesturestart", start);
      el.removeEventListener("gesturechange", change);
      el.removeEventListener("gestureend", start);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  useEffect(() => void loadCities().then(() => setReady(true), () => {}), []);
  // As the name is typed: the cities that start with it, then the ones that contain it. Biggest first.
  const local = useMemo<Found[]>(() => {
    const want = plain(q);
    if (!ready || want.length < 2) return [];
    const starts: City[] = [], holds: City[] = [];
    for (const c of citiesNow() ?? []) {
      const name = plain(c[0]);
      if (name.startsWith(want)) starts.push(c);
      else if (want.length > 2 && name.includes(want)) holds.push(c);
      if (starts.length >= 6) break;
    }
    return [...starts, ...holds].slice(0, 6).map((c) => ({ id: `${c[0]}|${c[1]}|${c[2]}`, name: c[0], country: countryName(c[1]), latitude: c[2], longitude: c[3] }));
  }, [q, ready]);
  // What is at the pin: the built-in list answers at once, and the finer answer replaces it if it arrives.
  useEffect(() => {
    if (!has) return setNear(null);
    const mine = ++asked.current;
    // A fingertip covers about this much ground at the present zoom.
    const reach = (26 * 40075 * Math.cos((lat * Math.PI) / 180)) / Math.max(1, (wNow.current || 600) * zoomNow.current);
    const known = ready ? nearestCity(lat, lon, reach) : null;
    setNear(known);
    // A city on the built-in list within reach is the answer.
    if (known?.within) return;
    const stop = new AbortController();
    fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`, { signal: stop.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { city?: string; locality?: string; countryName?: string } | null) => {
        const name = b?.city || b?.locality;
        if (name && mine === asked.current) setNear({ name, country: b?.countryName });
      })
      .catch(() => {});
    return () => stop.abort();
  }, [lat, lon, has, ready]);
  // A pin put down by hand on a place with no name yet takes the name of what is there.
  const wantName = useRef(false);
  useEffect(() => {
    if (!wantName.current || !near || named.trim()) return;
    wantName.current = false;
    onPick({ lat, lon, name: near.name, country: near.country });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near]);
  const drag = useRef<{ x: number; y: number; mid: [number, number]; moved: boolean } | null>(null);
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ apart: number; zoom: number } | null>(null);
  const [here, setHere] = useState<"" | "asking" | "refused" | "none">("");
  const spread = () => {
    const [a, b] = [...fingers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth);
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  // The finer outline is fetched once it is worth having: when the map has been zoomed in.
  useEffect(() => {
    if (zoom < 3 || fine) return void (fine && setWorld(fine));
    let live = true;
    import("world-atlas/countries-50m.json").then((m) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (m.default ?? m) as any;
      fine = feature(data, data.objects.countries) as unknown as FeatureCollection;
      if (live) setWorld(fine);
    }, () => {});
    return () => void (live = false);
  }, [zoom]);

  const h = Math.round(clamp(w * 0.62, 200, 380));
  const projection = useMemo(() => geoMercator().scale(((w || 1) / (2 * Math.PI)) * zoom).center([0, mid[1]]).rotate([-mid[0], 0]).translate([w / 2, h / 2]).clipExtent([[0, 0], [w, h]]), [w, h, mid, zoom]);
  const land = useMemo(() => (w ? geoPath(projection)(world) ?? "" : ""), [projection, world, w]);
  const pin = has ? projection([lon, lat]) : null;
  // The lines between states and provinces come in once the map is close enough for them to mean something.
  const [inner, setInner] = useState<number[][][] | null>(statesNow());
  useEffect(() => {
    if (zoom < 3.5 || inner) return;
    let live = true;
    loadStates().then((all) => live && setInner(all), () => {});
    return () => void (live = false);
  }, [zoom, inner]);
  const stateLines = useMemo(() => (w && inner && zoom >= 3.5 ? geoPath(projection)({ type: "MultiLineString", coordinates: inner }) ?? "" : ""), [projection, inner, w, zoom]);
  // Cities to aim at: the biggest in view first, more of them the closer in, none crowding another.
  const towns = useMemo(() => {
    const out: { x: number; y: number; name: string; code: string; lat: number; lon: number }[] = [];
    const all = citiesNow();
    if (!w || !ready || !all || zoom < 2) return out;
    const most = Math.min(26, Math.round(5 + zoom * 1.5));
    for (let k = 0; k < all.length && out.length < most; k++) {
      const c = all[k];
      const xy = projection([c[3], c[2]]);
      if (!xy || xy[0] < 8 || xy[0] > w - 8 || xy[1] < 8 || xy[1] > h - 8) continue;
      if (out.some((t) => Math.abs(t.x - xy[0]) < 70 && Math.abs(t.y - xy[1]) < 18)) continue;
      out.push({ x: xy[0], y: xy[1], name: c[0], code: c[1], lat: c[2], lon: c[3] });
    }
    return out;
  }, [projection, w, h, zoom, ready]);
  const lines = useMemo(() => (w ? geoPath(projection)(graticule) ?? "" : ""), [projection, w]);
  const [marks, setMarks] = useState<Other[]>(others ?? []);
  useEffect(() => void loadOthers().then(setMarks, () => {}), []);
  // Zooming with the buttons glides there, as the globe does, instead of jumping.
  const gliding = useRef(0);
  const glide = (to: number) => {
    window.cancelAnimationFrame(gliding.current);
    const target = clamp(to, 1, MOST);
    const step = () =>
      setZoom((z) => {
        const next = z + (target - z) * 0.22;
        if (Math.abs(target - next) < target * 0.004) return target;
        gliding.current = window.requestAnimationFrame(step);
        return next;
      });
    gliding.current = window.requestAnimationFrame(step);
  };
  useEffect(() => () => window.cancelAnimationFrame(gliding.current), []);

  const at = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as [number, number];
  };
  const down = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.current.size === 2) {
      // A second finger: this is a pinch now, not a drag, and letting go must not drop a pin.
      pinch.current = { apart: spread(), zoom };
      if (drag.current) drag.current.moved = true;
      return;
    }
    drag.current = { x: e.clientX, y: e.clientY, mid, moved: false };
  };
  const move = (e: React.PointerEvent) => {
    if (fingers.current.has(e.pointerId)) fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && fingers.current.size >= 2) {
      const now = spread();
      if (pinch.current.apart > 0 && now > 0) setZoom(clamp(pinch.current.zoom * (now / pinch.current.apart), 1, MOST));
      return;
    }
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    // The same hand movement covers fewer degrees the further in the map is.
    const perPx = 360 / ((w || 1) * zoom);
    setMid([((d.mid[0] - dx * perPx + 540) % 360) - 180, clamp(d.mid[1] + dy * perPx * Math.cos((d.mid[1] * Math.PI) / 180), -80, 84)]);
  };
  const up = (e: React.PointerEvent) => {
    fingers.current.delete(e.pointerId);
    if (pinch.current) {
      // The pinch is over when the last finger lifts; until then nothing else happens.
      if (fingers.current.size === 0) pinch.current = null;
      drag.current = null;
      return;
    }
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    // A tap on a city's dot is that city, exactly.
    const [tx, ty] = at(e);
    const town = towns.find((t) => Math.hypot(t.x - tx, t.y - ty) < 14);
    if (town) {
      // A place that already has a name keeps it; only its position moves to the city.
      if (named.trim()) return onPick({ lat: round(town.lat), lon: round(town.lon) });
      return choose({ id: town.name, name: town.name, country: countryName(town.code), latitude: town.lat, longitude: town.lon }, true);
    }
    const where = projection.invert?.([tx, ty]);
    if (where && Math.abs(where[1]) <= 85) {
      wantName.current = !named.trim();
      onPick({ lat: round(where[1]), lon: round(((where[0] + 540) % 360) - 180) });
    }
  };

  // "Where I am now": the device's own idea of where it is, kept to the same kilometre or so as everything else.
  const locate = () => {
    if (!("geolocation" in navigator)) return setHere("none");
    setHere("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        let timeZone: string | undefined;
        try {
          timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch {}
        wantName.current = !named.trim();
        onPick({ lat: round(latitude), lon: round(longitude), timeZone });
        setMid([longitude, latitude]);
        setZoom((z) => Math.max(z, 8));
        setHere("");
      },
      (err) => setHere(err.code === err.PERMISSION_DENIED ? "refused" : "none"),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 },
    );
  };

  const look = async () => {
    const name = q.trim();
    if (name.length < 2) return;
    setState("looking");
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=6&language=en&format=json`);
      if (!r.ok) throw new Error(String(r.status));
      setFound(((await r.json()) as { results?: Found[] }).results ?? []);
      setState("");
    } catch {
      // The built-in list is still there; only say so if it had nothing either.
      setFound(null);
      setState(local.length ? "" : "failed");
    }
  };
  const choose = (f: Found, stay = false) => {
    onPick({ lat: round(f.latitude), lon: round(f.longitude), name: f.name, country: f.country, timeZone: f.timezone });
    if (!stay) {
      setMid([f.longitude, f.latitude]);
      setZoom(Math.max(zoom, 8));
    }
    setFound(null);
    setQ("");
    wantName.current = false;
  };
  // What to offer: the built-in cities as typed, with whatever the place finder added that is not among them.
  const offered = [...local, ...(found ?? []).filter((f) => !local.some((l) => plain(l.name) === plain(f.name) && Math.abs(l.latitude - f.latitude) < 0.3))].slice(0, 8);

  return (
    <div className="pp">
      <div className="pp-find">
        <input
          type="search"
          value={q}
          onChange={(e) => (setQ(e.target.value), setFound(null), setState(""))}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault(); // this sits inside the editor's form: Enter must look the place up, not save
            look();
          }}
          placeholder="Type a town or city"
          aria-label="Find a town or city"
          autoComplete="off"
          enterKeyHint="search"
        />
        <button type="button" className="desk-btn" onClick={look} disabled={state === "looking" || q.trim().length < 2}>
          {state === "looking" ? "Looking…" : "Find more"}
        </button>
      </div>
      <button type="button" className="pp-here" onClick={locate} disabled={here === "asking"}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3" />
        </svg>
        {here === "asking" ? "Finding you…" : "Use where I am now"}
      </button>
      {here === "refused" && <p className="desk-help">This browser has not been allowed to know where it is. Allow location for this site in its settings, or find the town by name.</p>}
      {here === "none" && <p className="desk-help">Where this device is could not be worked out just now. Find the town by name, or tap the map.</p>}
      {state === "failed" && <p className="desk-help">Nothing on the built-in list by that name, and the finder for smaller places could not be reached. Drag the map and tap where it is instead.</p>}
      {(offered.length > 0 || found) && q.trim().length >= 2 && (
        <ul className="pp-found">
          {offered.length === 0 && <li className="desk-help">Nothing found by that name.</li>}
          {offered.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => choose(f)}>
                <b>{f.name}</b>
                <span>{[f.admin1, f.country].filter(Boolean).join(", ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="pp-map" ref={box} style={{ height: h }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={(e) => (fingers.current.delete(e.pointerId), (drag.current = null), fingers.current.size === 0 && (pinch.current = null))} role="application" aria-label="Map: drag to move, pinch to zoom, tap to place the pin">
        {w > 0 && (
          <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
            <path className="pp-lines" d={lines} />
            <path className="pp-land" d={land} />
            {stateLines && <path className="pp-states" d={stateLines} style={{ opacity: Math.min(1, (zoom - 3) / 3) }} />}
            {towns.map((t) => (
              <g key={`${t.name}|${t.lat}`} transform={`translate(${t.x} ${t.y})`} className="pp-town">
                <circle r="2.400" />
                <text x="6" y="4">{t.name}</text>
              </g>
            ))}
            {marks.map((o) => {
              const at = projection([o.lon, o.lat]);
              if (!at || at[0] < -10 || at[0] > w + 10 || at[1] < -10 || at[1] > h + 10) return null;
              if (has && Math.abs(o.lat - lat) < 0.02 && Math.abs(o.lon - lon) < 0.02) return null; // the one being edited has the pin
              return (
                <g key={`${o.name}|${o.lat}|${o.lon}`} transform={`translate(${at[0]} ${at[1]})`} className="pp-other" data-wish={o.wish}>
                  <circle r="3.500" />
                  {zoom >= 2.5 && <text x="7" y="4">{o.name}</text>}
                </g>
              );
            })}
            {pin && pin[0] > -20 && pin[0] < w + 20 && pin[1] > -20 && pin[1] < h + 20 && (
              <g transform={`translate(${pin[0]} ${pin[1]})`} className="pp-pin">
                <circle r="13" />
                <circle r="5" />
              </g>
            )}
          </svg>
        )}
        <div className="pp-zoom">
          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => glide(zoom * 1.8)} aria-label="Closer">
            +
          </button>
          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => glide(zoom / 1.8)} aria-label="Further away">
            −
          </button>
          {has && (
            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => (setMid([lon, lat]), glide(Math.max(zoom, 6)))} aria-label="Back to the pin">
              ◎
            </button>
          )}
        </div>
      </div>
      {has && near && (
        <p className="pp-near">
          <span>
            {near.km && near.km > 3 ? `${near.km} km from ` : "At "}
            <b>{near.name}</b>
            {near.country ? `, ${near.country}` : ""}
          </span>
          {plain(named) !== plain(near.name) && (
            <button type="button" onClick={() => onPick({ lat, lon, name: near.name, country: near.country })}>
              Use this name
            </button>
          )}
        </p>
      )}
      <p className="pp-say mono">{has ? `Pinned at ${lat.toFixed(2)}, ${lon.toFixed(2)}${near ? "" : " · no town close by"}` : "No pin yet: type a town, or tap the map"}</p>
    </div>
  );
}

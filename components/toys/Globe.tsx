"use client";

import { useContent, useSite } from "@/components/Content";
import { geoContains, geoDistance, geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { useEffect, useMemo, useRef, useState } from "react";
import { feature, mesh } from "topojson-client";
import atlas from "world-atlas/countries-110m.json";
import { site } from "@/lib/site";
import { citiesNow, countryName, loadCities, loadStates, nearestCity } from "@/lib/near";

// The mono typeface as the page has it (read once; next/font gives it a generated name).
let FACE = "";

// Where each city on the list is on the unit sphere, worked out once, so a frame can tell cheaply which are in view.
let cityXyz: [number, number, number][] | null = null;
import { TLink } from "../Transition";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const countries = (feature(atlas as any, (atlas as any).objects.countries) as unknown as FeatureCollection<Geometry, { name: string }>).features;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const land = feature(atlas as any, (atlas as any).objects.land) as unknown as Feature;
// A finer map, fetched the first time anyone reaches for the globe.
type Piece = { geo: Geometry; at: [number, number, number]; reach: number };
let fine: { land: Piece[]; coast: Piece[]; borders: Piece[] } | null = null;
let fetching = false;
const RAD = Math.PI / 180;
const xyz = (p: number[]): [number, number, number] => {
  const lon = p[0] * RAD, lat = p[1] * RAD, c = Math.cos(lat);
  return [c * Math.cos(lon), c * Math.sin(lon), Math.sin(lat)];
};
function piece(geo: Geometry, ring: number[][]): Piece {
  let x = 0, y = 0, z = 0;
  const points = ring.map(xyz);
  for (const q of points) (x += q[0]), (y += q[1]), (z += q[2]);
  const n = Math.hypot(x, y, z) || 1;
  const at: [number, number, number] = [x / n, y / n, z / n];
  let least = 1;
  for (const q of points) least = Math.min(least, q[0] * at[0] + q[1] * at[1] + q[2] * at[2]);
  return { geo, at, reach: Math.acos(Math.max(-1, Math.min(1, least))) };
}
// A long line as a run of short ones (sharing their end points), so each can be skipped on its own.
function lines(all: number[][][]): Piece[] {
  const out: Piece[] = [];
  for (const line of all) for (let k = 0; k < line.length - 1; k += 48) {
    const part = line.slice(k, k + 49);
    out.push(piece({ type: "LineString", coordinates: part }, part));
  }
  return out;
}
// The lines between states and provinces, cut into the same kind of pieces, once they have been fetched.
let inner: Piece[] | null = null;
function innerLines() {
  if (inner) return;
  loadStates().then((all) => (inner = lines(all)), () => {});
}
function finer() {
  if (fine || fetching) return;
  fetching = true;
  import("world-atlas/countries-50m.json")
    .then((m) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (m.default ?? m) as any;
      const shapes = (feature(data, data.objects.countries) as unknown as FeatureCollection).features;
      const land: Piece[] = [];
      for (const f of shapes) {
        const g = f.geometry;
        const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
        for (const coordinates of polys) land.push(piece({ type: "Polygon", coordinates }, coordinates[0]));
      }
      fine = {
        land,
        coast: lines(mesh(data, data.objects.countries, (a: unknown, b: unknown) => a === b).coordinates),
        borders: lines(mesh(data, data.objects.countries, (a: unknown, b: unknown) => a !== b).coordinates),
      };
    })
    .catch(() => (fetching = false));
}
const graticule = geoGraticule10();
// Everything that gets a pin: the places in the log, the wish list, and (if used) where I am.
type Pin = { id: string; name: string; lon: number; lat: number; kind: "been" | "here" | "wish" };
type Cluster = { x: number; y: number; pins: Pin[] };
type Pick = { name: string; lon: number; lat: number };
const MOST = 64; // how far in the globe will zoom
const NEAR = 34; // pins closer together than this many pixels are drawn as one

// A globe you can turn and zoom.
export default function Globe() {
  const { places, wishlist } = useContent();
  const site = useSite();
  // Where I am now is what the site has been told (by my phone, or in Settings).
  const { PINS, current, here } = useMemo(() => {
    const now = site.location;
    const current = now ? places.find((p) => geoDistance([p.lon, p.lat], [now.lon, now.lat]) * 6371 < 60) : places.find((p) => p.when === "Now");
    const here = current ? null : now;
    const PINS: Pin[] = [
      ...places.map((p) => ({ id: p.slug, name: p.name, lon: p.lon, lat: p.lat, kind: p === current ? ("here" as const) : ("been" as const) })),
      ...wishlist.map((p) => ({ id: `wish:${p.name}`, name: p.name, lon: p.lon, lat: p.lat, kind: "wish" as const })),
      ...(here ? [{ id: "here", name: "here now", lon: here.lon, lat: here.lat, kind: "here" as const }] : []),
    ];
    return { PINS, current, here };
  }, [places, wishlist, site.location]);
  // My own note about where I am, and whether I am away, while they are in force.
  const [clock, setClock] = useState(0);
  useEffect(() => setClock(Date.now()), []);
  const live = !!site.location && !!clock && (!site.location.until || new Date(site.location.until).getTime() > clock);
  const away = live && !!site.location?.away;
  const note = live ? site.location?.message ?? "" : "";
  const canvas = useRef<HTMLCanvasElement>(null);
  // The list of cities, so a tap on the map can be named after the nearest one.
  useEffect(() => void loadCities().catch(() => {}), []);
  const [pick, setPick] = useState<Pick | null>(null);
  const [focus, setFocus] = useState("");
  const [zoomed, setZoomed] = useState(1);
  const state = useRef({
    rot: [-8, -40] as [number, number],
    vel: [0.12, 0] as [number, number],
    zoom: 1,
    zoomTo: 1,
    radius: 200,
    drag: null as null | { x: number; y: number; moved: number },
    touches: new Map<number, { x: number; y: number }>(),
    pinch: null as null | { spread: number; zoom: number; x: number; y: number },
    labels: [] as { x: number; y: number; w: number; h: number; at: Cluster }[], // where each name was drawn, so a name can be pressed like its pin
    towns: [] as { x: number; y: number; name: string; code: string; lon: number; lat: number; box: [number, number, number, number] | null }[], // the cities drawn this frame
    fly: null as null | { from: [number, number]; to: [number, number]; start: number },
    wake: null as null | (() => void), // starts the drawing again after it has been left to rest
    pick: null as Pick | null,
    dropped: 0,
    clusters: [] as Cluster[],
    lastTap: 0,
  });

  // Turn to face a point, taking the short way round.
  const face = (lon: number, lat: number) => {
    const s = state.current;
    let from = s.rot[0] % 360;
    const to = -lon;
    if (from - to > 180) from -= 360;
    if (to - from > 180) from += 360;
    s.fly = { from: [from, s.rot[1]], to: [to, -lat], start: performance.now() };
    s.vel = [0, 0];
    s.wake?.();
  };
  // The zoom at which a pin stands clear of its nearest neighbour.
  const clearOf = (pin: Pin) => {
    const gap = Math.min(...PINS.filter((p) => p.id !== pin.id).map((p) => geoDistance([p.lon, p.lat], [pin.lon, pin.lat])));
    return Math.min(MOST, Math.max(1, ((NEAR + 14) / (gap * state.current.radius))));
  };
  const zoomBy = (factor: number) => {
    const s = state.current;
    finer();
    s.zoomTo = Math.max(1, Math.min(MOST, s.zoomTo * factor));
    s.wake?.();
  };

  useEffect(() => {
    const node = canvas.current;
    const context = node?.getContext("2d");
    if (!node || !context) return;
    const el: HTMLCanvasElement = node;
    const g: CanvasRenderingContext2D = context;
    const s = state.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const projection = geoOrthographic().clipAngle(90).precision(0.4);
    const path = geoPath(projection, g);
    // The finer map is drawn without d3 smoothing each edge into a curve: its points are close enough already.
    const plain = geoOrthographic().clipAngle(90).precision(0);
    const quick = geoPath(plain, g);
    let frame = 0, seen = true, tick = 0, shown = 1, lastTouch = performance.now();
    // Left alone, the globe stops redrawing after a while and sits still; any touch wakes it.
    const wake = () => {
      lastTouch = performance.now();
      if (!frame && seen) frame = requestAnimationFrame(draw);
    };
    s.wake = wake;
    el.addEventListener("pointerdown", wake);
    el.addEventListener("pointermove", wake);
    el.addEventListener("wheel", wake, { passive: true });
    el.addEventListener("touchstart", wake, { passive: true });
    let colours = { rose: "#ddb3cb", mauve: "#a878aa", plum: "#684780", text: "#f3eef2", edge: "rgba(255,255,255,.1)", bg: "#100c15" };
    const again = () => {
      lastTouch = performance.now();
      if (!frame && seen) frame = requestAnimationFrame(draw);
    };

    function draw(ms: number) {
      frame = 0;
      if (!seen) return;
      if (!reduce && !(ms - lastTouch > 14000 && Math.abs(s.vel[0]) < 0.002 && Math.abs(s.vel[1]) < 0.002 && Math.abs(s.zoomTo - s.zoom) < 0.002 && !s.fly)) frame = requestAnimationFrame(draw);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = el.clientWidth, h = el.clientHeight;
      if (el.width !== Math.round(w * dpr)) {
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
      }
      if (tick++ % 40 === 0) {
        const cs = getComputedStyle(el);
        const v = (n: string, d: string) => cs.getPropertyValue(n).trim() || d;
        colours = { rose: v("--rose", colours.rose), mauve: v("--mauve", colours.mauve), plum: v("--plum", colours.plum), text: v("--text", colours.text), edge: v("--edge", colours.edge), bg: v("--bg", colours.bg) };
      }
      // Zoom eases to where it has been asked to go.
      s.zoom += (s.zoomTo - s.zoom) * 0.16;
      if (Math.abs(s.zoomTo - s.zoom) < 0.002) s.zoom = s.zoomTo;
      // React only needs to hear about the zoom when one of the buttons would change.
      const stage = s.zoom <= 1.02 ? 1 : s.zoom >= MOST - 0.1 ? MOST : 2;
      if (stage !== shown) setZoomed((shown = stage));
      // Flying to a place eases the rotation there; otherwise the globe drifts (only when zoomed right out) and coasts after a drag.
      if (s.fly) {
        const k = Math.min(1, (ms - s.fly.start) / 1100);
        const e = 1 - Math.pow(1 - k, 3);
        s.rot = [s.fly.from[0] + (s.fly.to[0] - s.fly.from[0]) * e, s.fly.from[1] + (s.fly.to[1] - s.fly.from[1]) * e];
        if (k >= 1) s.fly = null;
      } else if (!s.drag && !s.touches.size) {
        const drift = s.zoomTo < 1.3 && ms - lastTouch < 14000 ? 0.12 : 0;
        s.rot = [s.rot[0] + s.vel[0], Math.max(-85, Math.min(85, s.rot[1] + s.vel[1]))];
        s.vel = [s.vel[0] * 0.96 + drift * 0.04, s.vel[1] * 0.92];
      }
      const base = Math.max(1, Math.min(w, h) / 2 - 10);
      s.radius = base;
      const r = base * s.zoom;
      // Zoomed in, only a small cap of the globe is on the canvas: everything outside it is cut away before any of the work of drawing it is done.
      const reach = Math.hypot(w, h) / 2 + 24;
      const cap = r > reach ? Math.asin(reach / r) : Math.PI / 2;
      const capDeg = Math.min(90, cap / RAD + 0.5);
      projection.rotate([s.rot[0], s.rot[1]]).translate([w / 2, h / 2]).scale(r).clipAngle(capDeg);
      plain.rotate([s.rot[0], s.rot[1]]).translate([w / 2, h / 2]).scale(r).clipAngle(capDeg);
      const mid = xyz([-s.rot[0], -s.rot[1]]);
      const inView = (p: Piece) => Math.acos(Math.max(-1, Math.min(1, p.at[0] * mid[0] + p.at[1] * mid[1] + p.at[2] * mid[2]))) < cap + p.reach;
      const centre: [number, number] = [-s.rot[0], -s.rot[1]];
      const visible = (lon: number, lat: number) => geoDistance(centre, [lon, lat]) < Math.PI / 2 - 0.05;

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const glass = g.createRadialGradient(w / 2 - r * 0.4, h / 2 - r * 0.5, r * 0.1, w / 2, h / 2, r);
      glass.addColorStop(0, "rgba(221,179,203,0.22)");
      glass.addColorStop(1, "rgba(104,71,128,0.12)");
      g.beginPath();
      path({ type: "Sphere" });
      g.fillStyle = glass;
      g.fill();
      g.strokeStyle = colours.edge;
      g.lineWidth = 1;
      g.stroke();
      g.beginPath();
      path(graticule);
      g.strokeStyle = colours.edge;
      g.lineWidth = 0.5;
      g.stroke();
      const detail = s.zoom > 3 && fine ? fine : null;
      if (detail) {
        g.beginPath();
        for (const p of detail.land) if (inView(p)) quick(p.geo);
        g.fillStyle = colours.mauve;
        g.globalAlpha = 0.5;
        g.fill();
        g.beginPath();
        for (const p of detail.borders) if (inView(p)) quick(p.geo);
        g.strokeStyle = colours.rose;
        g.globalAlpha = Math.min(0.45, (s.zoom - 1.8) * 0.2);
        g.lineWidth = 0.6;
        g.stroke();
        // States, provinces and regions, fainter than the borders between countries, once close enough.
        if (s.zoom > 4) {
          if (!inner) innerLines();
          else {
            g.beginPath();
            for (const p of inner) if (inView(p)) quick(p.geo);
            g.globalAlpha = Math.min(0.3, (s.zoom - 4) * 0.08);
            g.lineWidth = 0.5;
            g.stroke();
          }
        }
        g.beginPath();
        for (const p of detail.coast) if (inView(p)) quick(p.geo);
        g.globalAlpha = 1;
        g.lineWidth = 0.8;
        g.stroke();
      } else {
        g.beginPath();
        path(land);
        g.fillStyle = colours.mauve;
        g.globalAlpha = 0.5;
        g.fill();
        g.globalAlpha = 1;
        g.strokeStyle = colours.rose;
        g.lineWidth = 0.8;
        g.stroke();
        // Country borders come in as you zoom, when there is room for them.
        if (s.zoom > 1.8) {
          g.beginPath();
          countries.forEach((c) => path(c));
          g.strokeStyle = colours.rose;
          g.globalAlpha = Math.min(0.45, (s.zoom - 1.8) * 0.2);
          g.lineWidth = 0.6;
          g.stroke();
          g.globalAlpha = 1;
        }
      }

      // The route between the places I have been, as a moving dashed line.
      if (places.length > 1) {
        g.beginPath();
        path({ type: "LineString", coordinates: places.map((p) => [p.lon, p.lat]) });
        g.setLineDash([5, 6]);
        g.lineDashOffset = -ms / 60;
        g.strokeStyle = colours.text;
        g.globalAlpha = 0.7;
        g.lineWidth = 1.4;
        g.stroke();
        g.globalAlpha = 1;
        g.setLineDash([]);
      }

      // Gather pins that would sit on top of each other.
      const clusters: Cluster[] = [];
      for (const p of PINS) {
        if (!visible(p.lon, p.lat)) continue;
        const xy = projection([p.lon, p.lat]);
        if (!xy || xy[0] < -20 || xy[0] > w + 20 || xy[1] < -20 || xy[1] > h + 20) continue;
        const home = clusters.find((c) => Math.hypot(c.x - xy[0], c.y - xy[1]) < NEAR);
        if (home) {
          home.x = (home.x * home.pins.length + xy[0]) / (home.pins.length + 1);
          home.y = (home.y * home.pins.length + xy[1]) / (home.pins.length + 1);
          home.pins.push(p);
        } else clusters.push({ x: xy[0], y: xy[1], pins: [p] });
      }
      s.clusters = clusters;

      const pulse = (ms / 1400) % 1;
      const face = (FACE ||= getComputedStyle(document.documentElement).getPropertyValue("--mono").trim() || '"JetBrains Mono", ui-monospace, monospace');
      const mono = `500 12px ${face}`;
      const taken: [number, number, number, number][] = []; // label boxes already drawn, so the next one can avoid them
      const names: typeof s.labels = [];
      const label = (text: string, x: number, y: number, clear: number, at: Cluster) => {
        g.font = mono;
        const wide = g.measureText(text).width;
        // Try to the right, then the left, then above, then below; give up rather than overlap.
        const spots: [number, number][] = [[x + clear, y + 4], [x - clear - wide, y + 4], [x - wide / 2, y - clear - 4], [x - wide / 2, y + clear + 12]];
        const spot = spots.find(([lx, ly]) => lx > 2 && lx + wide < w - 2 && !taken.some(([tx, ty, tw, th]) => lx < tx + tw + 4 && lx + wide + 4 > tx && ly - 12 < ty + th && ly + 3 > ty));
        if (!spot) return;
        taken.push([spot[0], spot[1] - 12, wide, 15]);
        names.push({ x: spot[0] - 4, y: spot[1] - 15, w: wide + 8, h: 22, at });
        g.lineWidth = 3;
        g.strokeStyle = colours.bg;
        g.globalAlpha = 0.75;
        g.strokeText(text, spot[0], spot[1]);
        g.globalAlpha = 1;
        g.fillStyle = colours.text;
        g.fillText(text, spot[0], spot[1]);
      };
      clusters.forEach((c) => taken.push(c.pins.length > 1 ? [c.x - 12, c.y - 12, 24, 24] : [c.x - 7, c.y - 7, 14, 14]));
      for (const c of clusters) {
        const many = c.pins.length > 1;
        const first = c.pins[0];
        const colour = c.pins.some((p) => p.kind === "here") ? "#9fe0b8" : colours.rose;
        const size = many ? 11 : 5;
        g.beginPath();
        g.arc(c.x, c.y, size + pulse * 12, 0, 7);
        g.strokeStyle = colour;
        g.globalAlpha = 1 - pulse;
        g.lineWidth = 1.5;
        g.stroke();
        g.globalAlpha = 1;
        g.beginPath();
        g.arc(c.x, c.y, size, 0, 7);
        g.fillStyle = !many && first.kind === "wish" ? colours.plum : colour;
        g.fill();
        g.strokeStyle = colours.text;
        g.lineWidth = 1.5;
        g.stroke();
        if (many) {
          g.font = `600 12px ${face}`;
          g.fillStyle = "#201a26";
          g.textAlign = "center";
          g.fillText(String(c.pins.length), c.x, c.y + 4);
          g.textAlign = "left";
          const titles = c.pins.map((p) => p.name);
          label(titles.length <= 2 ? titles.join(" + ") : `${titles[0]} + ${titles.length - 1} more`, c.x, c.y, size + 10, c);
        } else label(first.name, c.x, c.y, 13, c);
      }

      // Cities, so there is something to aim at: the biggest in view first, more of them the closer in, each with its name where there is room.
      const towns: typeof s.towns = [];
      const all = citiesNow();
      if (all && s.zoom > 2.2) {
        cityXyz ??= all.map((c) => xyz([c[3], c[2]]));
        const most = Math.min(28, Math.round(5 + s.zoom * 1.5));
        const edge = Math.cos(Math.min(cap, Math.PI / 2 - 0.06));
        g.font = '400 11px "JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace';
        for (let k = 0; k < all.length && towns.length < most; k++) {
          const q = cityXyz[k];
          if (q[0] * mid[0] + q[1] * mid[1] + q[2] * mid[2] < edge) continue;
          const c = all[k];
          const xy = projection([c[3], c[2]]);
          if (!xy || xy[0] < 6 || xy[0] > w - 6 || xy[1] < 6 || xy[1] > h - 6) continue;
          if (clusters.some((cl) => Math.hypot(cl.x - xy[0], cl.y - xy[1]) < 18)) continue;
          if (towns.some((t) => Math.hypot(t.x - xy[0], t.y - xy[1]) < 30)) continue;
          g.beginPath();
          g.arc(xy[0], xy[1], 2.6, 0, 7);
          g.fillStyle = colours.text;
          g.globalAlpha = 0.85;
          g.fill();
          g.globalAlpha = 1;
          const wide = g.measureText(c[0]).width;
          const spots: [number, number][] = [[xy[0] + 7, xy[1] + 4], [xy[0] - 7 - wide, xy[1] + 4], [xy[0] - wide / 2, xy[1] - 8], [xy[0] - wide / 2, xy[1] + 16]];
          const spot = spots.find(([lx, ly]) => lx > 2 && lx + wide < w - 2 && ly > 12 && ly < h - 4 && !taken.some(([tx, ty, tw, th]) => lx < tx + tw + 4 && lx + wide + 4 > tx && ly - 11 < ty + th && ly + 3 > ty));
          let box: [number, number, number, number] | null = null;
          if (spot) {
            taken.push([spot[0], spot[1] - 11, wide, 14]);
            box = [spot[0] - 3, spot[1] - 14, wide + 6, 20];
            g.lineWidth = 3;
            g.strokeStyle = colours.bg;
            g.globalAlpha = 0.6;
            g.strokeText(c[0], spot[0], spot[1]);
            g.globalAlpha = 0.8;
            g.fillStyle = colours.text;
            g.fillText(c[0], spot[0], spot[1]);
            g.globalAlpha = 1;
          }
          towns.push({ x: xy[0], y: xy[1], name: c[0], code: c[1], lon: c[3], lat: c[2], box });
        }
      }
      s.towns = towns;

      s.labels = names;

      if (s.pick) {
        // The visitor's pin drops in from above.
        const fall = Math.min(1, (ms - s.dropped) / 450);
        const xy = visible(s.pick.lon, s.pick.lat) ? projection([s.pick.lon, s.pick.lat]) : null;
        if (xy) {
          const lift = (1 - fall) ** 2 * 80;
          g.fillStyle = "#fff";
          g.beginPath();
          g.arc(xy[0], xy[1] - 16 - lift, 7, Math.PI, 0);
          g.lineTo(xy[0], xy[1] - lift);
          g.closePath();
          g.fill();
          g.fillStyle = colours.plum;
          g.beginPath();
          g.arc(xy[0], xy[1] - 16 - lift, 2.6, 0, 7);
          g.fill();
        }
      }
    }

    const io = new IntersectionObserver(([e]) => {
      seen = e.isIntersecting;
      if (seen && !frame) frame = requestAnimationFrame(draw);
    });
    io.observe(el);

    // Two fingers: the distance between them, and the point half way.
    const two = () => {
      const [a, b] = [...s.touches.values()];
      return { spread: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      s.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      s.fly = null;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {}
      if (s.touches.size >= 2) {
        // A pinch is measured from where the fingers started, not from the last frame, so it cannot drift.
        const t = two();
        s.pinch = { spread: Math.max(24, t.spread), zoom: s.zoom, x: t.x, y: t.y };
        s.drag = null;
        s.vel = [0, 0];
      } else s.drag = { x: e.clientX, y: e.clientY, moved: 0 };
    };
    // The pin (or the name beside a pin) under a point, if there is one.
    const under = (x: number, y: number) => s.clusters.find((c) => Math.hypot(c.x - x, c.y - y) < (c.pins.length > 1 ? 20 : 16)) ?? s.labels.find((l) => x >= l.x && x <= l.x + l.w && y >= l.y && y <= l.y + l.h)?.at;
    const move = (e: PointerEvent) => {
      if (!s.touches.has(e.pointerId)) {
        // Just hovering: show a pointing hand over anything that can be pressed.
        if (e.pointerType === "mouse") {
          const box = el.getBoundingClientRect();
          el.style.cursor = under(e.clientX - box.left, e.clientY - box.top) ? "pointer" : "";
        }
        return;
      }
      s.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (s.touches.size >= 2 && s.pinch) {
        const t = two();
        s.zoom = s.zoomTo = Math.max(1, Math.min(MOST, s.pinch.zoom * (Math.max(24, t.spread) / s.pinch.spread)));
        // Moving both fingers together turns the globe as well.
        const k = 0.28 / s.zoom;
        s.rot = [s.rot[0] + (t.x - s.pinch.x) * k, Math.max(-85, Math.min(85, s.rot[1] - (t.y - s.pinch.y) * k))];
        s.pinch.x = t.x;
        s.pinch.y = t.y;
        again();
        return;
      }
      if (!s.drag) return;
      const dx = e.clientX - s.drag.x, dy = e.clientY - s.drag.y;
      s.drag = { x: e.clientX, y: e.clientY, moved: s.drag.moved + Math.abs(dx) + Math.abs(dy) };
      const k = 0.28 / s.zoom; // zoomed in, the same drag turns the globe less
      s.rot = [s.rot[0] + dx * k, Math.max(-85, Math.min(85, s.rot[1] - dy * k))];
      s.vel = [dx * k, -dy * k];
      again();
    };
    // A finger lifting ends a pinch; if one is still down it carries on as a drag from where it is, without a jump.
    const lift = (id: number) => {
      const wasPinch = !!s.pinch;
      s.touches.delete(id);
      if (wasPinch) {
        s.pinch = null;
        const rest = [...s.touches.values()][0];
        s.drag = rest ? { x: rest.x, y: rest.y, moved: 99 } : null;
        s.vel = [0, 0];
      }
      return wasPinch;
    };
    const up = (e: PointerEvent) => {
      if (lift(e.pointerId)) return;
      const tap = s.drag && s.drag.moved < 6;
      s.drag = null;
      if (!tap) return;
      const box = el.getBoundingClientRect();
      const x = e.clientX - box.left, y = e.clientY - box.top;
      const now = performance.now();
      const double = now - s.lastTap < 320;
      s.lastTap = now;
      // A tap on a pin: a numbered one opens up, a single one is chosen.
      const hit = under(x, y);
      if (hit) {
        s.pick = null;
        setPick(null);
        if (hit.pins.length > 1) {
          const lon = hit.pins.reduce((a, p) => a + p.lon, 0) / hit.pins.length, lat = hit.pins.reduce((a, p) => a + p.lat, 0) / hit.pins.length;
          const widest = Math.max(...hit.pins.map((p) => geoDistance([p.lon, p.lat], [lon, lat]))) * 2;
          s.zoomTo = Math.min(MOST, Math.max(s.zoom * 1.6, (NEAR * 2.4) / (widest * s.radius)));
          face(lon, lat);
          setFocus("");
        } else if (places.some((p) => p.slug === hit.pins[0].id)) setFocus(hit.pins[0].id);
        else setFocus(hit.pins[0].id.replace("wish:", ""));
        again();
        return;
      }
      // A tap on a city's dot or its name is that city, exactly.
      const named = double ? undefined : s.towns.find((t) => Math.hypot(t.x - x, t.y - y) < 14 || (t.box && x >= t.box[0] && x <= t.box[0] + t.box[2] && y >= t.box[1] && y <= t.box[1] + t.box[3]));
      if (named) {
        s.pick = { name: `${named.name}, ${countryName(named.code)}`, lon: named.lon, lat: named.lat };
        s.dropped = now;
        s.vel = [0, 0];
        setPick(s.pick);
        setFocus("");
        again();
        return;
      }
      const at = projection.invert?.([x, y]);
      if (!at || Number.isNaN(at[0])) return;
      if (double) {
        // Tapping twice zooms in on that spot.
        s.zoomTo = Math.min(MOST, s.zoomTo * 2);
        face(at[0], at[1]);
        again();
        return;
      }
      const country = countries.find((c) => geoContains(c, at));
      if (!country) return;
      // The nearest town or city if there is one to name, and the country it is in; otherwise just the country.
      const town = nearestCity(at[1], at[0], (30 / s.radius) * 6371);
      s.pick = { name: town ? `${town.name}, ${country.properties.name}` : country.properties.name, lon: at[0], lat: at[1] };
      s.dropped = now;
      s.vel = [0, 0];
      setPick(s.pick);
      setFocus("");
      again();
    };
    const cancel = (e: PointerEvent) => {
      if (!lift(e.pointerId)) s.drag = null;
    };
    // Safari has its own pinch gesture, which would zoom the whole page instead.
    const own = (e: Event) => e.preventDefault();
    // A trackpad pinch arrives as a wheel event with ctrl held; plain scrolling is left to the page.
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      s.zoomTo = Math.max(1, Math.min(MOST, s.zoomTo * Math.exp(-e.deltaY * 0.01)));
      again();
    };
    el.addEventListener("pointerdown", finer, { once: true });
    el.addEventListener("wheel", finer, { once: true, passive: true });
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", cancel);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("gesturestart", own);
    el.addEventListener("gesturechange", own);
    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("gesturestart", own);
      el.removeEventListener("gesturechange", own);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Turn to a pin and zoom in just far enough that it stands apart from its neighbours.
  const flyTo = (pin: Pin) => {
    const s = state.current;
    s.zoomTo = Math.max(Math.min(s.zoomTo, 6), clearOf(pin));
    face(pin.lon, pin.lat);
    s.pick = null;
    setPick(null);
    setFocus(pin.id.replace("wish:", ""));
  };
  const chosen = places.find((p) => p.slug === focus);
  const wish = wishlist.find((p) => p.name === focus);

  return (
    <div className="globe">
      <div className="globe-stage">
        <canvas ref={canvas} className="globe-canvas" role="img" aria-label="A globe showing the places in my travel log. Drag to turn it, pinch or use the buttons to zoom." />
        <div className="globe-zoom">
          <button type="button" onClick={() => zoomBy(2)} disabled={zoomed >= MOST - 0.1} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={() => zoomBy(1 / 2)} disabled={zoomed <= 1.02} aria-label="Zoom out">
            −
          </button>
          <button type="button" className="mono" onClick={() => (state.current.zoomTo = 1)} disabled={zoomed <= 1.02} aria-label="Zoom all the way out">
            All
          </button>
        </div>
      </div>
      <div className="globe-side">
        <div className="globe-card" aria-live="polite">
          {chosen ? (
            <div key={chosen.slug} className="globe-pick">
              <span className="mono">
                {chosen.kind} · {chosen.country}
              </span>
              <TLink href={`/travel/${chosen.slug}`} className="globe-pick-title">
                <b>{chosen.name}</b>
              </TLink>
              <p>{chosen.blurb}</p>
              <TLink className="btn btn-primary small" href={`/travel/${chosen.slug}`}>
                Open the log ({chosen.entries.length}) →
              </TLink>
            </div>
          ) : wish ? (
            <div key={wish.name} className="globe-pick">
              <span className="mono">Want to go · {wish.country}</span>
              <b>{wish.name}</b>
              <p>{wish.why}</p>
            </div>
          ) : pick ? (
            <div key={pick.name} className="globe-pick">
              <span className="mono">You picked</span>
              <b>{pick.name}</b>
              <a className="btn btn-primary small" href={`mailto:${site.email}?subject=${encodeURIComponent(`You should visit ${pick.name}`)}&body=${encodeURIComponent(`Hi Sidney,\n\nYou should go to ${pick.name}, because `)}`}>
                Suggest it to me
              </a>
            </div>
          ) : (
            <p>Tap a pin to read about it. A numbered pin is several places close together: tap it, or zoom, to pull them apart. Tap anywhere on land to tell me where to go next.</p>
          )}
        </div>
        <div className="globe-places">
          {(here || current) && (
            <>
              <span className="mono">Right now</span>
              <button type="button" className="globe-place globe-now" data-away={away || undefined} aria-pressed={focus === (here ? "here" : current!.slug)} onClick={() => flyTo(PINS.find((p) => p.id === (here ? "here" : current!.slug))!)}>
                <i data-kind="here" />
                <span>
                  <b>{here ? here.name : current!.name}</b>
                  <small>{away ? `Away${note ? `: ${note}` : ""}` : note || "Where I am now"}</small>
                </span>
              </button>
            </>
          )}
          <span className="mono">Been</span>
          {places.map((p) => (
            <button key={p.slug} type="button" className="globe-place" aria-pressed={focus === p.slug} onClick={() => flyTo(PINS.find((pin) => pin.id === p.slug)!)}>
              <i data-kind={p === current ? "here" : "been"} />
              <span>
                <b>{p.name}</b>
                <small>{p.tagline}</small>
              </span>
            </button>
          ))}
          <span className="mono">Want to go</span>
          <div className="globe-wishes">
            {wishlist.map((p) => (
              <button key={p.name} type="button" className="post-tag" aria-pressed={focus === p.name} onClick={() => flyTo(PINS.find((pin) => pin.id === `wish:${p.name}`)!)}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

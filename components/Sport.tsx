"use client";

import { Pill } from "@/components/Pill";
import { useLive } from "@/lib/live";
import { createPortal } from "react-dom";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { currentTheme, onTheme } from "@/lib/theme";
import { clock, dayOf, dist, hours, rate, sportName, timeOf, type Activity, type SportSummary, type Units } from "@/lib/sport";
import { TLink } from "./Transition";

// ---- Kilometres or miles: remembered in this browser, shared by everything on the page ----------------------
let units: Units = "km";
let read = false;
const watchers = new Set<() => void>();
const subscribe = (l: () => void) => (watchers.add(l), () => void watchers.delete(l));
function current(): Units {
  if (!read) {
    read = true;
    try {
      if (localStorage.getItem("units") === "mi") units = "mi";
    } catch {
      // No storage: kilometres, for this visit.
    }
  }
  return units;
}
export const useUnits = () => useSyncExternalStore<Units>(subscribe, current, () => "km");
function setUnits(next: Units) {
  units = next;
  try {
    localStorage.setItem("units", next);
  } catch {
    // Fine without storage.
  }
  watchers.forEach((l) => l());
}
export function UnitToggle() {
  const u = useUnits();
  return <Choice label="Units" value={u} options={[["km", "km"], ["mi", "miles"]]} onChange={(v) => setUnits(v as Units)} />;
}

// A row of buttons where one is on, with a glass pill that slides to it.
export function Choice({ label, value, options, onChange }: { label: string; value: string; options: (readonly [string, string])[]; onChange: (v: string) => void }) {
  return (
    <div className="seg sp-seg" role="group" aria-label={label}>
      <Pill />
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

// A dropdown: a button that opens a list. Arrow keys move, Enter chooses, Escape closes.
export function Pick({ label, value, options, onChange }: { label: string; value: string; options: (readonly [string, string])[]; onChange: (v: string) => void }) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(0);
  const [right, setRight] = useState(false);
  const [up, setUp] = useState(false);
  const chosen = Math.max(0, options.findIndex((o) => o[0] === value));
  const show = () => {
    const r = box.current?.getBoundingClientRect();
    setRight(!!r && r.left + 240 > window.innerWidth - 12 && r.right > 252);
    // Not enough room underneath: open upwards instead. Either way the list is never taller than the room there is.
    const tall = Math.min(340, options.length * 46 + 14);
    const below = r ? window.innerHeight - r.bottom : 999;
    const goUp = !!r && below < tall + 16 && r.top > below;
    setUp(goUp);
    if (r) setSpot({ left: r.left, top: r.top, width: r.width, height: r.height, room: Math.max(140, (goUp ? r.top : below) - 20) });
    setAt(chosen);
    setOpen(true);
  };
  // The list is drawn in <body>, over everything, at the place the button is on screen: nothing it happens to sit inside (a panel that clips, a row…
  const [spot, setSpot] = useState<{ left: number; top: number; width: number; height: number; room: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const f = window.requestAnimationFrame(() => setLive(true));
      return () => window.cancelAnimationFrame(f);
    }
    setLive(false);
    const t = window.setTimeout(() => setMounted(false), 260);
    return () => window.clearTimeout(t);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const inside = (t: EventTarget | null) => !!box.current?.contains(t as Node) || !!list.current?.contains(t as Node);
    const away = (e: PointerEvent) => !inside(e.target) && setOpen(false);
    // The page moving under it would leave the list floating in the wrong place: it closes instead.
    const since = Date.now();
    const moved = (e: Event) => Date.now() - since > 250 && !list.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("scroll", moved, true);
    window.addEventListener("resize", moved);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("scroll", moved, true);
      window.removeEventListener("resize", moved);
    };
  }, [open]);
  useEffect(() => {
    // Keep the marked row in view by moving the list itself (never the page, which would close it).
    const ul = list.current, row = ul?.children[at] as HTMLElement | undefined;
    if (!open || !ul || !row) return;
    if (row.offsetTop < ul.scrollTop) ul.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > ul.scrollTop + ul.clientHeight) ul.scrollTop = row.offsetTop + row.offsetHeight - ul.clientHeight;
  }, [open, at]);
  const choose = (n: number) => {
    onChange(options[n][0]);
    setOpen(false);
  };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return open && (e.preventDefault(), setOpen(false));
    if (e.key === "Tab") return setOpen(false);
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (step || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      if (!open) return show();
      setAt(e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : Math.max(0, Math.min(options.length - 1, at + step)));
    } else if (open && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      choose(at);
    }
  };
  return (
    <div className="sp-pick" ref={box} data-open={open} data-right={right} data-up={up}>
      <button type="button" className="sp-pick-btn" aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open ? `${id}-${at}` : undefined} onClick={() => (open ? setOpen(false) : show())} onKeyDown={key}>
        <span className="mono">{label}</span>
        <b key={value}>{options[chosen]?.[1]}</b>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {mounted &&
        spot &&
        createPortal(
          <div className="sp-pick sp-pick-float" data-open={open && live} data-right={right} data-up={up} style={{ left: spot.left, top: spot.top, width: spot.width, height: spot.height }}>
            <ul className="sp-pick-list" id={`${id}-list`} ref={list} role="listbox" aria-label={label} inert={!open} style={{ maxHeight: spot?.room }}>
              {options.map(([v, text], n) => (
                <li key={v} id={`${id}-${n}`} role="option" aria-selected={v === value} data-at={open && n === at} style={{ ["--i" as string]: Math.min(n, 10) }} onPointerEnter={() => setAt(n)} onClick={() => choose(n)}>
                  <span>{text}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.500l4.500 4.500L19 7.500" />
                  </svg>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}

// ---- Numbers that glide to their new value rather than jumping --------------------------------------------------
const still = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// Follows a list of numbers. If the list changes shape (more points, or different gaps) it jumps; otherwise it eases.
export function useGlide(target: (number | null)[], ms = 650) {
  const [now, setNow] = useState(target);
  const from = useRef(target);
  const shape = target.map((v) => (v === null ? "-" : "n")).join("");
  const sum = target.join(",");
  useEffect(() => {
    const start = from.current;
    if (still() || start.length !== target.length || start.some((v, n) => (v === null) !== (target[n] === null))) {
      from.current = target;
      return setNow(target);
    }
    let frame = 0;
    const began = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - began) / ms), e = 1 - (1 - k) ** 4;
      const mid = target.map((v, n) => (v === null ? null : (start[n] as number) + (v - (start[n] as number)) * e));
      from.current = mid;
      setNow(mid);
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sum, shape, ms]);
  // Until the effect has run for a new shape, show the target, so nothing is ever indexed out of range.
  return now.length === target.length ? now : target;
}
// One number, shown through `say` as it glides.
export function Num({ value, say }: { value: number; say: (v: number) => string }) {
  const [v] = useGlide([value]);
  return <>{say(v ?? value)}</>;
}

// ---- The numbers, kept up to date and shared ---------------------------------------------------------------------- Asked once a minute and…
export function useSummary() {
  const { data, failed } = useLive<SportSummary>("/api/sport/summary", { every: 60 });
  return { summary: data, failed };
}

// ---- Charts -------------------------------------------------------------------------------------------------------
export type Point = { label: string; long: string; value: number | null; say: string };

// Bars from a zero baseline. Point at one (or tab to it, or tap it) to read it.
export function Bars({ points, name, axis }: { points: Point[]; name: string; axis: (v: number) => string }) {
  const [on, setOn] = useState<number | null>(null);
  const top = nice(Math.max(1e-9, ...points.map((p) => p.value ?? 0)));
  const shown = on !== null && on < points.length ? on : lastWith(points); // the points can change under a remembered bar
  return (
    <figure className="sp-chart" onPointerLeave={() => setOn(null)}>
      <figcaption>
        <span className="mono">{name}</span>
        <b aria-live="polite">{shown === null ? "Nothing yet" : `${points[shown].long}: ${points[shown].say}`}</b>
      </figcaption>
      <div className="sp-plot">
        <Grid top={axis(top)} mid={axis(top / 2)} />
        <div className="sp-bars">
          {points.map((p, n) => (
            <button key={n} type="button" className="sp-bar" data-on={shown === n} aria-label={`${p.long}: ${p.say}`} onPointerEnter={() => setOn(n)} onFocus={() => setOn(n)} onClick={() => setOn(n)}>
              <i style={{ height: `${((p.value ?? 0) / top) * 100}%` }} />
            </button>
          ))}
        </div>
      </div>
      <Ticks points={points} />
    </figure>
  );
}

// A line through the points that have a value. `flip` puts small numbers at the top (a faster pace is a smaller number).
export function Line({ points, name, axis, flip }: { points: Point[]; name: string; axis: (v: number) => string; flip?: boolean }) {
  const [on, setOn] = useState<number | null>(null);
  const glide = useGlide(points.map((p) => p.value));
  const have = points.map((p, n) => ({ ...p, value: glide[n], n })).filter((p) => p.value !== null) as (Point & { n: number; value: number })[];
  const lo = Math.min(...have.map((p) => p.value)), hi = Math.max(...have.map((p) => p.value));
  const pad = (hi - lo || Math.abs(hi) * 0.1 || 1) * 0.18;
  const min = lo - pad, max = hi + pad;
  const x = (n: number) => (points.length < 2 ? 50 : (n / (points.length - 1)) * 100);
  const y = (v: number) => (flip ? ((v - min) / (max - min)) * 100 : (1 - (v - min) / (max - min)) * 100);
  const shown = on !== null && points[on]?.value != null ? on : (have[have.length - 1]?.n ?? null);
  const nearest = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const at = ((e.clientX - box.left) / box.width) * (points.length - 1);
    let best: number | null = null;
    for (const p of have) if (best === null || Math.abs(p.n - at) < Math.abs(best - at)) best = p.n;
    setOn(best);
  };
  if (have.length < 2)
    return (
      <figure className="sp-chart">
        <figcaption>
          <span className="mono">{name}</span>
          <b>{have.length ? `${have[0].long}: ${have[0].say}` : "Not enough yet to draw a line"}</b>
        </figcaption>
      </figure>
    );
  return (
    <figure className="sp-chart">
      <figcaption>
        <span className="mono">{name}</span>
        <b aria-live="polite">{shown === null ? "" : `${points[shown].long}: ${points[shown].say}`}</b>
      </figcaption>
      <div className="sp-plot sp-line" key={points.length} onPointerMove={nearest} onPointerDown={nearest} onPointerLeave={() => setOn(null)}>
        <Grid top={axis(flip ? min + (max - min) * 0.08 : max - (max - min) * 0.08)} mid={axis((min + max) / 2)} />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d={have.map((p, k) => `${k ? "L" : "M"}${x(p.n).toFixed(2)} ${y(p.value).toFixed(2)}`).join("")} />
        </svg>
        {have.length <= 24 && have.map((p) => <i key={p.n} className="sp-dot" style={{ left: `${x(p.n)}%`, top: `${y(p.value)}%` }} />)}
        {shown !== null && (
          <>
            <i className="sp-cross" style={{ left: `${x(shown)}%` }} />
            <i className="sp-dot" data-on="true" style={{ left: `${x(shown)}%`, top: `${y((glide[shown] ?? points[shown].value) as number)}%` }} />
          </>
        )}
      </div>
      <Ticks points={points} />
      <div className="sp-table">
      <table>
        <caption>{name}</caption>
        <tbody>
          {have.map((p) => (
            <tr key={p.n}>
              <th scope="row">{p.long}</th>
              <td>{p.say}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
const Grid = ({ top, mid }: { top: string; mid: string }) => (
  <div className="sp-grid" aria-hidden="true">
    <span>{top}</span>
    <span>{mid}</span>
  </div>
);
// Labels under the plot: as many as fit without touching.
function Ticks({ points }: { points: Point[] }) {
  const every = Math.ceil(points.length / 7);
  return (
    <div className="sp-ticks mono" aria-hidden="true">
      {points.map((p, n) => (
        <span key={n}>{points.length <= 12 || n % every === 0 ? p.label : ""}</span>
      ))}
    </div>
  );
}
const lastWith = (points: Point[]) => {
  for (let n = points.length - 1; n >= 0; n--) if (points[n].value) return n;
  return null;
};
// The next round number up, for the top of an axis.
function nice(v: number) {
  const pow = 10 ** Math.floor(Math.log10(v));
  const m = v / pow;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * pow;
}

// ---- One activity in a list -----------------------------------------------------------------------------------------
export function ActivityRow({ a }: { a: Activity }) {
  const u = useUnits();
  const pace = rate(a.sport, a.distance, a.moving, u);
  return (
    <TLink href={`/sport/activities/${a.id}`} className="sp-row glass">
      <span className="sp-row-when mono">
        {dayOf(a.start)}
        {a.id.startsWith("-") ? "" : ` · ${timeOf(a.start)}`}
      </span>
      <span className="sp-row-name">
        <b>{a.name || sportName(a.sport)}</b>
        <span className="post-tag">{sportName(a.sport)}</span>
        {a.mark && <span className="post-tag sp-mark">{a.mark}</span>}
        {a.sample && <span className="post-tag sample">sample</span>}
      </span>
      <span className="sp-row-nums sp-swap" key={u}>
        {a.distance >= 50 && <span>{dist(a.distance, u)}</span>}
        <span>{a.distance >= 50 ? clock(a.moving) : hours(a.moving)}</span>
        {pace && <span>{pace}</span>}
      </span>
    </TLink>
  );
}

// ---- A route on a street map ------------------------------------------------------------------------------------ The map is a grid of square…
const TILES = (z: number, x: number, y: number) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
// Web Mercator: the whole world as a square from 0 to 1.
const world = ([lat, lon]: [number, number]): [number, number] => [(lon + 180) / 360, (1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2];

export function RouteMap({ route, tiles }: { route: [number, number][]; tiles: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [theme, setTheme] = useState("light");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = box.current!;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    setTheme(currentTheme());
    const off = onTheme(setTheme);
    return () => (watch.disconnect(), off());
  }, []);
  const view = useMemo(() => {
    const { w, h } = size;
    if (!w || !h) return null;
    const pts = route.map(world);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const pad = Math.min(w, h) * 0.12;
    // Pixels per world-width that just fits the route in the box, but never closer than street level.
    const fit = Math.min((w - pad * 2) / Math.max(x1 - x0, 1e-9), (h - pad * 2) / Math.max(y1 - y0, 1e-9), 256 * 2 ** 17);
    // One zoom level closer than fits exactly, so each 256-pixel tile is drawn at 128 to 256 pixels and stays sharp on a dense screen.
    const z = Math.max(1, Math.min(18, Math.floor(Math.log2(fit / 256)) + 1));
    const tile = fit / 2 ** z;
    const left = w / 2 - ((x0 + x1) / 2) * fit, top = h / 2 - ((y0 + y1) / 2) * fit;
    const line = pts.map(([x, y]) => [left + x * fit, top + y * fit]);
    const grid: { key: string; src: string; x: number; y: number }[] = [];
    const n = 2 ** z;
    for (let ty = Math.max(0, Math.floor(-top / tile)); ty <= Math.min(n - 1, Math.floor((h - top) / tile)); ty++)
      for (let tx = Math.floor(-left / tile); tx <= Math.floor((w - left) / tile); tx++) grid.push({ key: `${z}/${tx}/${ty}`, src: TILES(z, ((tx % n) + n) % n, ty), x: left + tx * tile, y: top + ty * tile });
    return { w, h, tile, grid, d: line.map(([x, y], k) => `${k ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(""), from: line[0], to: line[line.length - 1] };
  }, [size, route]);
  const mapped = tiles && !failed;
  return (
    <div className="sp-map" ref={box} data-tiles={mapped} data-theme={theme} role="img" aria-label="The route on a map">
      {view && mapped && (
        <div className="sp-map-tiles" aria-hidden="true">
          {view.grid.map((t) => (
            <img key={t.key} src={t.src} alt="" draggable={false} style={{ left: t.x, top: t.y, width: view.tile + 0.5, height: view.tile + 0.5 }} onLoad={(e) => (e.currentTarget.dataset.in = "true")} onError={() => setFailed(true)} />
          ))}
        </div>
      )}
      {view && (
        <svg viewBox={`0 0 ${view.w} ${view.h}`} aria-hidden="true">
          <path className="sp-map-edge" d={view.d} />
          <path className="sp-map-line" d={view.d} pathLength={1} />
          <circle cx={view.from[0]} cy={view.from[1]} r="6" />
          <circle className="sp-map-end" cx={view.to[0]} cy={view.to[1]} r="6" />
        </svg>
      )}
      {mapped && (
        <span className="sp-map-credit">
          ©{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap
          </a>{" "}
          contributors
        </span>
      )}
    </div>
  );
}

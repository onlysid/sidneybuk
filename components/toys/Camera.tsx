"use client";

import { useEffect, useRef, useState } from "react";

// A seeded random number generator, so the same seed always gives the same scene.
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const ISO = [100, 200, 400, 800, 1600, 3200, 6400];
const APERTURE = [1.8, 2.8, 4, 5.6, 8, 11, 16];
const SHUTTER = [1 / 1000, 1 / 250, 1 / 60, 1 / 15, 1 / 4, 1, 4, 15, 30];
const shutterName = (s: number) => (s >= 1 ? `${s}s` : `1/${Math.round(1 / s)}`);
type Settings = { iso: number; aperture: number; shutter: number };

const SKIES = [
  { name: "dawn", sky: ["#2b2440", "#a878aa", "#f2c1a8"], sun: "#ffe3c4", hills: ["#6a4f80", "#4a3560", "#2c2038"], light: 0.6, night: false },
  { name: "noon", sky: ["#5c7fb8", "#a9c4e4", "#e8eef5"], sun: "#fffbe8", hills: ["#7c8fa8", "#56687f", "#33404f"], light: 1.6, night: false },
  { name: "dusk", sky: ["#1d1a3a", "#8a4f7d", "#f08a5d"], sun: "#ffd27a", hills: ["#5a3a63", "#3a2547", "#1f1428"], light: 0.45, night: false },
  { name: "night", sky: ["#05040c", "#141030", "#2c2350"], sun: "#f3eef2", hills: ["#231a36", "#171126", "#0c0915"], light: 0.012, night: true },
];

// Paints one generated landscape.
export function paint(g: CanvasRenderingContext2D, w: number, h: number, seed: number, set: Settings) {
  const r = rng(seed);
  const sky = SKIES[Math.floor(r() * SKIES.length)];
  const horizon = h * (0.52 + r() * 0.16);
  const lake = r() > 0.35;
  const slow = Math.min(1, Math.log2(set.shutter * 1000) / Math.log2(30000)); // 0 fast, 1 very slow

  const grad = g.createLinearGradient(0, 0, 0, horizon);
  sky.sky.forEach((c, i) => grad.addColorStop(i / 2, c));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  if (sky.night) {
    // Stars: points with a fast shutter, arcs around a pole with a slow one.
    const pole = [w * (0.3 + r() * 0.4), horizon * 0.25];
    for (let n = 0; n < 150; n++) {
      const x = r() * w, y = r() * horizon, b = 0.3 + r() * 0.7;
      const d = Math.hypot(x - pole[0], y - pole[1]), a = Math.atan2(y - pole[1], x - pole[0]);
      g.strokeStyle = `rgba(243,238,242,${b})`;
      g.lineWidth = 0.6 + r() * 0.9;
      g.lineCap = "round";
      g.beginPath();
      g.arc(pole[0], pole[1], d, a, a + 0.002 + slow * slow * 0.5);
      g.stroke();
    }
  }
  const sx = w * (0.15 + r() * 0.7), sy = horizon * (sky.night ? 0.25 + r() * 0.3 : 0.45 + r() * 0.5), sr = h * (0.035 + r() * 0.04);
  const glow = g.createRadialGradient(sx, sy, 0, sx, sy, sr * 7);
  glow.addColorStop(0, sky.sun + "cc");
  glow.addColorStop(1, sky.sun + "00");
  g.fillStyle = glow;
  g.fillRect(0, 0, w, horizon);
  g.fillStyle = sky.sun;
  g.beginPath();
  g.arc(sx, sy, sr, 0, 7);
  g.fill();

  // Clouds: puffs when frozen, streaks when the shutter is slow.
  for (let n = 0, count = Math.floor(r() * 5); n < count; n++) {
    const cx = r() * w, cy = horizon * (0.15 + r() * 0.5), cw = w * (0.12 + r() * 0.2) * (1 + slow * 1.5), ch = h * (0.02 + r() * 0.03) * (1 - slow * 0.5);
    g.fillStyle = sky.night ? "rgba(60,50,90,0.35)" : "rgba(255,255,255,0.28)";
    for (let k = 0; k < 5; k++) {
      g.beginPath();
      g.ellipse(cx + (r() - 0.5) * cw, cy + (r() - 0.5) * ch, cw * (0.3 + r() * 0.3), ch * (0.6 + r() * 0.6), 0, 0, 7);
      g.fill();
    }
  }

  // Layers of hills, nearer ones darker and rougher.
  sky.hills.forEach((colour, layer) => {
    const base = horizon - h * (0.14 - layer * 0.06), amp = h * (0.1 + r() * 0.07) * (1 - layer * 0.2);
    const f = [r() * 3 + 1.5, r() * 7 + 4, r() * 17 + 9], ph = [r() * 7, r() * 7, r() * 7];
    g.fillStyle = colour;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 3) {
      const u = x / w;
      g.lineTo(x, base - amp * (0.6 * Math.sin(u * f[0] + ph[0]) + 0.28 * Math.sin(u * f[1] + ph[1]) + 0.12 * Math.sin(u * f[2] + ph[2]) + 0.4));
    }
    g.lineTo(w, h);
    g.fill();
    if (layer < 2) {
      g.fillStyle = sky.night ? "rgba(40,30,70,0.25)" : "rgba(255,255,255,0.12)";
      g.fillRect(0, base - amp * 0.2, w, amp * 0.9);
    }
  });

  if (lake) {
    // Water mirrors the sky. Fast shutters keep the ripples; slow ones turn it to glass.
    const water = g.createLinearGradient(0, horizon, 0, h);
    water.addColorStop(0, sky.sky[2]);
    water.addColorStop(1, sky.sky[0]);
    g.fillStyle = water;
    g.globalAlpha = 0.82;
    g.fillRect(0, horizon, w, h - horizon);
    g.globalAlpha = 1;
    const path = g.createLinearGradient(0, horizon, 0, h);
    path.addColorStop(0, sky.sun + "aa");
    path.addColorStop(1, sky.sun + "00");
    g.fillStyle = path;
    g.fillRect(sx - sr * (1 + slow), horizon, sr * 2 * (1 + slow), h - horizon);
    const ripples = Math.round(120 * (1 - slow));
    for (let n = 0; n < ripples; n++) {
      const y = horizon + r() * (h - horizon), len = (4 + r() * 26) * ((y - horizon) / (h - horizon) + 0.3);
      g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.16)" : "rgba(20,14,30,0.18)";
      g.fillRect(r() * w, y, len, 1.2);
    }
  } else {
    // Dry ground with a line of trees.
    g.fillStyle = sky.hills[2];
    g.fillRect(0, horizon + h * 0.08, w, h);
    for (let n = 0, count = 6 + Math.floor(r() * 12); n < count; n++) {
      const x = r() * w, th = h * (0.06 + r() * 0.12), y = horizon + h * (0.1 + r() * 0.1);
      g.fillStyle = sky.night ? "#07050c" : "#150f1c";
      g.beginPath();
      g.moveTo(x, y - th); g.lineTo(x + th * 0.28, y); g.lineTo(x - th * 0.28, y);
      g.fill();
    }
  }
  // Distant lights at night: sharp points stopped down, soft discs wide open.
  if (sky.night || sky.name === "dusk") {
    const open = 1 - APERTURE.indexOf(set.aperture) / (APERTURE.length - 1);
    for (let n = 0, count = 5 + Math.floor(r() * 9); n < count; n++) {
      const x = r() * w, y = horizon + (r() - 0.3) * h * 0.06, rad = 1.2 + open * h * 0.03 * (0.5 + r());
      g.fillStyle = `rgba(255,${190 + Math.floor(r() * 50)},${120 + Math.floor(r() * 80)},${0.9 - open * 0.55})`;
      g.beginPath();
      g.arc(x, y, rad, 0, 7);
      g.fill();
    }
  }

  // Exposure: how far the settings are from what this light needs, in stops.
  const stops = Math.log2((set.shutter * set.iso * sky.light * 60) / (set.aperture * set.aperture)) - 4.2;
  const ev = Math.max(-4, Math.min(4, stops));
  if (ev > 0) {
    g.fillStyle = `rgba(255,250,244,${Math.min(0.94, ev * 0.26)})`;
    g.fillRect(0, 0, w, h);
  } else {
    g.fillStyle = `rgba(4,2,8,${Math.min(0.95, -ev * 0.27)})`;
    g.fillRect(0, 0, w, h);
  }
  // A wide aperture darkens the corners.
  const vig = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, `rgba(0,0,0,${0.15 + (1 - APERTURE.indexOf(set.aperture) / 6) * 0.45})`);
  g.fillStyle = vig;
  g.fillRect(0, 0, w, h);
  // Grain rises with ISO.
  const grain = (ISO.indexOf(set.iso) / 6) ** 1.5;
  const dots = Math.round(w * h * 0.05 * grain);
  for (let n = 0; n < dots; n++) {
    g.fillStyle = r() > 0.5 ? `rgba(255,255,255,${0.1 + grain * 0.2})` : `rgba(0,0,0,${0.1 + grain * 0.2})`;
    g.fillRect(r() * w, r() * h, 1.3, 1.3);
  }
  return { stops, sky: sky.name };
}

// The shutter speed that exposes a given scene correctly at this ISO and aperture: what a camera's auto mode would pick.
export function meterFor(seed: number, iso: number, aperture: number) {
  const light = SKIES[Math.floor(rng(seed)() * SKIES.length)].light;
  const ideal = (2 ** 4.2 * aperture * aperture) / (iso * light * 60);
  return SHUTTER.reduce((a, b) => (Math.abs(Math.log2(b / ideal)) < Math.abs(Math.log2(a / ideal)) ? b : a));
}

type Shot = { id: number; src: string; label: string };
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

// A camera pointed at landscapes that do not exist.
export function Camera() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [seed, setSeed] = useState(7);
  const [set, setSet] = useState<Settings>({ iso: 400, aperture: 5.6, shutter: 1 / 60 });
  const [meter, setMeter] = useState({ stops: 0, sky: "" });
  const [shots, setShots] = useState<Shot[]>([]);
  const [flash, setFlash] = useState(0);
  const count = useRef(0);

  useEffect(() => {
    const el = canvas.current;
    const g = el?.getContext("2d");
    if (!el || !g) return;
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      el.width = Math.round(el.clientWidth * dpr);
      el.height = Math.round(el.clientHeight * dpr);
      if (el.width && el.height) setMeter(paint(g, el.width, el.height, seed, set));
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    return () => ro.disconnect();
  }, [seed, set]);

  const shoot = (s = seed, cfg = set) => {
    const print = document.createElement("canvas");
    print.width = 480;
    print.height = 320;
    const g = print.getContext("2d");
    if (!g) return;
    paint(g, 480, 320, s, cfg);
    count.current += 1;
    const label = `No. ${String(count.current).padStart(2, "0")} · ISO ${cfg.iso} · f/${cfg.aperture} · ${shutterName(cfg.shutter)}`;
    setShots((list) => [{ id: count.current, src: print.toDataURL("image/jpeg", 0.85), label }, ...list].slice(0, 12));
    setFlash((f) => f + 1);
  };
  // Four frames in a row, each a new place at a random ISO and aperture with the shutter metered to suit.
  const roll = () => {
    for (let n = 0; n < 4; n++)
      window.setTimeout(() => {
        const s = Math.floor(Math.random() * 1e9);
        const iso = pick(ISO), aperture = pick(APERTURE);
        const cfg = { iso, aperture, shutter: meterFor(s, iso, aperture) };
        setSeed(s);
        setSet(cfg);
        shoot(s, cfg);
      }, n * 650);
  };

  const needle = Math.max(-3, Math.min(3, meter.stops));
  const dial = (label: string, list: number[], key: keyof Settings, show: (v: number) => string) => (
    <label className="slider mono">
      <span>
        {label} {show(set[key])}
      </span>
      <input type="range" min={0} max={list.length - 1} step={1} value={list.indexOf(set[key])} onChange={(e) => setSet({ ...set, [key]: list[Number(e.target.value)] })} aria-label={label} />
    </label>
  );

  return (
    <div className="camera">
      <div className="finder">
        <canvas ref={canvas} className="finder-scene" role="img" aria-label={`A generated ${meter.sky} landscape`} />
        <div className="finder-corners" />
        <div className="rec mono">
          <i /> {meter.sky}
        </div>
        <div className="meter mono" aria-label={`Exposure ${needle > 0 ? "+" : ""}${needle.toFixed(1)} stops`}>
          <span>-</span>
          <span className="meter-scale">
            <i style={{ left: `${50 + (needle / 3) * 50}%` }} data-ok={Math.abs(meter.stops) < 0.6} />
          </span>
          <span>+</span>
        </div>
        {flash > 0 && <div key={flash} className="flash" />}
      </div>

      <div className="camera-controls">
        {dial("ISO", ISO, "iso", String)}
        {dial("Aperture", APERTURE, "aperture", (v) => `f/${v}`)}
        {dial("Shutter", SHUTTER, "shutter", shutterName)}
      </div>
      <div className="camera-controls">
        <button type="button" className="shutter" onClick={() => shoot()} aria-label="Take the photo">
          <span />
        </button>
        <button
          type="button"
          className="btn btn-ghost small"
          onClick={() => {
            const next = Math.floor(Math.random() * 1e9);
            setSeed(next);
            setSet({ ...set, shutter: meterFor(next, set.iso, set.aperture) });
          }}
        >
          New scene
        </button>
        <button type="button" className="btn btn-ghost small" onClick={() => setSet({ ...set, shutter: meterFor(seed, set.iso, set.aperture) })}>
          Auto expose
        </button>
        <button type="button" className="btn btn-ghost small" onClick={roll}>
          Shoot a random roll
        </button>
      </div>

      <div className="prints" aria-live="polite">
        {shots.length === 0 && <p className="mono">Your prints will develop here.</p>}
        {shots.map((s, n) => (
          <a key={s.id} className="print" href={s.src} download={`sidneyb-frame-${s.id}.jpg`} style={{ ["--tilt" as string]: `${((s.id * 37) % 9) - 4}deg` }} title="Save this print">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.src} alt={`Generated photograph. ${s.label}`} width={480} height={320} />
            <span>{s.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

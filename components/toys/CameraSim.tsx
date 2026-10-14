"use client";

import { useRef, useState } from "react";
import { useCanvas } from "./mathkit";

// Everything from the pieces above, in one camera pointed at a scene that is made up afresh each time: a time of day with its own light, hills,…
const FOCALS = [24, 35, 50, 85, 135];
const APERTURES = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16];
const SHUTTERS = [1 / 4000, 1 / 2000, 1 / 1000, 1 / 500, 1 / 250, 1 / 125, 1 / 60, 1 / 30, 1 / 15, 1 / 8, 1 / 4, 1 / 2, 1];
const ISOS = [100, 200, 400, 800, 1600, 3200, 6400];
const shutterName = (s: number) => (s >= 1 ? `${s}s` : `1/${Math.round(1 / s)}`);
type Settings = { focal: number; aperture: number; shutter: number; iso: number; focus: number; kelvin: number };
type Shot = { id: number; src: string; label: string };

// ---- Making a scene up ---------------------------------------------------------------------------------------- The light: its name, the colours…
const MOODS = [
  { name: "Dawn", sky: ["#2b2a55", "#b9799a", "#f6c7a4"], hill: ["#6d5a86", "#4b3f66"], land: ["#5d5a72", "#2a2738"], water: ["#b98aa4", "#3b3350"], ink: "#2b2238", skin: "#e9c3bd", coat: "#8a6d9e", kelvin: 4800, stops: 3.5, lamps: 0.5, stars: 0.2, orb: "#ffe1c4" },
  { name: "Midday", sky: ["#3f7fd1", "#8fbbe8", "#dfeefb"], hill: ["#7f9cc0", "#5d7ea4"], land: ["#7da268", "#3f6a3d"], water: ["#8ebde0", "#3d6f9c"], ink: "#2d4a34", skin: "#f0cdb8", coat: "#c95f6f", kelvin: 5600, stops: 8.5, lamps: 0, stars: 0, orb: "#fffbe8" },
  { name: "Golden hour", sky: ["#3b4a86", "#e7a56a", "#ffd79a"], hill: ["#8a6a7c", "#62495e"], land: ["#a8884a", "#4a3a26"], water: ["#e2a66f", "#5a3f4a"], ink: "#3a2a22", skin: "#f2c39c", coat: "#a5523f", kelvin: 3800, stops: 5.5, lamps: 0, stars: 0, orb: "#ffe9b0" },
  { name: "Dusk", sky: ["#161228", "#4b3566", "#c98a7a"], hill: ["#3d2c55", "#2a1e3d"], land: ["#221a30", "#120c1a"], water: ["#5a3f63", "#150f1f"], ink: "#120c1a", skin: "#e3bfc4", coat: "#6a4f80", kelvin: 4300, stops: 0, lamps: 1, stars: 0.35, orb: "#ffd2b0" },
  { name: "Night", sky: ["#05060f", "#0d1026", "#1c2242"], hill: ["#141a33", "#0c1022"], land: ["#0d0f1c", "#06070e"], water: ["#1a2140", "#070912"], ink: "#05060c", skin: "#9aa0c4", coat: "#3a4270", kelvin: 3400, stops: -3, lamps: 1, stars: 1, orb: "#e9edff" },
] as const;
type Mover = { kind: "cyclist" | "runner" | "car" | "boat" | "birds"; d: number; speed: number; start: number; hue: number };
type Scene = {
  seed: number;
  mood: (typeof MOODS)[number];
  water: boolean;
  orb: { a: number; e: number };
  ridges: [number, number][][];
  clouds: { a: number; e: number; w: number; drift: number }[];
  stars: { a: number; e: number; b: number }[];
  lights: { a: number; e: number; hue: number; bright: number; d: number }[];
  trees: { x: number; d: number; h: number; lean: number; tone: number }[];
  tufts: { x: number; d: number; h: number }[];
  movers: Mover[];
  figure: { x: number; d: number } | null;
  lamp: { x: number; d: number } | null;
  focusOn: [string, number][];
};
function makeScene(seed: number): Scene {
  let state = seed >>> 0;
  const r = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const between = (a: number, b: number) => a + r() * (b - a);
  const mood = MOODS[Math.floor(r() * MOODS.length)];
  const water = r() < 0.55;
  const ridge = (height: number, bumps: number): [number, number][] => Array.from({ length: bumps + 1 }, (_, k) => [-85 + (170 * k) / bumps + between(-4, 4), Math.max(0.3, height * between(0.35, 1))]);
  const movers: Mover[] = [];
  const kinds: Mover["kind"][] = water ? ["boat", "birds", "cyclist", "runner"] : ["cyclist", "runner", "car", "birds"];
  const count = 2 + Math.floor(r() * 2);
  for (let k = 0; k < count; k++) {
    const kind = kinds.splice(Math.floor(r() * kinds.length), 1)[0];
    const way = r() < 0.5 ? -1 : 1;
    movers.push({ kind, d: kind === "boat" ? between(60, 110) : kind === "birds" ? between(40, 90) : kind === "car" ? between(16, 26) : between(6, 13), speed: way * (kind === "boat" ? between(1.5, 3) : kind === "birds" ? between(9, 13) : kind === "car" ? between(11, 17) : kind === "cyclist" ? between(5, 8) : between(2.6, 3.8)), start: r(), hue: Math.floor(r() * 360) });
  }
  const figure = r() < 0.85 ? { x: between(-0.75, 0.75) * 1.1, d: between(1.8, 3.2) } : null;
  const lamp = mood.lamps > 0 && r() < 0.7 ? { x: between(-4, 4), d: between(7, 14) } : null;
  const trees = Array.from({ length: 2 + Math.floor(r() * 4) }, () => ({ x: between(-30, 30), d: between(14, 70), h: between(5, 11), lean: between(-0.06, 0.06), tone: r() }));
  const near = movers.filter((m) => m.kind !== "boat" && m.kind !== "birds").sort((a, b) => a.d - b.d)[0];
  const focusOn: [string, number][] = [];
  if (figure) focusOn.push(["The person", figure.d]);
  if (near) focusOn.push([near.kind === "car" ? "The car" : near.kind === "cyclist" ? "The cyclist" : "The runner", near.d]);
  if (trees.length) focusOn.push(["The trees", trees.reduce((a, t) => a + t.d, 0) / trees.length]);
  focusOn.push(["Far away", 300]);
  return {
    seed,
    mood,
    water,
    orb: { a: between(-22, 22), e: mood.name === "Midday" ? between(16, 22) : mood.name === "Night" ? between(8, 18) : between(1.5, 6) },
    ridges: [ridge(between(4, 9), 9), ridge(between(1.5, 3.5), 7)],
    clouds: Array.from({ length: mood.name === "Night" ? 1 : 2 + Math.floor(r() * 4) }, () => ({ a: between(-60, 60), e: between(7, 20), w: between(8, 20), drift: between(0.2, 0.8) })),
    stars: Array.from({ length: Math.round(70 * mood.stars) }, () => ({ a: between(-60, 60), e: between(2, 30), b: r() })),
    lights: Array.from({ length: Math.round((14 + r() * 18) * mood.lamps) }, () => ({ a: between(-36, 36), e: between(0.05, 0.7), hue: [38, 38, 45, 330, 200][Math.floor(r() * 5)], bright: between(0.5, 1), d: between(120, 400) })),
    trees,
    // A little grass close to the lens, kept to the edges of the frame so it frames the picture rather than hiding it.
    tufts: Array.from({ length: 1 + Math.floor(r() * 3) }, () => ({ x: (r() < 0.5 ? -1 : 1) * between(0.55, 1.0), d: between(1.1, 1.8), h: between(0.2, 0.38) })),
    movers,
    figure,
    lamp,
    focusOn: focusOn.slice(0, 4),
  };
}
// Two colours blended: `part` of the first, the rest of the second.
const mix = (a: string, b: string, part: number) => {
  const at = (c: string, k: number) => parseInt(c.slice(1 + k * 2, 3 + k * 2), 16);
  return `rgb(${[0, 1, 2].map((k) => Math.round(at(a, k) * part + at(b, k) * (1 - part))).join(",")})`;
};
// A cheap, repeatable random number for the grain.
const noise = (n: number) => ((Math.sin(n * 127.1) * 43758.5453) % 1 + 1) % 1;
// How far the settings are from a correct exposure for this scene's light, in stops.
const stopsOff = (s: Settings, scene: Scene) => Math.log2((s.shutter * s.iso) / (s.aperture * s.aperture)) - Math.log2(((1 / 60) * 800) / (2.8 * 2.8)) + scene.mood.stops;
const EYE = 1.6; // the camera is held at eye height, in metres

function render(g: CanvasRenderingContext2D, w: number, h: number, time: number, s: Settings, grainSeed: number, scene: Scene) {
  const mood = scene.mood;
  const per = w / (2 * (18 / s.focal)); // pixels per unit of tan(angle) on a 36 mm sensor
  const cx = w / 2, hz = h * 0.56;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const X = (deg: number) => cx + Math.tan(rad(deg)) * per, Y = (deg: number) => hz - Math.tan(rad(deg)) * per;
  // Where something x metres to the side, `up` metres off the ground and d metres away lands in the frame.
  const px = (x: number, d: number) => cx + (x / d) * per, py = (up: number, d: number) => hz + ((EYE - up) / d) * per;
  // The blur disc for something d metres away, as a radius in pixels.
  const blur = (d: number) => Math.min(h * 0.16, ((((s.focal * s.focal) / s.aperture) * Math.abs(d - s.focus) * 1000) / (d * 1000 * (s.focus * 1000 - s.focal)) / 36) * w / 2);
  // Draw something several times over inside its blur disc.
  const soft = (r: number, draw: (ox: number, oy: number) => void, share = 1, most = 12) => {
    const copies = r < 0.7 ? 1 : Math.min(most, 7 + Math.round(r * 0.8));
    for (let k = 0; k < copies; k++) {
      const a = k * 2.399, d = copies === 1 ? 0 : r * Math.sqrt((k + 0.5) / copies);
      g.globalAlpha = (copies === 1 ? 1 : Math.min(1, 2.2 / copies)) * share;
      draw(d * Math.cos(a), d * Math.sin(a));
    }
    g.globalAlpha = 1;
  };
  // Something moving sideways is drawn at every place it was while the shutter was open.
  const moving = (speed: number, d: number, at: number, draw: (x: number, ox: number, oy: number) => void) => {
    const smear = speed * s.shutter, steps = Math.max(1, Math.min(22, Math.round((Math.abs(smear) / d) * per / 2.5)));
    const rB = blur(d);
    for (let k = 0; k < steps; k++) {
      const m = at + (steps === 1 ? 0 : (k / (steps - 1) - 0.5) * smear);
      soft(rB, (ox, oy) => draw(m, ox, oy), steps === 1 ? 1 : Math.max(0.07, 1.5 / steps), steps > 4 ? 5 : 12); // a smear hides the blur, so fewer copies will do
    }
  };

  g.clearRect(0, 0, w, h);
  const sky = g.createLinearGradient(0, 0, 0, hz);
  mood.sky.forEach((c, k) => sky.addColorStop(k / 2, c));
  g.fillStyle = sky;
  g.fillRect(0, 0, w, hz + 1);
  const far = Math.min(14, blur(5000));
  // Stars, and the sun or moon.
  g.globalCompositeOperation = "lighter";
  scene.stars.forEach((st, k) => {
    g.fillStyle = `rgba(255,255,255,${(0.35 + st.b * 0.6) * (0.75 + 0.25 * Math.sin(time * (1 + (k % 4) * 0.6) + k)) / Math.max(1, far * 0.6)})`;
    g.beginPath(); g.arc(X(st.a), Y(st.e), Math.max(0.8, far * 0.8), 0, 7); g.fill();
  });
  const ox0 = X(scene.orb.a), oy0 = Y(scene.orb.e), orbR = Math.max(4, per * 0.012) + far;
  const halo = g.createRadialGradient(ox0, oy0, 0, ox0, oy0, orbR * 9);
  halo.addColorStop(0, mood.orb);
  halo.addColorStop(0.12, mood.orb + "aa");
  halo.addColorStop(1, mood.orb + "00");
  g.globalAlpha = mood.name === "Night" ? 0.55 : 0.9;
  g.fillStyle = halo;
  g.fillRect(0, 0, w, hz);
  g.globalAlpha = 1;
  g.fillStyle = mood.orb;
  g.beginPath(); g.arc(ox0, oy0, orbR, 0, 7); g.fill();
  g.globalCompositeOperation = "source-over";
  // Clouds, drifting.
  scene.clouds.forEach((c) => {
    const a = ((c.a + time * c.drift + 80) % 160) - 80;
    soft(far, (ox, oy) => {
      g.globalAlpha *= mood.name === "Night" ? 0.18 : 0.5;
      g.fillStyle = mood.sky[2];
      for (let k = 0; k < 4; k++) {
        g.beginPath(); g.ellipse(X(a + (k - 1.5) * c.w * 0.3) + ox, Y(c.e + (k % 2) * 0.8) + oy, (per * c.w) / 180, (per * c.w) / 520, 0, 0, 7); g.fill();
      }
    }, 1, 5);
  });
  // Hills, softened if the focus is close.
  scene.ridges.forEach((tops, k) =>
    soft(far, (ox, oy) => {
      g.fillStyle = mood.hill[k];
      g.beginPath();
      g.moveTo(X(-86) + ox, hz + 2);
      tops.forEach(([a, e]) => g.lineTo(X(a) + ox, Y(e) + oy));
      g.lineTo(X(86) + ox, hz + 2);
      g.fill();
    }, 1, 7),
  );
  // The ground, with water out to the far shore if there is any.
  const land = g.createLinearGradient(0, hz, 0, h);
  land.addColorStop(0, scene.water ? mood.water[0] : mood.land[0]);
  land.addColorStop(1, scene.water ? mood.water[1] : mood.land[1]);
  g.fillStyle = land;
  g.fillRect(0, hz, w, h - hz);
  const shore = py(0, 30);
  if (scene.water) {
    // The sun or moon on the water, in broken bars that shimmer.
    g.globalCompositeOperation = "lighter";
    for (let k = 0; k < 14; k++) {
      const y = hz + ((k + 0.5) / 14) * (shore - hz), wide = (6 + k * 3) * (1 + 0.3 * Math.sin(time * 2 + k * 1.7)) + far;
      g.fillStyle = mood.orb + "2e";
      g.fillRect(ox0 - wide, y, wide * 2, Math.max(1.5, (shore - hz) / 30));
    }
    g.globalCompositeOperation = "source-over";
  }
  // Lights far off, each a disc the size and shape of the blur, with a streak below on water.
  g.globalCompositeOperation = "lighter";
  scene.lights.forEach((l, k) => {
    const rB = Math.max(1.1, blur(l.d)), twinkle = 0.75 + 0.25 * Math.sin(time * (1.2 + (k % 5) * 0.45) + k * 1.9);
    const x = X(l.a), y = Y(l.e);
    g.fillStyle = `hsla(${l.hue}, 90%, 70%, ${Math.min(0.95, ((l.bright * 30) / (rB * rB) + 0.08) * twinkle)})`;
    g.beginPath(); g.arc(x, y, rB, 0, 7); g.fill();
    if (scene.water) {
      g.fillStyle = `hsla(${l.hue}, 90%, 70%, ${0.07 * twinkle})`;
      g.fillRect(x - Math.max(1, rB * 0.5), hz + 2, Math.max(2, rB), (shore - hz) * 0.8);
    }
  });
  g.globalCompositeOperation = "source-over";
  if (scene.water) {
    const bank = g.createLinearGradient(0, shore, 0, h);
    bank.addColorStop(0, mood.land[0]);
    bank.addColorStop(1, mood.land[1]);
    g.fillStyle = bank;
    g.beginPath();
    g.moveTo(0, h); g.lineTo(0, shore + 3); g.quadraticCurveTo(cx, shore - 5, w, shore + 5); g.lineTo(w, h);
    g.fill();
  }

  // Everything standing or moving, drawn from the farthest to the nearest.
  type Item = { d: number; draw: () => void };
  const items: Item[] = [];
  scene.trees.forEach((t, k) =>
    items.push({
      d: t.d,
      draw: () => {
        const sway = Math.sin(time * 0.9 + k * 2.1) * 0.012 + t.lean, scale = per / t.d;
        soft(blur(t.d), (ox, oy) => {
          const x = px(t.x, t.d) + ox, base = py(0, t.d) + oy, top = t.h * scale;
          g.fillStyle = mood.ink;
          g.fillRect(x - Math.max(0.6, scale * 0.14), base - top * 0.55, Math.max(1.2, scale * 0.28), top * 0.55);
          g.fillStyle = mix(mood.land[0], mood.ink, 0.35 + t.tone * 0.35);
          [[0, 0.62, 0.3], [-0.16, 0.72, 0.24], [0.17, 0.74, 0.23], [0.02, 0.88, 0.2]].forEach(([dx, up, r]) => {
            g.beginPath(); g.ellipse(x + (dx + sway * up * 6) * top, base - up * top, r * top, r * top * 0.9, 0, 0, 7); g.fill();
          });
        });
      },
    }),
  );
  if (scene.lamp) {
    const l = scene.lamp;
    items.push({
      d: l.d,
      draw: () => {
        const scale = per / l.d, x = px(l.x, l.d), base = py(0, l.d), head = py(3.6, l.d), rB = blur(l.d);
        soft(rB, (ox, oy) => {
          g.fillStyle = mood.ink;
          g.fillRect(x - Math.max(0.6, scale * 0.05) + ox, head + oy, Math.max(1.2, scale * 0.1), base - head);
        });
        g.globalCompositeOperation = "lighter";
        const glow = g.createRadialGradient(x, head, 0, x, head, scale * 2.6 + rB * 2);
        glow.addColorStop(0, "rgba(255,214,150,0.95)");
        glow.addColorStop(0.15, "rgba(255,190,110,0.4)");
        glow.addColorStop(1, "rgba(255,180,90,0)");
        g.fillStyle = glow;
        g.beginPath(); g.arc(x, head, scale * 2.6 + rB * 2, 0, 7); g.fill();
        g.globalCompositeOperation = "source-over";
      },
    });
  }
  scene.movers.forEach((m) =>
    items.push({
      d: m.d,
      draw: () => {
        const span = m.d * (18 / 24) * 2 + 8; // the widest view at this distance, and a little more
        const at = (((m.start * span + time * m.speed * 0.5) % span) + span) % span - span / 2; // shown at half speed
        const scale = per / m.d, way = Math.sign(m.speed), body = `hsl(${m.hue}, 45%, ${mood.name === "Night" ? 38 : 62}%)`;
        moving(m.speed, m.d, at, (xm, ox, oy) => {
          const x = px(xm, m.d) + ox, ground = py(0, m.d) + oy;
          g.strokeStyle = mood.name === "Midday" || mood.name === "Golden hour" ? mood.ink : "#f3eef2";
          g.fillStyle = body;
          g.lineWidth = Math.max(1, scale * 0.05);
          g.lineCap = "round";
          if (m.kind === "cyclist") {
            const wr = scale * 0.34;
            [-0.52, 0.52].forEach((dx) => {
              g.beginPath(); g.arc(x + dx * scale, ground - wr, wr, 0, 7); g.stroke();
              const turn = (xm + dx) / 0.34;
              g.beginPath(); g.moveTo(x + dx * scale, ground - wr); g.lineTo(x + dx * scale + wr * Math.cos(turn), ground - wr + wr * Math.sin(turn)); g.stroke();
            });
            g.beginPath();
            g.moveTo(x - 0.52 * scale, ground - wr); g.lineTo(x - 0.1 * way * scale, ground - scale * 0.95); g.lineTo(x + 0.52 * scale, ground - wr);
            g.stroke();
            g.beginPath(); g.ellipse(x + 0.05 * way * scale, ground - scale * 1.3, scale * 0.2, scale * 0.34, 0.5 * way, 0, 7); g.fill();
            g.beginPath(); g.arc(x + 0.28 * way * scale, ground - scale * 1.68, scale * 0.14, 0, 7); g.fill();
          } else if (m.kind === "runner") {
            const stride = Math.sin(xm * 4.2);
            g.beginPath();
            g.moveTo(x, ground - scale * 0.9); g.lineTo(x + stride * scale * 0.34, ground);
            g.moveTo(x, ground - scale * 0.9); g.lineTo(x - stride * scale * 0.34, ground - scale * 0.08);
            g.moveTo(x, ground - scale * 1.35); g.lineTo(x - stride * scale * 0.3 * way, ground - scale * 1.02);
            g.stroke();
            g.beginPath(); g.ellipse(x + 0.04 * way * scale, ground - scale * 1.2, scale * 0.16, scale * 0.34, 0.15 * way, 0, 7); g.fill();
            g.beginPath(); g.arc(x + 0.08 * way * scale, ground - scale * 1.66, scale * 0.13, 0, 7); g.fill();
          } else if (m.kind === "car") {
            g.beginPath(); g.roundRect(x - scale * 2.1, ground - scale * 0.95, scale * 4.2, scale * 0.7, scale * 0.2); g.fill();
            g.beginPath(); g.roundRect(x - scale * 1.2, ground - scale * 1.45, scale * 2.3, scale * 0.6, scale * 0.25); g.fill();
            g.fillStyle = mood.ink;
            [-1.3, 1.3].forEach((dx) => (g.beginPath(), g.arc(x + dx * scale, ground - scale * 0.3, scale * 0.32, 0, 7), g.fill()));
            if (mood.lamps > 0) {
              g.globalCompositeOperation = "lighter";
              g.fillStyle = "rgba(255,236,190,0.9)";
              g.beginPath(); g.arc(x + way * scale * 2.05, ground - scale * 0.62, Math.max(1.5, scale * 0.16), 0, 7); g.fill();
              g.fillStyle = "rgba(255,70,60,0.8)";
              g.beginPath(); g.arc(x - way * scale * 2.05, ground - scale * 0.62, Math.max(1.2, scale * 0.12), 0, 7); g.fill();
              g.globalCompositeOperation = "source-over";
            }
          } else if (m.kind === "boat") {
            const bob = Math.sin(time * 1.3 + m.start * 9) * scale * 0.12, deck = py(0, m.d) + oy - scale * 0.5 + bob;
            g.fillStyle = mood.ink;
            g.beginPath();
            g.moveTo(x - scale * 3, deck); g.lineTo(x + scale * 3, deck); g.lineTo(x + scale * 2.2, deck + scale * 0.9); g.lineTo(x - scale * 2.4, deck + scale * 0.9);
            g.fill();
            g.fillStyle = body;
            g.beginPath(); g.moveTo(x + way * scale * 0.2, deck - scale * 6); g.lineTo(x + way * scale * 0.2, deck - scale * 0.2); g.lineTo(x - way * scale * 2.6, deck - scale * 0.2); g.fill();
          } else {
            // A few birds in a loose line, wings beating.
            for (let b = 0; b < 5; b++) {
              const bx = x - way * b * scale * 1.6, by = py(18 + (b % 2) * 1.2 + b * 0.4, m.d) + oy, flap = Math.sin(xm * 2.4 + b) * scale * 0.5, wing = scale * 0.9;
              g.beginPath(); g.moveTo(bx - wing, by - flap); g.lineTo(bx, by); g.lineTo(bx + wing, by - flap); g.stroke();
            }
          }
        });
      },
    }),
  );
  if (scene.figure) {
    const f = scene.figure;
    items.push({
      d: f.d,
      draw: () => {
        const fig = per / f.d, breathe = Math.sin(time * 1.1) * fig * 0.004;
        soft(blur(f.d), (ox, oy) => {
          // Shoulders and coat, a neck, a head with hair, lit from the side the sun or moon is on.
          const x = px(f.x, f.d) + ox, hy = py(1.62, f.d) + oy + breathe, lit = scene.orb.a > (f.x / f.d) * 57 ? 1 : -1;
          g.fillStyle = mood.coat;
          g.beginPath(); g.ellipse(x, h + fig * 0.1 + oy, fig * 0.27, Math.max(4, h + fig * 0.1 - (hy + fig * 0.19)), 0, Math.PI, 0); g.fill();
          g.fillStyle = mix(mood.skin, mood.ink, 0.8);
          g.fillRect(x - fig * 0.04, hy + fig * 0.07, fig * 0.08, fig * 0.1);
          g.fillStyle = mood.skin;
          g.beginPath(); g.ellipse(x, hy, fig * 0.085, fig * 0.108, 0, 0, 7); g.fill();
          g.fillStyle = mood.ink;
          g.beginPath(); g.ellipse(x, hy - fig * 0.03, fig * 0.092, fig * 0.092, 0, Math.PI * 0.95, Math.PI * 2.05); g.fill();
          g.fillStyle = mood.orb + "55";
          g.beginPath(); g.ellipse(x + lit * fig * 0.045, hy + fig * 0.01, fig * 0.03, fig * 0.07, 0, 0, 7); g.fill();
        });
      },
    });
  }
  scene.tufts.forEach((t, k) =>
    items.push({
      d: t.d,
      draw: () => {
        const scale = per / t.d;
        soft(blur(t.d), (ox, oy) => {
          g.strokeStyle = mix(mood.land[0], mood.ink, 0.55);
          g.lineWidth = Math.max(1.5, scale * 0.008);
          g.lineCap = "round";
          for (let b = 0; b < 7; b++) {
            const x = px(t.x + (b - 3) * 0.035, t.d) + ox, sway = Math.sin(time * 1.6 + k * 1.3 + b * 0.7) * scale * 0.05;
            g.beginPath(); g.moveTo(x, h + 4); g.quadraticCurveTo(x + sway * 0.4, h - t.h * scale * 0.5 + oy, x + sway + (b - 3) * scale * 0.02, h - t.h * scale * (0.7 + (b % 3) * 0.15) + oy); g.stroke();
          }
        }, 0.85, 6);
      },
    }),
  );
  items.sort((a, b) => b.d - a.d).forEach((it) => it.draw());

  // White balance: the camera set colder than the light turns the picture orange, and the other way about.
  const cast = Math.log2(s.kelvin / mood.kelvin);
  if (Math.abs(cast) > 0.03) {
    g.fillStyle = cast > 0 ? `rgba(255,150,40,${Math.min(0.42, cast * 0.38)})` : `rgba(40,110,255,${Math.min(0.42, -cast * 0.42)})`;
    g.globalCompositeOperation = "overlay";
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 0.35;
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 1;
  }
  // Exposure.
  const ev = Math.max(-4, Math.min(4, stopsOff(s, scene)));
  if (ev > 0.05) { g.fillStyle = `rgba(255,250,244,${Math.min(0.95, ev * 0.26)})`; g.fillRect(0, 0, w, h); }
  if (ev < -0.05) { g.fillStyle = `rgba(4,2,8,${Math.min(0.95, -ev * 0.27)})`; g.fillRect(0, 0, w, h); }
  // A wide aperture darkens the corners.
  const vig = g.createRadialGradient(cx, h / 2, h * 0.3, cx, h / 2, w * 0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, `rgba(0,0,0,${0.1 + Math.max(0, 1 - Math.log2(s.aperture / 1.4) / 7) * 0.4})`);
  g.fillStyle = vig;
  g.fillRect(0, 0, w, h);
  // Grain rises with ISO, and it crawls.
  const grain = (ISOS.indexOf(s.iso) / 6) ** 1.6;
  const dots = Math.round(w * h * 0.035 * grain);
  for (let k = 0; k < dots; k++) {
    const a = noise(k + grainSeed), b = noise(k * 1.7 + grainSeed * 3.1);
    g.fillStyle = a > 0.5 ? `rgba(255,255,255,${0.08 + grain * 0.2})` : `rgba(0,0,0,${0.1 + grain * 0.2})`;
    g.fillRect(b * w, noise(k * 2.3 + grainSeed * 7.7) * h, 1.4, 1.4);
  }
}

// The shutter that suits an aperture and ISO in this scene's light.
const metered = (s: Settings, scene: Scene) => {
  const ideal = ((((1 / 60) * 800) / (2.8 * 2.8)) * (s.aperture * s.aperture)) / s.iso / 2 ** scene.mood.stops;
  return SHUTTERS.reduce((a, b) => (Math.abs(Math.log2(b / ideal)) < Math.abs(Math.log2(a / ideal)) ? b : a));
};

export function CameraSim() {
  // The first scene is always the same one (so the page is the same on the server and in the browser); every one after that is new.
  const [scene, setScene] = useState<Scene>(() => makeScene(20261009));
  const [set, setSet] = useState<Settings>(() => {
    const first = makeScene(20261009);
    const start = { focal: 35, aperture: 2.8, shutter: 1 / 60, iso: 400, focus: first.focusOn[0][1], kelvin: first.mood.kelvin };
    return { ...start, shutter: metered(start, first) };
  });
  const [shots, setShots] = useState<Shot[]>([]);
  const [flash, setFlash] = useState(0);
  const live = useRef({ set, now: { ...set }, t: 0, frame: 0, scene });
  live.current.set = set;
  live.current.scene = scene;
  const count = useRef(0);
  const ref = useCanvas((g, w, h, dt) => {
    const s = live.current;
    s.t += dt;
    s.frame += 1;
    // Glide to the new settings, as the rings on a real lens would: the zoom, the iris and the focus all travel.
    const k = 1 - Math.exp(-7 * dt), to = s.set, at = s.now;
    (["focal", "aperture", "shutter", "focus", "kelvin"] as const).forEach((key) => (at[key] = Math.exp(Math.log(at[key]) + (Math.log(to[key]) - Math.log(at[key])) * k)));
    at.iso = to.iso;
    render(g, w, h, s.t, at, Math.floor(s.frame / 3), s.scene);
  });

  const stops = stopsOff(set, scene), needle = Math.max(-3, Math.min(3, stops));
  const change = (patch: Partial<Settings>) => setSet({ ...set, ...patch });
  const shoot = () => {
    const print = document.createElement("canvas");
    print.width = 540;
    print.height = 360;
    const g = print.getContext("2d");
    if (!g) return;
    render(g, 540, 360, live.current.t, set, live.current.frame, scene);
    count.current += 1;
    const label = `No. ${String(count.current).padStart(2, "0")} · ${scene.mood.name} · ${set.focal} mm · f/${set.aperture} · ${shutterName(set.shutter)} · ISO ${set.iso}`;
    setShots((list) => [{ id: count.current, src: print.toDataURL("image/jpeg", 0.86), label }, ...list].slice(0, 12));
    setFlash((f) => f + 1);
  };
  // What the camera's auto mode would do: keep the aperture, pick the lowest ISO that still lets the shutter be fast enough to hold by hand (1/60 s),…
  const meter = () => {
    const iso = ISOS.find((v) => metered({ ...set, iso: v }, scene) <= 1 / 60) ?? ISOS[ISOS.length - 1];
    change({ iso, shutter: metered({ ...set, iso }, scene) });
  };
  // A new place and a new light. The camera is left as it was, so the old settings are probably wrong for it.
  const another = () => {
    const next = makeScene((Math.random() * 2 ** 31) | 0);
    setScene(next);
    setSet((was) => ({ ...was, focus: next.focusOn[0][1] }));
  };
  const pick = (label: string, list: number[], key: keyof Settings, show: (v: number) => string) => (
    <label className="slider mono">
      <span>
        {label} <b>{show(set[key])}</b>
      </span>
      <input type="range" min={0} max={list.length - 1} step={1} value={list.indexOf(set[key])} onChange={(e) => change({ [key]: list[Number(e.target.value)] })} aria-label={label} />
    </label>
  );
  // Focus runs on a log scale so that the first few metres, where it matters, get most of the slider.
  const focusAt = Math.log(set.focus / 1.2) / Math.log(120 / 1.2);

  return (
    <div className="camera cam-sim">
      <div className="finder">
        <canvas ref={ref} className="finder-scene" role="img" aria-label={`The view through a ${set.focal} millimetre lens at f/${set.aperture}, ${shutterName(set.shutter)} of a second, ISO ${set.iso}, focused at ${set.focus.toFixed(1)} metres`} />
        <div className="finder-corners" />
        <div className="rec mono">
          <i /> {scene.mood.name} · {set.focal} mm · focus {set.focus < 100 ? `${set.focus.toFixed(1)} m` : "far"}
        </div>
        <div className="meter mono" aria-label={`Exposure ${needle > 0 ? "+" : ""}${needle.toFixed(1)} stops`}>
          <span>-</span>
          <span className="meter-scale">
            <i style={{ left: `${50 + (needle / 3) * 50}%` }} data-ok={Math.abs(stops) < 0.6} />
          </span>
          <span>+</span>
        </div>
        {flash > 0 && <div key={flash} className="flash" />}
      </div>

      <div className="camera-controls">
        {pick("Lens", FOCALS, "focal", (v) => `${v} mm`)}
        {pick("Aperture", APERTURES, "aperture", (v) => `f/${v}`)}
        {pick("Shutter", SHUTTERS, "shutter", shutterName)}
        {pick("ISO", ISOS, "iso", String)}
        <label className="slider mono">
          <span>
            Focus <b>{set.focus < 100 ? `${set.focus.toFixed(1)} m` : "far"}</b>
          </span>
          <input type="range" min={0} max={1} step={0.005} value={focusAt} onChange={(e) => change({ focus: 1.2 * (120 / 1.2) ** Number(e.target.value) })} aria-label="Focus distance" />
        </label>
        <label className="slider mono">
          <span>
            White balance <b>{set.kelvin} K</b>
          </span>
          <input type="range" min={2400} max={9000} step={100} value={set.kelvin} onChange={(e) => change({ kelvin: Number(e.target.value) })} aria-label="White balance" />
        </label>
      </div>
      <div className="camera-controls">
        <button type="button" className="shutter" onClick={shoot} aria-label="Take the photo">
          <span />
        </button>
        <button type="button" className="btn btn-ghost small" onClick={meter}>
          Auto expose
        </button>
        <button type="button" className="btn btn-ghost small" onClick={another}>
          New scene
        </button>
        <span className="sim-focus">
          <span className="mono">Focus on</span>
          {scene.focusOn.map(([name, d]) => (
            <button key={name} type="button" className="btn btn-ghost small" aria-pressed={Math.abs(Math.log(set.focus / d)) < 0.08} onClick={() => change({ focus: d })}>
              {name}
            </button>
          ))}
        </span>
      </div>
      <p className="sim-hint">
        This is <b>{scene.mood.name.toLowerCase()}</b>, and every scene is made up fresh, so the right settings change each time. Focus on something near at f/1.4 and watch everything behind it melt. Then f/16, and pay for it with a slow shutter that smears whatever is moving, or a high ISO that fills the shadows with grain. Press New scene for another place and another light.
      </p>

      <div className="prints" aria-live="polite">
        {shots.length === 0 && <p className="mono">Your prints will develop here.</p>}
        {shots.map((s) => (
          <a key={s.id} className="print" href={s.src} download={`sidneyb-frame-${s.id}.jpg`} style={{ ["--tilt" as string]: `${((s.id * 37) % 9) - 4}deg` }} title="Save this print">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.src} alt={`Photograph from the simulator. ${s.label}`} width={540} height={360} />
            <span>{s.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

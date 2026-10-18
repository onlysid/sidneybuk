"use client";

import { useEffect, useRef, useState } from "react";
import { note, soundOn } from "@/lib/audio";
import { CENTRE, SPLIT } from "@/lib/logo-paths";
import { disciplines, type Slug } from "@/lib/site";
import { TLink } from "./Transition";

const MODES = disciplines.map((d) => d.slug) as Slug[];
const HOLD = 5200; // ms each mode stays before the logo turns over to the next
const TURN = 0.75; // seconds a turn-over takes
const PAGE = 4.8; // seconds a page of "reading" stays before the next

// The line the S follows, as points with a normal and a 0..1 position along its length.
const LINE = (() => {
  const all = CENTRE.slice(1).split("L").map((p) => p.split(" ").map(Number) as [number, number]);
  const pts = all.filter((_, i) => i % 2 === 0 || i === all.length - 1);
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return pts.map(([x, y], i) => {
    const [x0, y0] = pts[Math.max(i - 1, 0)];
    const [x1, y1] = pts[Math.min(i + 1, pts.length - 1)];
    const l = Math.hypot(x1 - x0, y1 - y0) || 1;
    return { x, y, nx: -(y1 - y0) / l, ny: (x1 - x0) / l, u: len[i] / len[len.length - 1] };
  });
})();
const at = (u: number) => LINE[Math.max(0, Math.min(LINE.length - 1, Math.round(u * (LINE.length - 1))))];
const GAP = 7.2; // distance between strings
const width = (u: number) => 1.4 + 3.2 * Math.sin(Math.PI * u); // thin at the ends, full in the middle
const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};
const INK = "#201a26";

// The tile's four corner radii (top-left, top-right, bottom-right, bottom-left) in each mode.
const CORNERS: Record<Slug, number[]> = {
  code: [18, 18, 18, 2],
  maths: [50, 50, 50, 50],
  music: [34, 34, 34, 0],
  film: [9, 9, 9, 9],
  learning: [22, 50, 22, 50],
  reading: [6, 26, 26, 6],
  travel: [50, 50, 0, 50],
  sport: [16, 16, 16, 16],
};

type Shape = { off: (u: number) => number; wide?: (u: number) => number; cuts?: [number, number][]; ghost?: number; harmonic?: number };

// Dashes of uneven length sliding along a string: tokens of code, words of verse, frames of film.
function dashes(seed: number, shift: number, size: number, gap: number, even = false): [number, number][] {
  const out: [number, number][] = [];
  const period = 1.6;
  let x = -(((shift % period) + period) % period);
  for (let n = 0; x < 1; n++) {
    const len = even ? size : size * (0.5 + hash(seed * 17 + (n % 12)) * 1.1);
    if (x + len > 0) out.push([Math.max(0, x), Math.min(1, x + len)]);
    x += len + gap;
  }
  return out;
}

// What each string does in each mode at time t (seconds since the mode began).
function shape(mode: Slug, j: number, t: number): Shape {
  const pin = (u: number) => Math.sin(Math.PI * u);
  switch (mode) {
    case "music": {
      // Two bars on a loop: a strum down, a strum up, then each string picked in turn.
      const bar = ((t % 3.4) + 3.4) % 3.4;
      const hits = [0.0 + j * 0.07, 0.85 + (2 - j) * 0.07, 1.7 + j * 0.32, 2.66 + (2 - j) * 0.18];
      let since = 9;
      let which = 0;
      hits.forEach((h, n) => {
        if (bar >= h && bar - h < since) {
          since = bar - h;
          which = n;
        }
      });
      // Kept small: the strings should ring, not rattle the S out of shape.
      const amp = 2.6 * Math.exp(-since * 2.6);
      const harmonic = ((j + which) % 3) + 1;
      const ripple = since * 1.5;
      return {
        off: (u) => amp * Math.sin(harmonic * Math.PI * u) * Math.cos(since * (17 + j * 4)) + 1.3 * Math.exp(-since * 1.8) * Math.exp(-(((u - ripple) / 0.07) ** 2)) * Math.sin(Math.PI * u),
        wide: (u) => 1 + 0.25 * Math.exp(-since * 3) * Math.sin(Math.PI * u),
        ghost: amp,
        harmonic,
      };
    }
    case "code":
      // Lines of code typed in, then scrolling past at different speeds.
      return { off: () => 0, cuts: dashes(j + 1, Math.max(0, t - 0.9) * (0.16 + j * 0.07), 0.07, 0.022).map(([a, b]) => [a, Math.min(b, (t - j * 0.12) / 0.8)] as [number, number]).filter(([a, b]) => b > a) };
    case "maths":
      // Three sine waves, a third of a turn apart, travelling along the S.
      return { off: (u) => 2.2 * pin(u) ** 0.7 * Math.sin(2 * Math.PI * (2 * u - t * 0.4) + (j * 2 * Math.PI) / 3) };
    case "film": {
      // The outer strings are perforated like the edges of a film strip and advance frame by frame.
      const step = Math.floor(t * 9) / 9;
      return j === 1 ? { off: () => 0, wide: () => 1.25 } : { off: () => 0, cuts: dashes(3, step * 0.3, 0.03, 0.022, true) };
    }
    case "learning": {
      // A voice: bursts of syllables running along the strings.
      return { off: (u) => 1.9 * pin(u) * Math.max(0, Math.sin(t * 3.6 - u * 8 + j * 1.3)) ** 2 * Math.sin(u * 34 - t * 6 + j * 2) };
    }
    case "reading": {
      // A page of three lines, read along with a highlighter (drawn on top), then turned: the next page's
      // lines slide in from the left.
      const page = Math.floor(t / PAGE);
      const reveal = Math.min(1, (t - page * PAGE) / 0.45);
      return { off: () => 0, cuts: dashes(j + 11 + page * 3, 0, 0.11, 0.03).map(([a, b]) => [a, Math.min(b, reveal)] as [number, number]).filter(([a, b]) => b > a) };
    }
    case "travel":
      // Contour lines either side of a dashed route.
      return j === 1 ? { off: () => 0, cuts: dashes(5, t * 0.1, 0.034, 0.026, true) } : { off: (u) => 1.1 * pin(u) * Math.sin(u * 7 + t * 0.5 + j * 2), wide: () => 0.7 };
    default:
      // sport: the strings are the lanes of a track. The runner and the rally are drawn on top.
      return { off: () => 0, wide: () => 0.7 };
  }
}

type Pluck = { at: number; u: number; power: number };

// The mark, alive, drawn on a canvas so it stays smooth.
export function HeroLogo() {
  const [index, setIndex] = useState(MODES.indexOf("music"));
  const mode = MODES[index];
  const canvas = useRef<HTMLCanvasElement>(null);
  const sparks = useRef<HTMLSpanElement>(null);
  // "lost" is the time spent held still while the page rested, so the logo's own clock carries on from where it
  // stopped rather than jumping; everything that reads the time goes through clock().
  const live = useRef({ mode, next: mode, turned: -10, began: 0, plucks: [] as Pluck[], lastU: -1, corners: [...CORNERS[mode]], speed: [0, 0, 0, 0], lost: 0, pausedAt: 0, lastNow: 0 });
  const clock = () => {
    const s = live.current;
    return (performance.now() - s.lost - (s.pausedAt ? performance.now() - s.pausedAt : 0)) / 1000;
  };
  const taps = useRef(0);
  const word = useRef<HTMLSpanElement>(null);
  const [wordWidth, setWordWidth] = useState<number | null>(null);
  // The label is a box whose width is animated, so the pill grows and shrinks to fit each word.
  useEffect(() => {
    const fit = () => word.current && setWordWidth(word.current.offsetWidth);
    fit();
    document.fonts?.ready.then(fit);
  }, [mode]);

  // Cycle through the modes; pressing the logo restarts the wait.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // While the page rests deeply the logo holds still, so the turn-over waits too, otherwise the word under it
    // would change while the picture did not.
    let t = 0;
    const turn = () => {
      if (document.documentElement.dataset.rest === "deep") t = window.setTimeout(turn, 500);
      else setIndex((i) => (i + 1) % MODES.length);
    };
    t = window.setTimeout(turn, HOLD);
    return () => window.clearTimeout(t);
  }, [index]);

  useEffect(() => {
    const s = live.current;
    if (s.next !== mode) {
      s.next = mode;
      s.turned = clock();
    }
  }, [mode]);

  useEffect(() => {
    const node = canvas.current;
    const context = node?.getContext("2d");
    if (!node || !context) return;
    const el: HTMLCanvasElement = node;
    const g: CanvasRenderingContext2D = context;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const s = live.current;
    const split = new Path2D(SPLIT);
    let frame = 0;
    let seen = true;
    let scale = 1;
    let thin = 1; // how full the strings are: 1 normally, 0 at the middle of a change of mode

    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const px = Math.round(el.clientWidth * dpr);
      if (px && el.width !== px) el.width = el.height = px;
      scale = el.width / 128;
    };
    const ro = new ResizeObserver(() => {
      fit();
      if (reduce) draw(performance.now());
    });
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => {
      seen = e.isIntersecting;
      if (seen && !frame && !reduce) frame = requestAnimationFrame(draw);
    });
    io.observe(el);

    const tile = () => {
      g.beginPath();
      g.roundRect(14, 14, 100, 100, s.corners.map((c) => Math.max(0, Math.min(50, c))));
    };
    const ribbon = (j: number, sh: Shape, off: (u: number) => number) => {
      for (const [from, to] of sh.cuts ?? [[0, 1]]) {
        let first = -1, last = -1;
        for (let i = 0; i < LINE.length; i++) {
          if (LINE[i].u < from || LINE[i].u > to) continue;
          if (first < 0) first = i;
          last = i;
        }
        if (last - first < 1) continue;
        for (let i = first; i <= last; i++) {
          const p = LINE[i];
          const d = (j - 1) * GAP + off(p.u) + (width(p.u) * thin * (sh.wide ? sh.wide(p.u) : 1)) / 2;
          if (i === first) g.moveTo(p.x + p.nx * d, p.y + p.ny * d);
          else g.lineTo(p.x + p.nx * d, p.y + p.ny * d);
        }
        for (let i = last; i >= first; i--) {
          const p = LINE[i];
          const d = (j - 1) * GAP + off(p.u) - (width(p.u) * thin * (sh.wide ? sh.wide(p.u) : 1)) / 2;
          g.lineTo(p.x + p.nx * d, p.y + p.ny * d);
        }
        g.closePath();
      }
    };

    // Left alone, the page says so (data-rest on <html>): the strings then draw less often, and after longer
    // they hold still, taking up where they left off at the next touch.
    function draw(ms: number) {
      frame = 0;
      if (!seen) return;
      const rest = document.documentElement.dataset.rest;
      if (!reduce) {
        if (rest === "deep") {
          if (!s.pausedAt) s.pausedAt = ms;
          frame = -1; // waiting, so nothing else starts a second loop
          window.setTimeout(() => (frame = requestAnimationFrame(draw)), 400);
          return;
        }
        if (rest) {
          frame = -1;
          window.setTimeout(() => (frame = requestAnimationFrame(draw)), 33);
        } else frame = requestAnimationFrame(draw);
      }
      if (s.pausedAt) {
        s.lost += ms - s.pausedAt;
        s.pausedAt = 0;
      }
      const now = (ms - s.lost) / 1000;
      // How many sixtieths of a second since the last frame: the springs below take the same path at any frame rate.
      const step = Math.min(3, Math.max(0.25, (now - (s.lastNow || now)) * 60));
      s.lastNow = now;

      // Turning over: squeeze to an edge, swap what the strings are doing, open out again.
      const p = reduce ? 1 : Math.max(0, Math.min(1, (now - s.turned) / TURN));
      if (p >= 0.5 && s.mode !== s.next) {
        s.mode = s.next;
        s.began = now;
      }
      const e = p < 1 ? 1 - Math.pow(1 - p, 3) : 1;
      const flip = Math.abs(Math.cos(Math.PI * e));
      const lift = Math.sin(Math.PI * e);
      thin = Math.max(0.02, flip);
      const vertical = MODES.indexOf(s.next) % 2 === 1;
      const t = now - s.began;

      // The outline springs towards the shape for this mode.
      const want = CORNERS[s.next];
      for (let c = 0; c < 4; c++) {
        s.speed[c] = (s.speed[c] + (want[c] - s.corners[c]) * 0.03 * step) * Math.pow(0.86, step);
        s.corners[c] += s.speed[c] * step;
        if (reduce) s.corners[c] = want[c];
      }

      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, el.width, el.height);
      g.setTransform(scale, 0, 0, scale, 0, 0);
      g.translate(64, 64);
      // The tile stays face-on while it changes, so the outline can be seen flowing from one shape to the next: it dips, leans a little and comes back,…
      g.rotate(((vertical ? -1 : 1) * 4 * lift * Math.PI) / 180);
      g.scale(1 - 0.06 * lift, 1 - 0.06 * lift);
      g.translate(-64, -64);

      // The tile: two tones that meet along the S.
      const top = g.createLinearGradient(14, 14, 90, 90);
      top.addColorStop(0, "#DDB3CB");
      top.addColorStop(1, "#A878AA");
      const low = g.createLinearGradient(40, 40, 114, 114);
      low.addColorStop(0, "#A878AA");
      low.addColorStop(1, "#684780");
      g.save();
      tile();
      g.clip();
      g.fillStyle = top;
      g.fillRect(0, 0, 128, 128);
      g.save();
      g.clip(split);
      g.fillStyle = low;
      g.fillRect(0, 0, 128, 128);
      g.restore();

      // A band of light crossing now and then.
      const sweep = ((now % 5.2) / 5.2 - 0.55) / 0.3;
      if (sweep > 0 && sweep < 1) {
        g.fillStyle = "rgba(255,255,255,0.16)";
        g.beginPath();
        const x = -40 + sweep * 220;
        g.moveTo(x, 0); g.lineTo(x + 30, 0); g.lineTo(x - 10, 128); g.lineTo(x - 40, 128);
        g.fill();
      }
      const fade = Math.min(1, t / 0.5);
      if (s.mode === "maths") {
        g.strokeStyle = `rgba(32,26,38,${0.2 * fade})`;
        g.lineWidth = 0.5;
        g.beginPath();
        for (let v = 30; v < 110; v += 16) { g.moveTo(v, 14); g.lineTo(v, 114); g.moveTo(14, v); g.lineTo(114, v); }
        g.stroke();
      }

      // Cut the strings out of the tile.
      s.plucks = s.plucks.filter((k) => now - k.at < 1.6);
      const fan = p < 1 ? 2 * lift : 0;
      g.globalCompositeOperation = "destination-out";
      for (let j = 0; j < 3; j++) {
        const base = shape(s.mode, j, t);
        const off = (u: number) => {
          let o = base.off(u) + (j - 1) * fan;
          for (const k of s.plucks) {
            const age = now - k.at;
            const spread = 0.1 + age * 0.25;
            o += k.power * Math.exp(-age * 3) * Math.exp(-(((u - k.u) / spread) ** 2)) * Math.cos(age * 22 + j * 1.3);
          }
          return o;
        };
        // A ringing string blurs: draw faint copies at the edges of its swing.
        if (base.ghost && base.ghost > 0.4) {
          g.globalAlpha = 0.22;
          for (const side of [-1, 1]) {
            g.beginPath();
            ribbon(j, base, (u) => side * base.ghost! * Math.sin((base.harmonic ?? 1) * Math.PI * u));
            g.fill();
          }
          g.globalAlpha = 1;
        }
        g.beginPath();
        ribbon(j, base, off);
        g.fill();
      }
      // The underscore: a cursor in most modes, a beat in music, a light in film.
      const blink = s.mode === "code" ? now % 0.45 < 0.225 : now % 1.1 < 0.55;
      if (s.mode !== "film" && (blink || s.mode === "music" || s.mode === "sport")) {
        const beat = s.mode === "music" ? 1 + 0.35 * Math.exp(-((t % 1.7) * 5)) : s.mode === "sport" ? 1 + 0.4 * Math.exp(-((t % 1.4) * 6)) : 1;
        g.beginPath();
        g.roundRect(96 - 8 * beat, 98.5 - 3 * beat, 16 * beat, 6 * beat, 1.5);
        g.fill();
      }
      g.globalCompositeOperation = "source-over";

      if (s.mode === "maths") {
        // A point rides the curve with its tangent line and a circle that hugs the bend.
        const u = 0.12 + 0.76 * (0.5 - 0.5 * Math.cos(t * 0.9));
        const q = at(u), a = at(u - 0.03), b = at(u + 0.03);
        const turn = Math.atan2(b.ny, b.nx) - Math.atan2(a.ny, a.nx);
        const bend = Math.atan2(Math.sin(turn), Math.cos(turn));
        const r = Math.min(24, Math.abs(15 / (bend || 0.001)));
        const side = bend > 0 ? 1 : -1;
        g.globalAlpha = fade;
        g.strokeStyle = "rgba(255,255,255,0.5)";
        g.lineWidth = 0.7;
        g.beginPath();
        g.arc(q.x + q.nx * r * side, q.y + q.ny * r * side, r, 0, 7);
        g.stroke();
        g.strokeStyle = INK;
        g.lineWidth = 0.9;
        g.setLineDash([2, 2]);
        g.beginPath();
        g.moveTo(q.x - q.ny * 30, q.y + q.nx * 30);
        g.lineTo(q.x + q.ny * 30, q.y - q.nx * 30);
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = INK;
        g.strokeStyle = "#fff";
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(q.x, q.y, 3.6, 0, 7);
        g.fill();
        g.stroke();
        g.globalAlpha = 1;
      }
      if (s.mode === "travel") {
        // Something small flying the route, with a pin where it is headed.
        const u = (t * 0.2) % 1;
        const q = at(u), ahead = at(u + 0.02);
        g.globalAlpha = fade * Math.min(1, u * 8, (1 - u) * 8);
        g.save();
        g.translate(q.x, q.y);
        g.rotate(Math.atan2(ahead.y - q.y, ahead.x - q.x));
        g.fillStyle = "#fff";
        g.beginPath();
        g.moveTo(6, 0); g.lineTo(-5, -4); g.lineTo(-2.5, 0); g.lineTo(-5, 4);
        g.fill();
        g.restore();
        g.globalAlpha = 1;
      }
      if (s.mode === "reading") {
        // A highlighter reads along the lines, one after another, pausing while a page turns; the line being
        // read is lit a little, and a small dot marks where the eye is.
        const into = t - Math.floor(t / PAGE) * PAGE;
        if (into > 0.5) {
          const r = Math.min(0.999, (into - 0.5) / (PAGE - 0.7));
          const line = Math.floor(r * 3);
          const along = (r * 3) % 1;
          const ease = along < 0.5 ? 2 * along * along : 1 - Math.pow(-2 * along + 2, 2) / 2;
          const end = 0.04 + ease * 0.92;
          g.globalAlpha = 0.72 * fade;
          g.fillStyle = "#ffe98a";
          g.beginPath();
          ribbon(line, { off: () => 0, wide: () => 2.4, cuts: [[0.04, end]] }, () => 0);
          g.fill();
          // The eye: a dot at the end of what has been read so far.
          const q = at(end);
          const d = (line - 1) * GAP;
          g.globalAlpha = 0.9 * fade;
          g.fillStyle = "#fff";
          g.beginPath();
          g.arc(q.x + q.nx * d, q.y + q.ny * d, 2.1, 0, Math.PI * 2);
          g.fill();
          g.globalAlpha = 1;
        }
      }
      if (s.mode === "sport") {
        // A padel court from above: glass walls all round, doubles, solid bats with holes in them, and the shot that makes it padel: the ball comes off the…
        g.globalAlpha = fade;
        const L = 26, R = 102, T = 26, B = 102, NET = 64;
        const shot = 1.15;
        const n = Math.floor(t / shot);
        const k = (t % shot) / shot;
        const up = n % 2 === 0; // the ball is travelling up the court on even shots
        const side = (i: number) => 38 + hash(i * 3.7 + 1) * 52;
        const ease = (x: number) => x * x * (3 - 2 * x);
        const wall = up ? T : B;
        const from = up ? B - 13 : T + 13;
        const to = up ? T + 13 : B - 13;
        const hitWall = 0.66;
        const xw = side(n) + (side(n + 1) - side(n)) * 0.72;
        const bx = k < hitWall ? side(n) + (xw - side(n)) * (k / hitWall) : xw + (side(n + 1) - xw) * ((k - hitWall) / (1 - hitWall));
        const by = k < hitWall ? from + (wall - from) * (k / hitWall) : wall + (to - wall) * ease((k - hitWall) / (1 - hitWall));
        const height = k < hitWall ? Math.sin((k / hitWall) * Math.PI) : 0.5 * Math.sin(((k - hitWall) / (1 - hitWall)) * Math.PI);
        // Court markings.
        g.strokeStyle = "rgba(255,255,255,0.5)";
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(L, T + 16); g.lineTo(R, T + 16); g.moveTo(L, B - 16); g.lineTo(R, B - 16);
        g.moveTo(64, T + 16); g.lineTo(64, B - 16);
        g.stroke();
        // Glass walls: a double line, and the back wall lights up where the ball strikes it.
        g.strokeStyle = "rgba(255,255,255,0.85)";
        g.lineWidth = 1.6;
        g.strokeRect(L, T, R - L, B - T);
        g.strokeStyle = "rgba(255,255,255,0.3)";
        g.lineWidth = 0.8;
        g.strokeRect(L - 2.6, T - 2.6, R - L + 5.2, B - T + 5.2);
        if (k >= hitWall) {
          const glow = Math.exp(-(k - hitWall) * shot * 7);
          g.strokeStyle = `rgba(233,255,112,${glow})`;
          g.lineWidth = 2.6;
          g.beginPath();
          g.moveTo(xw - 12, wall); g.lineTo(xw + 12, wall);
          g.stroke();
          g.strokeStyle = `rgba(233,255,112,${glow * 0.7})`;
          g.lineWidth = 1;
          g.beginPath();
          g.arc(xw, wall, 4 + (1 - glow) * 9, up ? 0 : Math.PI, up ? Math.PI : Math.PI * 2);
          g.stroke();
        }
        g.setLineDash([2, 2]);
        g.strokeStyle = "#fff";
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(L - 3, NET); g.lineTo(R + 3, NET);
        g.stroke();
        g.setLineDash([]);
        // A padel bat: a solid face with holes, on a short handle.
        const bat = (x: number, y: number, swing: number, dir: number) => {
          g.save();
          g.translate(x, y);
          g.rotate(swing * dir);
          g.strokeStyle = "#fff";
          g.lineWidth = 1.8;
          g.lineCap = "round";
          g.beginPath();
          g.moveTo(0, 0); g.lineTo(0, 6.5 * dir);
          g.stroke();
          g.fillStyle = "#fff";
          g.beginPath();
          g.ellipse(0, -4.6 * dir, 4.3, 5, 0, 0, 7);
          g.fill();
          g.fillStyle = "#684780";
          for (const [hx, hy] of [[0, -4.6], [-1.9, -6.4], [1.9, -6.4], [-1.9, -2.8], [1.9, -2.8]]) {
            g.beginPath();
            g.arc(hx, hy * dir, 0.75, 0, 7);
            g.fill();
          }
          g.restore();
        };
        // Doubles.
        const pair = (top: boolean) => {
          const receiving = top === up;
          const target = receiving ? side(n + 1) : side(n);
          const move = receiving ? ease(k) : 1 - ease(Math.min(1, k * 1.6));
          const swing = receiving ? Math.max(0, (k - 0.8) / 0.2) : Math.max(0, 1 - k * 4);
          for (const home of [45, 83]) {
            const mine = home < 64 === target < 64;
            const x = mine ? home + (target - home) * move : home;
            const y = top ? (mine ? T + 9 : T + 22) : mine ? B - 9 : B - 22;
            bat(x + (top ? -5 : 5), y, mine ? swing * -1.2 : 0, top ? -1 : 1);
          }
        };
        pair(true);
        pair(false);
        g.fillStyle = "rgba(32,26,38,0.3)";
        g.beginPath();
        g.ellipse(bx + height * 3, by + height * 4, 2.6, 1.6, 0, 0, 7);
        g.fill();
        g.fillStyle = "#e9ff70";
        g.beginPath();
        g.arc(bx, by, 2.3 + height * 1.4, 0, 7);
        g.fill();
        // The runner.
        for (let tail = 5; tail >= 0; tail--) {
          const u = (((t * 0.22 - tail * 0.012) % 1) + 1) % 1;
          const q = at(u);
          g.fillStyle = `rgba(255,255,255,${tail ? 0.5 - tail * 0.08 : 1})`;
          g.beginPath();
          g.arc(q.x, q.y, tail ? 2.1 - tail * 0.25 : 2.6, 0, 7);
          g.fill();
        }
        g.globalAlpha = 1;
      }
      if (s.mode === "film") {
        g.globalAlpha = fade;
        g.strokeStyle = "#fff";
        g.lineWidth = 2.2;
        g.lineCap = g.lineJoin = "round";
        g.beginPath();
        g.moveTo(24, 34); g.lineTo(24, 24); g.lineTo(34, 24);
        g.moveTo(94, 24); g.lineTo(104, 24); g.lineTo(104, 34);
        g.moveTo(24, 94); g.lineTo(24, 104); g.lineTo(34, 104);
        g.stroke();
        if (now % 1 < 0.5) {
          g.fillStyle = "#ff6b81";
          g.beginPath();
          g.arc(96, 98.5, 4.5, 0, 7);
          g.fill();
        }
        g.globalAlpha = 1;
        // A six-bladed shutter snaps shut and opens as the mode begins, with a flash after it.
        const open = Math.min(1, Math.abs(t - 0.45) / 0.4);
        if (open < 1) {
          const r = 4 + 86 * open;
          g.fillStyle = INK;
          g.beginPath();
          g.rect(0, 0, 128, 128);
          for (let n = 0; n < 6; n++) {
            const a = (n * Math.PI) / 3 + open * 1.2;
            if (n) g.lineTo(64 + r * Math.cos(a), 64 + r * Math.sin(a));
            else g.moveTo(64 + r * Math.cos(a), 64 + r * Math.sin(a));
          }
          g.closePath();
          g.fill("evenodd");
        }
        const flash = 1 - (t - 0.82) / 0.5;
        if (t > 0.82 && flash > 0) {
          g.fillStyle = `rgba(255,255,255,${0.85 * flash})`;
          g.fillRect(0, 0, 128, 128);
        }
      }
      g.restore();
    }

    fit();
    if (reduce) draw(performance.now());
    else frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  // Moving across the logo plucks the strings where the pointer is.
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * 128;
    const y = ((e.clientY - box.top) / box.height) * 128;
    let best = LINE[0];
    for (const p of LINE) if ((p.x - x) ** 2 + (p.y - y) ** 2 < (best.x - x) ** 2 + (best.y - y) ** 2) best = p;
    const s = live.current;
    if (Math.hypot(best.x - x, best.y - y) > 16 || Math.abs(best.u - s.lastU) < 0.08) return;
    s.lastU = best.u;
    s.plucks.push({ at: clock(), u: best.u, power: 1.8 });
    if (s.plucks.length > 6) s.plucks.shift();
  };

  // Pressing it throws sparks, plays a note if sound is on, and turns to the next mode.
  const onPress = () => {
    live.current.plucks.push({ at: clock(), u: 0.5, power: 3 });
    if (soundOn()) note([196, 246.94, 293.66, 329.63, 392][taps.current++ % 5]);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && sparks.current) {
      for (let n = 0; n < 14; n++) {
        const el = document.createElement("i");
        const angle = (n / 14) * Math.PI * 2 + Math.random() * 0.4;
        const far = 90 + Math.random() * 70;
        el.style.background = ["#DDB3CB", "#A878AA", "#684780"][n % 3];
        sparks.current.appendChild(el);
        el.animate(
          [
            { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
            { transform: `translate(calc(-50% + ${Math.cos(angle) * far}px), calc(-50% + ${Math.sin(angle) * far}px)) scale(0)`, opacity: 0 },
          ],
          { duration: 700 + Math.random() * 400, easing: "cubic-bezier(0.1, 0.8, 0.2, 1)" },
        ).onfinish = () => el.remove();
      }
    }
    setIndex((i) => (i + 1) % MODES.length);
  };

  const each = (items: string[], wrap = false) =>
    items.map((s, n) => (
      <i key={s + n} style={{ ["--i" as string]: n, ["--n" as string]: items.length }}>
        {wrap ? <em>{s}</em> : s}
      </i>
    ));

  return (
    <div className="live" data-mode={mode}>
      <div className="live-stage">
        <span className="live-shadow" aria-hidden="true" />
        <canvas ref={canvas} role="img" aria-label="Sidney B logo. Press to change what it is doing." onPointerMove={onMove} onClick={onPress} data-lens />
        {/* Things that happen around the tile, one set per mode. They sit in front of it, so the braces close round the logo. */}
        <div className="fx" aria-hidden="true">
          <span className="fx-music">
            <span className="fx-eq">{each(Array(28).fill(""), true)}</span>
            {each(["♪", "quiet", "♫", "rain", "♩", "hums", "♬", "light"])}
          </span>
          <span className="fx-code">
            <b>{"{"}</b>
            <b>{"}"}</b>
            {each(["</>", "=>", "{ }", "01", "fn()", "&&", "[ ]", "//", "#!", "==", ";", "$_"])}
          </span>
          <span className="fx-maths">{each(["π", "∑", "∫", "∞", "√", "Δ"], true)}</span>
          <span className="fx-film">
            <b />
            <b />
            <u />
          </span>
          <span className="fx-learning">
            <u />
            <u />
            <u />
            {each(["E = mc²", "Labas", "∴", "ħ", "Bonjour", "why?", "λ", "F = ma", "φ", "cogito"])}
          </span>
          <span className="fx-reading">
            <b />
            {each(["❝", "ch. 1", "§", "❞", "p. 42", "¶", "the end", "…"])}
          </span>
          <span className="fx-travel">
            <u />
            {each(["N", "E", "S", "W"], true)}
          </span>
          <span className="fx-sport">
            <b />
            <b />
            {each(["padel", "15–0", "bandeja", "5K", "golden point", "tennis"], true)}
          </span>
          <span className="fx-sparks" ref={sparks} />
        </div>
      </div>
      <span className="live-label glass" aria-live="polite">
        <span className="prompt" aria-hidden="true">
          &gt;
        </span>
        <span className="live-box" style={wordWidth === null ? undefined : { width: wordWidth }}>
          <span key={mode} className="live-word" ref={word}>
            {mode}
          </span>
        </span>
        <span className="cursor" aria-hidden="true" />
      </span>
      {/* Every mode is also a way in to that page. */}
      <nav className="live-rail" aria-label="Pages">
        {disciplines.map((d) => (
          <TLink key={d.slug} href={`/${d.slug}`} className="rail-chip" data-on={d.slug === mode}>
            {d.slug}
          </TLink>
        ))}
      </nav>
    </div>
  );
}

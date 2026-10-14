"use client";

import { useEffect, useRef } from "react";
import { onSoundStart, readMeter } from "@/lib/audio";

// Whenever anything on the site is making sound, the frame of the window becomes its meter: a row of fine bars along every edge, standing up out of…
const BANDS = 28;

const DEPTH = 46; // how far into the window a side's strip reaches

// Each side is its own thin strip rather than one drawing the size of the window, so that a frame of the meter repaints four slivers of the screen…
export function SoundFrame() {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = box.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const strips = [...root.querySelectorAll<SVGSVGElement>("svg")];
    const pick = (name: string) => strips.map((el) => el.querySelector<SVGPathElement>(name)!);
    const bars = pick(".sf-bars"), halo = pick(".sf-halo"), dots = pick(".sf-dots"), rims = pick(".sf-rim");
    const grads = strips.map((el) => el.querySelector<SVGLinearGradientElement>("linearGradient")!);
    const heard = new Float32Array(BANDS), now = new Float32Array(BANDS), peak = new Float32Array(BANDS);
    let frame = 0, quiet = 0, last = 0, shown = 0, painted = -1, w = 0, h = 0;
    type Side = { x: number; y: number; dx: number; dy: number; nx: number; ny: number; len: number };
    let sides: Side[] = [];
    // Everything that only depends on the size of the window is set here, not every frame.
    const measure = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      // Each side in its own strip's coordinates: where it starts, which way it runs, which way is "into the window".
      sides = [
        { x: 0, y: 0, dx: 1, dy: 0, nx: 0, ny: 1, len: w },
        { x: DEPTH, y: 0, dx: 0, dy: 1, nx: -1, ny: 0, len: h },
        { x: w, y: DEPTH, dx: -1, dy: 0, nx: 0, ny: -1, len: w },
        { x: 0, y: h, dx: 0, dy: -1, nx: 1, ny: 0, len: h },
      ];
      sides.forEach((s, k) => {
        const flat = s.dy === 0;
        strips[k].setAttribute("viewBox", `0 0 ${flat ? w : DEPTH} ${flat ? DEPTH : h}`);
        rims[k].setAttribute("d", `M${s.x} ${s.y}L${s.x + s.dx * s.len} ${s.y + s.dy * s.len}`);
        const g = grads[k];
        g.setAttribute("x1", String(s.x));
        g.setAttribute("y1", String(s.y));
        g.setAttribute("x2", String(s.x + s.dx * s.len));
        g.setAttribute("y2", String(s.y + s.dy * s.len));
      });
    };
    const fadeTo = (v: string) => strips.forEach((el) => (el.style.opacity = v));
    measure();
    window.addEventListener("resize", measure);
    const draw = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const top = readMeter(heard);
      let sum = 0;
      for (let b = 0; b < BANDS; b++) {
        now[b] += (heard[b] - now[b]) * Math.min(1, dt * (heard[b] > now[b] ? 32 : 9));
        peak[b] = Math.max(now[b], peak[b] - dt * 0.42);
        sum += now[b] / BANDS;
      }
      quiet = top < 0.03 ? quiet + dt : 0;
      shown += ((quiet < 0.3 ? 1 : 0) - shown) * Math.min(1, dt * (quiet < 0.3 ? 8 : 2.2));
      if (Math.abs(shown - painted) > 0.01) fadeTo((painted = shown).toFixed(2));
      const loud = Math.min(1, sum * 2.4);
      const small = Math.min(w, h) < 520;
      const tall = small ? 18 : 30, gap = small ? 9 : 12;
      sides.forEach((s, k) => {
        const count = Math.max(8, Math.floor(s.len / gap));
        let stalks = "", marks = "";
        for (let i = 0; i < count; i++) {
          const u = Math.abs((i + 0.5) / count - 0.5) * 2; // 0 in the middle of the side, 1 at a corner
          const at = u * (BANDS - 1), lo = Math.floor(at), hi = Math.min(BANDS - 1, lo + 1);
          const fade = 1 - u ** 4; // bars shrink into the corners, so the four sides meet cleanly
          const v = (now[lo] + (now[hi] - now[lo]) * (at - lo)) * fade;
          const p = (peak[lo] + (peak[hi] - peak[lo]) * (at - lo)) * fade;
          const along = ((i + 0.5) / count) * s.len;
          const x = s.x + s.dx * along, y = s.y + s.dy * along, d = 1.5 + v * tall;
          stalks += `M${x.toFixed(1)} ${y.toFixed(1)}l${(s.nx * d).toFixed(1)} ${(s.ny * d).toFixed(1)}`;
          if (p > 0.05) marks += `M${(x + s.nx * (6 + p * tall)).toFixed(1)} ${(y + s.ny * (6 + p * tall)).toFixed(1)}h0.01`;
        }
        bars[k].setAttribute("d", stalks);
        halo[k].setAttribute("d", stalks);
        dots[k].setAttribute("d", marks);
        halo[k].style.opacity = (0.06 + loud * 0.16).toFixed(2);
        rims[k].style.opacity = (0.25 + loud * 0.6).toFixed(2);
      });
      if (shown > 0.004 || quiet < 1) frame = requestAnimationFrame(draw);
      else {
        frame = 0;
        fadeTo("0");
        painted = 0;
      }
    };
    const wake = () => {
      quiet = 0;
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(draw);
      }
    };
    const off = onSoundStart(wake);
    return () => {
      off();
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div ref={box} className="sf" aria-hidden="true">
      {["top", "right", "bottom", "left"].map((side, k) => (
        <svg key={side} data-side={side} preserveAspectRatio="none">
          <defs>
            <linearGradient id={`sf-g${k}`} gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="var(--plum-soft)" />
              <stop offset="0.28" stopColor="var(--mauve)" />
              <stop offset="0.5" stopColor="var(--rose)" />
              <stop offset="0.72" stopColor="var(--mauve)" />
              <stop offset="1" stopColor="var(--plum-soft)" />
            </linearGradient>
          </defs>
          <g stroke={`url(#sf-g${k})`}>
            <path className="sf-rim" />
            <path className="sf-halo" />
            <path className="sf-bars" />
            <path className="sf-dots" />
          </g>
        </svg>
      ))}
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { note } from "@/lib/audio";

type StringState = { amp: number; at: number; t: number };

const COLOURS = ["var(--rose)", "var(--mauve)", "var(--plum-soft)"];
const NOTES = [329.63, 246.94, 196]; // E4, B3, G3: the top three strings of a guitar
const W = 1000;
const H = 180;
const YS = [50, 90, 130];
const POINTS = 64;

// Shape of a string plucked at position p (0..1): a triangle peaking where it was pulled.
function pluckShape(x: number, p: number) {
  return x < p ? x / p : (1 - x) / (1 - p);
}

// Three strings that ring when the pointer crosses them or a finger taps them.
export function Strings() {
  const svg = useRef<SVGSVGElement>(null);
  const paths = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const strings: StringState[] = YS.map(() => ({ amp: 0, at: 0.5, t: 0 }));
    let last: { x: number; y: number } | null = null;
    let frame = 0;
    let previous = performance.now();

    const draw = () => {
      strings.forEach((s, i) => {
        // A decaying mix of the first three harmonics reads as a real string without simulating one.
        const decay = Math.exp(-s.t * 1.9);
        let d = "";
        for (let k = 0; k <= POINTS; k++) {
          const x = k / POINTS;
          const ring =
            Math.cos(s.t * 26) * Math.sin(Math.PI * x) * 0.7 +
            Math.cos(s.t * 52) * Math.sin(2 * Math.PI * x) * 0.22 +
            Math.cos(s.t * 78) * Math.sin(3 * Math.PI * x) * 0.08;
          const blend = Math.min(1, s.t * 6);
          const y = YS[i] + s.amp * decay * (pluckShape(x, s.at) * (1 - blend) * Math.cos(s.t * 26) + ring * blend);
          d += `${k === 0 ? "M" : "L"}${(x * W).toFixed(1)} ${y.toFixed(2)}`;
        }
        paths.current[i]?.setAttribute("d", d);
      });
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      let alive = false;
      strings.forEach((s) => {
        if (Math.abs(s.amp) * Math.exp(-s.t * 1.9) > 0.05) {
          s.t += dt;
          alive = true;
        } else s.amp = 0;
      });
      draw();
      frame = alive ? requestAnimationFrame(tick) : 0;
    };

    const pluck = (i: number, at: number, amp: number, silent = false) => {
      if (!silent) note(NOTES[i]);
      if (reduce) return;
      strings[i] = { amp, at: Math.min(0.92, Math.max(0.08, at)), t: 0 };
      if (!frame) {
        previous = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };

    const toLocal = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width, y: ((e.clientY - r.top) / r.height) * H };
    };

    const onMove = (e: PointerEvent) => {
      const p = toLocal(e);
      if (last) {
        YS.forEach((y, i) => {
          // Crossing a string plucks it; faster crossings pluck harder.
          if ((last!.y - y) * (p.y - y) < 0) {
            const speed = Math.min(1, Math.abs(p.y - last!.y) / 30);
            pluck(i, p.x, (p.y > last!.y ? 1 : -1) * (10 + 22 * speed));
          }
        });
      }
      last = p;
    };
    // A tap plucks the nearest string, so the band also works on a phone.
    const onDown = (e: PointerEvent) => {
      const p = toLocal(e);
      const nearest = YS.reduce((best, y, i) => (Math.abs(y - p.y) < Math.abs(YS[best] - p.y) ? i : best), 0);
      pluck(nearest, p.x, 24);
      last = null;
    };
    const onLeave = () => (last = null);

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerleave", onLeave);
    draw();
    const timers = [0, 1, 2].map((i) => window.setTimeout(() => pluck(i, 0.3 + i * 0.2, 22 - i * 3, true), 900 + i * 260));

    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerleave", onLeave);
      timers.forEach((t) => window.clearTimeout(t));
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <svg ref={svg} className="strings" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Three strings you can strum">
      {YS.map((y, i) => (
        <path
          key={y}
          ref={(node) => {
            paths.current[i] = node;
          }}
          d={`M0 ${y}L${W} ${y}`}
          fill="none"
          stroke={COLOURS[i]}
          strokeWidth={3 - i * 0.4}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

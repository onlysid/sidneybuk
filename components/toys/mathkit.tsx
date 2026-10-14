"use client";

import { useEffect, useRef } from "react";

// A canvas that sizes itself and redraws on every frame while it is on screen.
export function useCanvas(draw: (g: CanvasRenderingContext2D, w: number, h: number, dt: number, colour: (name: string) => string) => void) {
  const ref = useRef<HTMLCanvasElement>(null);
  const fn = useRef(draw);
  fn.current = draw;
  useEffect(() => {
    const el = ref.current;
    const g = el?.getContext("2d");
    if (!el || !g) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const colour = (name: string) => getComputedStyle(el).getPropertyValue(name).trim() || "#a878aa";
    let frame = 0, last = performance.now(), visible = false;
    const loop = (now: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = el.clientWidth, h = el.clientHeight;
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      fn.current(g, w, h, Math.min(0.05, (now - last) / 1000), colour);
      last = now;
      if (visible) frame = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(frame);
      if (visible) {
        last = performance.now();
        frame = requestAnimationFrame(loop);
      }
    });
    io.observe(el);
    void reduce;
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  return ref;
}

// --------------------------------------------------------------------------------------------- Equations are written in MathML, which every current…
export const row = (...parts: string[]) => `<mrow>${parts.join("")}</mrow>`;
export const i = (s: string) => `<mi>${s}</mi>`;
export const n = (s: string | number) => `<mn>${s}</mn>`;
export const o = (s: string) => (s === "(" || s === ")" || s === "|" ? `<mo stretchy="false">${s}</mo>` : `<mo>${s}</mo>`); // brackets only grow where asked
export const frac = (a: string, b: string) => `<mfrac>${row(a)}${row(b)}</mfrac>`;
export const sup = (a: string, b: string) => `<msup>${row(a)}${row(b)}</msup>`;
export const sub = (a: string, b: string) => `<msub>${row(a)}${row(b)}</msub>`;
export const subsup = (a: string, b: string, c: string) => `<msubsup>${row(a)}${row(b)}${row(c)}</msubsup>`;
export const root = (a: string) => `<msqrt>${a}</msqrt>`;
export const fn = (name: string, arg: string) => (arg.includes("<mfrac>") ? `<mi>${name}</mi><mo>&#8289;</mo>${row("<mo>(</mo>", arg, "<mo>)</mo>")}` : `<mi>${name}</mi><mo>&#8289;</mo>${row(o("("), arg, o(")"))}`);
export const d2 = (y: string, x: string) => frac(sup(i("∂"), n(2)) + y, i("∂") + sup(i(x), n(2)));
export const hbar = i("ℏ");

export function Eq({ math, label, children }: { math: string; label: string; children: React.ReactNode }) {
  return (
    <li className="formula">
      <div className="formula-math" role="math" aria-label={label} dangerouslySetInnerHTML={{ __html: `<math display="block">${math}</math>` }} />
      <span>{children}</span>
    </li>
  );
}


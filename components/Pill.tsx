"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

type Box = { x: number; y: number; w: number; h: number };
const ON = ':scope > [aria-pressed="true"], :scope > [aria-selected="true"]';

// Put this first inside any row of buttons where one is on, and a filled pill slides to whichever one that is.
// The row needs position: relative; the pill takes its colour and corner from the row's --pill-* variables.
export function Pill() {
  const me = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [ready, setReady] = useState(false);
  const place = () => {
    const up = me.current?.parentElement;
    const el = up?.querySelector<HTMLElement>(ON);
    const next = el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null;
    setBox((was) => (was && next && was.x === next.x && was.y === next.y && was.w === next.w && was.h === next.h ? was : !was && !next ? was : next));
  };
  // After every render, because which button is on is decided by whoever drew the row.
  useIso(place);
  useEffect(() => {
    const up = me.current?.parentElement;
    if (!up) return;
    const f = window.requestAnimationFrame(() => setReady(true));
    const seen = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    seen?.observe(up);
    window.addEventListener("resize", place);
    return () => {
      window.cancelAnimationFrame(f);
      seen?.disconnect();
      window.removeEventListener("resize", place);
    };
  }, []);
  return <span className="pill" ref={me} data-on={!!box} data-ready={ready} style={box ? { transform: `translate(${box.x}px, ${box.y}px)`, width: box.w, height: box.h } : undefined} aria-hidden="true" />;
}

// A row of choices where one is on: the usual pill-shaped group with a glass pill that slides.
export function Seg({ label, className, role = "group", children }: { label: string; className?: string; role?: string; children: React.ReactNode }) {
  return (
    <div className={`seg${className ? ` ${className}` : ""}`} role={role} aria-label={label}>
      <Pill />
      {children}
    </div>
  );
}

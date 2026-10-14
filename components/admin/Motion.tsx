"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

// A row of choices with a filled pill that slides to whichever one is pressed.
export function Tabs({ label, className, cols, children }: { label: string; className?: string; cols?: number; children: React.ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [ready, setReady] = useState(false);
  const place = () => {
    const el = row.current?.querySelector<HTMLElement>(':scope > [aria-pressed="true"]');
    const next = el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null;
    setPill((was) => (was && next && was.x === next.x && was.y === next.y && was.w === next.w && was.h === next.h ? was : !was && !next ? was : next));
  };
  // After every render, because which button is pressed is decided by whoever drew the children.
  useIso(place);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const f = window.requestAnimationFrame(() => setReady(true));
    const seen = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    seen?.observe(el);
    return () => {
      window.cancelAnimationFrame(f);
      seen?.disconnect();
    };
  }, []);
  return (
    <div className={`tabs${className ? ` ${className}` : ""}`} ref={row} role="group" aria-label={label} data-ready={ready} data-cols={cols ? true : undefined} style={cols ? { ["--cols" as string]: cols } : undefined}>
      <span className="tabs-pill" data-on={!!pill} style={pill ? { transform: `translate(${pill.x}px, ${pill.y}px)`, width: pill.w, height: pill.h } : undefined} aria-hidden="true" />
      {children}
    </div>
  );
}

// Something that comes and goes: it grows open and fades in, and folds away again before it is taken off the page.
export function Reveal({ show, pop, children }: { show: boolean; pop?: boolean; children: () => React.ReactNode }) {
  const [mounted, setMounted] = useState(show);
  const [open, setOpen] = useState(show);
  const [settled, setSettled] = useState(show);
  const kept = useRef<React.ReactNode>(null);
  const box = useRef<HTMLDivElement>(null);
  // While folded it should take no room at all, so it also swallows the gap its parent leaves between children.
  useIso(() => {
    const el = box.current, up = el?.parentElement;
    if (!el || !up || pop) return;
    const gap = parseFloat(getComputedStyle(up).rowGap) || 0;
    el.style.setProperty("--fold-gap", `${gap}px`);
  }, [mounted, pop]);
  if (show) kept.current = children();
  useEffect(() => {
    if (show) {
      setMounted(true);
      const f = window.requestAnimationFrame(() => window.requestAnimationFrame(() => setOpen(true)));
      const t = window.setTimeout(() => setSettled(true), 520);
      return () => {
        window.cancelAnimationFrame(f);
        window.clearTimeout(t);
      };
    }
    setSettled(false);
    const f = window.requestAnimationFrame(() => setOpen(false));
    const t = window.setTimeout(() => setMounted(false), 460);
    return () => {
      window.cancelAnimationFrame(f);
      window.clearTimeout(t);
    };
  }, [show]);
  if (!mounted && !show) return null;
  return (
    <div ref={box} className={pop ? "reveal reveal-pop" : "reveal"} data-open={open} data-settled={settled && open} aria-hidden={!show || undefined}>
      <div className="reveal-in">{kept.current}</div>
    </div>
  );
}

// A list whose items glide to their new places when the order changes, and pop in when they are new.
export function useFlip<T extends HTMLElement>(enter = true) {
  const ref = useRef<T>(null);
  const was = useRef(new WeakMap<Element, { x: number; y: number }>());
  const first = useRef(true);
  useIso(() => {
    const el = ref.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new WeakMap<Element, { x: number; y: number }>();
    for (const child of Array.from(el.children) as HTMLElement[]) {
      // Where it sits in the list, leaving out any movement still being played.
      const at = { x: child.offsetLeft, y: child.offsetTop };
      next.set(child, at);
      if (still || first.current || typeof child.animate !== "function") continue;
      const old = was.current.get(child);
      if (old) {
        const dx = old.x - at.x, dy = old.y - at.y;
        if (dx || dy) child.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
      } else if (enter) child.animate([{ opacity: 0, transform: "scale(0.86)" }, { opacity: 1, transform: "none" }], { duration: 340, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
    }
    was.current = next;
    first.current = false;
  });
  return ref;
}

// The same thing at a new size: when what is inside changes height, the box eases to it instead of jumping.
export function Grow({ children, className }: { children: React.ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const last = useRef(0);
  useIso(() => {
    const el = box.current;
    if (!el) return;
    const h = el.offsetHeight;
    if (last.current && Math.abs(h - last.current) > 2 && typeof el.animate === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.animate([{ height: `${last.current}px` }, { height: `${h}px` }], { duration: 380, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }).onfinish = () => (el.style.overflow = "");
      el.style.overflow = "hidden";
    }
    last.current = h;
  });
  return (
    <div ref={box} className={className}>
      {children}
    </div>
  );
}

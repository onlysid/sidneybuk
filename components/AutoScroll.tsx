"use client";

import { useEffect, useRef } from "react";

// A row too wide for the page that drifts along by itself, to the end and back, with its edges faded out.
export function AutoScroll({ children, className, label }: { children: React.ReactNode; className?: string; label?: string }) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const edges = () => {
      const more = el.scrollWidth - el.clientWidth;
      el.dataset.left = String(el.scrollLeft > 4);
      el.dataset.right = String(el.scrollLeft < more - 4);
    };
    edges();
    el.addEventListener("scroll", edges, { passive: true });
    const sized = new ResizeObserver(edges);
    sized.observe(el);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => (el.removeEventListener("scroll", edges), sized.disconnect());

    let frame = 0, dir = 1, held = false, resumeAt = 0, at = el.scrollLeft, last = 0, seen = true;
    const step = (now: number) => {
      frame = requestAnimationFrame(step);
      const dt = Math.min(50, now - (last || now));
      last = now;
      const more = el.scrollWidth - el.clientWidth;
      if (held || now < resumeAt || more < 8 || !seen || document.hidden) return void (at = el.scrollLeft);
      at += dir * dt * 0.028; // about 28 pixels a second
      if (at >= more) (at = more), (dir = -1), (resumeAt = now + 1400);
      if (at <= 0) (at = 0), (dir = 1), (resumeAt = now + 1400);
      el.scrollLeft = at;
    };
    const hold = () => (held = true);
    const let_go = () => ((held = false), (resumeAt = performance.now() + 2200));
    const nudge = () => (resumeAt = performance.now() + 2600);
    el.addEventListener("pointerenter", hold);
    el.addEventListener("pointerleave", let_go);
    el.addEventListener("touchstart", hold, { passive: true });
    el.addEventListener("touchend", let_go);
    el.addEventListener("wheel", nudge, { passive: true });
    const watch = new IntersectionObserver(([e]) => (seen = e.isIntersecting));
    watch.observe(el);
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      watch.disconnect();
      sized.disconnect();
      el.removeEventListener("scroll", edges);
      el.removeEventListener("pointerenter", hold);
      el.removeEventListener("pointerleave", let_go);
      el.removeEventListener("touchstart", hold);
      el.removeEventListener("touchend", let_go);
      el.removeEventListener("wheel", nudge);
    };
  }, []);
  return (
    <div ref={row} className={`autoscroll${className ? ` ${className}` : ""}`} aria-label={label}>
      {children}
    </div>
  );
}

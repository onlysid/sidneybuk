"use client";

import { useEffect, useRef } from "react";

// The page's scrollbar, drawn over the page rather than beside it, so it never takes any width: nothing shifts
// when a modal locks scrolling or a page is short. It shows while scrolling or when the pointer is near the edge,
// and can be dragged or clicked like the real one. The native one is hidden in globals.css.
export function Scrollbar() {
  const track = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = track.current, h = thumb.current;
    if (!t || !h || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const PAD = 4;
    let hide = 0, drag: { y: number; top: number } | null = null, geo = { max: 0, run: 0, size: 0 };
    const place = () => {
      const root = document.documentElement;
      const max = root.scrollHeight - innerHeight;
      if (max <= 1) {
        t.dataset.on = "false";
        return;
      }
      const room = innerHeight - PAD * 2;
      const size = Math.max(40, Math.round((innerHeight / root.scrollHeight) * room));
      const run = room - size;
      geo = { max, run, size };
      h.style.height = `${size}px`;
      h.style.transform = `translateY(${PAD + (scrollY / max) * run}px)`;
      t.dataset.on = "true";
    };
    const show = () => {
      t.dataset.show = "true";
      window.clearTimeout(hide);
      hide = window.setTimeout(() => {
        if (!drag && !t.matches(":hover")) t.dataset.show = "false";
      }, 900);
    };
    const onScroll = () => {
      place();
      show();
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      if (e.target === h) drag = { y: e.clientY, top: scrollY };
      else {
        // A click on the track jumps so the thumb centres on the pointer, then dragging goes on from there.
        const to = ((e.clientY - PAD - geo.size / 2) / geo.run) * geo.max;
        window.scrollTo({ top: Math.max(0, Math.min(geo.max, to)), behavior: "instant" });
        drag = { y: e.clientY, top: scrollY };
      }
      t.dataset.drag = "true";
      t.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      window.scrollTo({ top: drag.top + ((e.clientY - drag.y) / geo.run) * geo.max, behavior: "instant" });
    };
    const up = () => {
      drag = null;
      t.dataset.drag = "false";
      show();
    };
    const grew = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    grew?.observe(document.body);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", place);
    t.addEventListener("pointerdown", down);
    t.addEventListener("pointermove", move);
    t.addEventListener("pointerup", up);
    t.addEventListener("pointercancel", up);
    place();
    return () => {
      grew?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", place);
      t.removeEventListener("pointerdown", down);
      t.removeEventListener("pointermove", move);
      t.removeEventListener("pointerup", up);
      t.removeEventListener("pointercancel", up);
      window.clearTimeout(hide);
    };
  }, []);
  return (
    <div className="scroller" ref={track} data-nowrap aria-hidden="true">
      <div className="scroller-thumb" ref={thumb} />
    </div>
  );
}

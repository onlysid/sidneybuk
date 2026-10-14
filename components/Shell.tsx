"use client";

import { Scrollbar } from "@/components/Scrollbar";
import { ServiceWorker } from "./Install";
import { KeepFresh } from "./KeepFresh";
import { Rest } from "./Rest";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Dock } from "./Dock";
import { NowBar } from "./NowBar";
import { SoundFrame } from "./SoundFrame";
import { TerminalProvider } from "./TerminalSheet";
import { TransitionProvider } from "./Transition";

const PRESSABLE = "a, button, input, textarea, select, summary, [role='button'], [data-wrap]";

// Page chrome shared by every route: drifting colour behind the glass, the menu, the bar at the bottom, the cursor.
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const page = pathname.replace(/^\/|\/$/g, "") || "home";
  const lens = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // The cursor is a box that eases towards a target: a small circle at the pointer, or the outline of whatever pressable thing the pointer is over.
    const box = { x: -100, y: -100, w: 36, h: 36, r: 18 };
    let px = -100, py = -100, frame = 0, last = 0;
    let over: Element | null = null;
    let radius = 0;
    let scrolledAt = 0; // while the page is being scrolled the ring stays on what it has, moving with it

    const loop = (now: number) => {
      frame = 0;
      // Eased by elapsed time, not by frame count, so it settles just as fast on a slow screen.
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now;
      const el = lens.current;
      if (!el) return;
      let to = { x: px - 18, y: py - 18, w: 36, h: 36, r: 18 };
      if (over && !over.isConnected) over = null;
      if (over) {
        const b = over.getBoundingClientRect();
        // Sit close to the edge, and round the corners exactly as the thing underneath does: its own corner radius (scaled up if it has grown on hover) plus…
        const pad = 3;
        const grown = (over as HTMLElement).offsetWidth ? b.width / (over as HTMLElement).offsetWidth : 1;
        const corner = Math.min(Math.max(radius, 6) * grown, Math.min(b.width, b.height) / 2);
        to = { x: b.left - pad, y: b.top - pad, w: b.width + pad * 2, h: b.height + pad * 2, r: corner + pad };
      } else if (el.dataset.area === "true") to = { x: px - 5, y: py - 5, w: 10, h: 10, r: 5 };
      // Big things are wrapped more gently than small ones, so the ring glides out to a card rather than snapping.
      const big = over ? Math.min(1, (to.w * to.h) / 120000) : 0;
      const scrolling = now - scrolledAt < 160;
      const k = 1 - Math.exp(-dt * (over ? 20 - big * 10 : 28));
      let moving = 0;
      (Object.keys(box) as (keyof typeof box)[]).forEach((key) => {
        // Scrolling: the ring is pinned to the thing it wraps, so it moves exactly as the page does.
        const step = (to[key] - box[key]) * (scrolling && over && (key === "x" || key === "y") ? 1 : k);
        box[key] += step;
        moving += Math.abs(to[key] - box[key]);
      });
      el.style.transform = `translate3d(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px, 0)`;
      el.style.width = `${box.w.toFixed(1)}px`;
      el.style.height = `${box.h.toFixed(1)}px`;
      el.style.borderRadius = `${box.r.toFixed(1)}px`;
      // Keep following while wrapped, since the thing underneath may be moving or the page scrolling.
      if (over || moving > 0.4) frame = requestAnimationFrame(loop);
      else last = 0;
    };

    // Decide what, if anything, the cursor should wrap.
    const aim = (target: Element | null) => {
      let hit = target?.closest?.(PRESSABLE) ?? null;
      // A link that stands for the whole card it is in is wrapped as that card.
      if (hit?.hasAttribute("data-ring-up")) hit = hit.closest("[data-ringbox]") ?? hit;
      if (hit?.closest("[inert], [data-nowrap]")) hit = null;
      if (hit) {
        const b = hit.getBoundingClientRect();
        if (b.width > 1240 || b.height > 620) hit = null; // too big to wrap: stay a pointer
      }
      if (hit !== over) {
        over = hit;
        if (hit) {
          const el = hit as HTMLElement;
          const raw = getComputedStyle(hit).borderTopLeftRadius;
          radius = raw.endsWith("%") ? (Math.min(el.offsetWidth, el.offsetHeight) * parseFloat(raw)) / 100 : parseFloat(raw) || 0;
        }
      }
      if (lens.current) {
        lens.current.dataset.wrap = String(!!over);
        // Things on the page are under the menu and the bar at the bottom, so the ring round them is too.
        lens.current.dataset.top = String(!!target?.closest?.(".dock-wrap, .now, .sheet, .ask, .scroller, .dp, .sp-pick-float, .nbj-back, .sheet-back, .fp-light"));
        lens.current.dataset.area = String(!over && !!target?.closest?.("[data-lens], canvas"));
      }
    };
    // The page can change under a still pointer (scrolling, a menu closing, a new page), so look again now and then.
    const look = () => fine && !reduce && px >= 0 && performance.now() - scrolledAt > 300 && lens.current?.dataset.on === "true" && aim(document.elementFromPoint(px, py));
    // When a page is on its way out the ring lets go at once, rather than shrinking through a busy render.
    const leaving = new MutationObserver(() => {
      if (!document.documentElement.dataset.leaving || !lens.current) return;
      over = null;
      lens.current.dataset.on = "false";
      lens.current.dataset.wrap = "false";
      Object.assign(box, { x: px - 18, y: py - 18, w: 36, h: 36, r: 18 });
    });
    leaving.observe(document.documentElement, { attributes: true, attributeFilter: ["data-leaving"] });
    const watch = window.setInterval(look, 250);

    const onMove = (e: PointerEvent) => {
      // Light follows the pointer across any glass surface.
      const target = e.target as Element | null;
      const glass = target?.closest?.<HTMLElement>(".glass, .btn");
      if (glass) {
        const r = glass.getBoundingClientRect();
        glass.style.setProperty("--mx", `${e.clientX - r.left}px`);
        glass.style.setProperty("--my", `${e.clientY - r.top}px`);
      }
      if (!fine || reduce || e.pointerType !== "mouse" || !lens.current) return;
      px = e.clientX;
      py = e.clientY;
      aim(target);
      lens.current.dataset.on = "true";
      if (!frame) frame = requestAnimationFrame(loop);
    };
    const onLeave = () => {
      over = null;
      if (lens.current) lens.current.dataset.on = "false";
    };

    const onScroll = () => {
      scrolledAt = performance.now();
      if (over && !frame) frame = requestAnimationFrame(loop);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
      window.clearInterval(watch);
      leaving.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <TransitionProvider>
      <div className="bg" data-page={page} aria-hidden="true">
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
      </div>
      <div className="progress" ref={bar} aria-hidden="true" />
      <Scrollbar />
      <SoundFrame />
      <KeepFresh />
      <Rest />
      <ServiceWorker />
      <TerminalProvider>
        <Dock />
        <div className="page-shift" key={pathname}>
          {children}
        </div>
        {/* The admin area is for getting things done: no bar in the way of its Save button. */}
        {/* The notebook puts its own bar there instead: contents, where you are, search. */}
        {!pathname.startsWith("/admin") && !(pathname === "/learning" || pathname.startsWith("/learning/")) && <NowBar />}
      </TerminalProvider>
      <div className="lens" ref={lens} aria-hidden="true" />
    </TransitionProvider>
  );
}

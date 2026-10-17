"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Keeps the page from working when nobody benefits. The drifting background sits under a lot of frosted glass,
// and every frame it moves all of that glass has to be blurred again, which is what warms a laptop up.
//  - When nothing has been touched for a few seconds, the background holds still (it starts again at a touch);
//    after twenty seconds, the small decorations stop too.
//  - Anything scrolled out of sight stops animating until it is back in view.
//  - When the tab is not being looked at, everything stops.
export function Rest() {
  const pathname = usePathname();
  useEffect(() => {
    const root = document.documentElement;
    let timer = 0, long = 0;
    const wake = () => {
      if (root.dataset.rest) delete root.dataset.rest;
      window.clearTimeout(timer);
      window.clearTimeout(long);
      timer = window.setTimeout(() => (root.dataset.rest = "true"), 6000);
      // Left alone a while longer, the decorations stop as well.
      long = window.setTimeout(() => (root.dataset.rest = "deep"), 20000);
    };
    const seen = () => (document.hidden ? (root.dataset.hidden = "true") : delete root.dataset.hidden);
    wake();
    seen();
    const on = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    on.forEach((n) => window.addEventListener(n, wake, { passive: true, capture: true }));
    document.addEventListener("visibilitychange", seen);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(long);
      on.forEach((n) => window.removeEventListener(n, wake, { capture: true }));
      document.removeEventListener("visibilitychange", seen);
    };
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const watch = new IntersectionObserver(
      (list) => {
        for (const e of list) {
          const el = e.target as HTMLElement;
          if (e.isIntersecting) delete el.dataset.away;
          else el.dataset.away = "true";
        }
      },
      { rootMargin: "120px 0px" },
    );
    // The page's larger blocks: sections, cards and panels. Watched again whenever the page's content changes.
    let wait = 0;
    const look = () => {
      watch.disconnect();
      document.querySelectorAll<HTMLElement>("main section, main article, main .glass, main .card, footer").forEach((el) => watch.observe(el));
    };
    look();
    const changed = new MutationObserver(() => {
      window.clearTimeout(wait);
      wait = window.setTimeout(look, 400);
    });
    const main = document.querySelector("main")?.parentElement ?? document.body;
    changed.observe(main, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(wait);
      changed.disconnect();
      watch.disconnect();
    };
  }, [pathname]);
  return null;
}

"use client";

import { useEffect } from "react";
import { disciplines, type Slug } from "@/lib/site";
import { DisciplineArt } from "./DisciplineArt";
import { TLink, useGo } from "./Transition";

const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

// Previous and next, as two doors with the next page's artwork behind them, and a dot for every page between.
export function Pager({ slug }: { slug: Slug }) {
  const go = useGo();
  const index = disciplines.findIndex((x) => x.slug === slug);
  const prev = disciplines[(index + disciplines.length - 1) % disciplines.length];
  const next = disciplines[(index + 1) % disciplines.length];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as Element | null)?.closest?.("input, textarea, select, [contenteditable], [data-keys]")) return;
      if (e.key === "ArrowLeft") go(`/${prev.slug}`);
      if (e.key === "ArrowRight") go(`/${next.slug}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, prev.slug, next.slug]);

  return (
    <nav className="wrap pager" aria-label="More pages">
      {[prev, next].map((item, n) => (
        <TLink key={n} href={`/${item.slug}`} className={`door glass ${n ? "end" : ""}`}>
          <span className="door-art" aria-hidden="true">
            <DisciplineArt kind={item.slug} />
          </span>
          <span className="door-arrow" aria-hidden="true">
            <Arrow />
          </span>
          <span className="door-text">
            <span className="mono">{n ? "Next" : "Previous"}</span>
            <b>{item.title}</b>
          </span>
        </TLink>
      ))}
      <div className="pager-dots">
        {disciplines.map((d) => (
          <TLink key={d.slug} href={`/${d.slug}`} aria-label={d.title} aria-current={d.slug === slug ? "page" : undefined} title={d.title}>
            <i />
          </TLink>
        ))}
      </div>
    </nav>
  );
}

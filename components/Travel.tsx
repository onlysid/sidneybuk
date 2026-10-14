"use client";

import { useContent } from "@/components/Content";
import { useMemo, useState } from "react";
import { entryDate, searchPlaces } from "@/lib/travel";
import { Picture } from "./Film";
import { Tilt } from "./Tilt";
import { TLink } from "./Transition";

// The places in the log as cards, with a search box over them.
export function PlaceWall() {
  const { places } = useContent();
  const [query, setQuery] = useState("");
  const found = useMemo(() => searchPlaces(places, query), [places, query]);
  return (
    <div className="tr-wall">
      <label className="bk-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.500" />
          <path d="M16 16l4.500 4.500" />
        </svg>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search places, countries, years, or anything I wrote" aria-label="Search the travel log" />
      </label>
      {query && (
        <p className="mono bk-count" aria-live="polite">
          {found.length} of {places.length} places match “{query}”
        </p>
      )}
      {found.length === 0 ? (
        <p className="mu-empty glass">Nowhere in the log matches that. Yet.</p>
      ) : (
        <div className="fp-grid">
          {found.map((p) => {
            const latest = [...p.entries].sort((a, b) => b.date.localeCompare(a.date))[0];
            return (
              <Tilt key={p.slug} className="fp-tilt" max={5}>
                <TLink href={`/travel/${p.slug}`} className="fp-card glass">
                  <span className="fp-cover">
                    <Picture frame={p.cover} alt={p.name} />
                    <span className="fp-kind mono">{p.kind}</span>
                  </span>
                  <span className="fp-text">
                    <b>{p.name}</b>
                    <span className="mono">
                      {p.country} · {p.entries.length} {p.entries.length === 1 ? "entry" : "entries"}
                    </span>
                    <span className="tr-tag">{p.tagline}</span>
                    <span className="tr-blurb">{p.blurb}</span>
                    {latest && (
                      <span className="tr-latest">
                        <i className="mono">Latest</i> {latest.title}, {entryDate(latest.date)}
                      </span>
                    )}
                  </span>
                </TLink>
              </Tilt>
            );
          })}
        </div>
      )}
    </div>
  );
}

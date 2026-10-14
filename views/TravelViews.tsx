"use client";

import { useContent } from "@/components/Content";
import { Gallery, Picture } from "@/components/Film";
import { Footer } from "@/components/Footer";
import { TLink } from "@/components/Transition";
import { PlaceWall } from "@/components/Travel";
import { Travel } from "@/components/toys/Travel";
import { entryDate, type Place } from "@/lib/travel";

const d = (ms: number) => ({ ["--delay" as string]: `${ms}ms` }) as React.CSSProperties;
const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
// Distance over the Earth's surface, in kilometres.
function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)));
}

// What sits on /travel under the heading: the globe, the log, and the list of places still to go.
export function TravelHome() {
  const { places, wishlist } = useContent();
  const entries = places.reduce((a, p) => a + p.entries.length, 0);
  const countries = new Set(places.map((p) => p.country)).size;
  return (
    <>
      <section className="wrap section" id="globe" style={{ scrollMarginTop: 90 }}>
        <div className="section-head">
          <h2>The globe</h2>
          <span className="mono">Drag to turn, pinch or use the buttons to zoom, tap a pin</span>
        </div>
        <div className="toy glass">
          <Travel />
        </div>
      </section>
      <section className="wrap section">
        <div className="section-head">
          <h2>The log</h2>
          <span className="mono">
            {places.length} places · {countries} countries · {entries} entries
          </span>
        </div>
        <PlaceWall />
      </section>
      <section className="wrap section">
        <div className="section-head">
          <h2>Where I would like to go</h2>
          <span className="mono">The list, in no order</span>
        </div>
        <ul className="tr-wishes">
          {wishlist.map((w) => (
            <li key={w.name} className="glass">
              <span className="tr-wish-pin" aria-hidden="true" />
              <span>
                <b>{w.name}</b>
                <small className="mono">{w.country}</small>
              </span>
              <p>{w.why}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

// /travel/<slug>: one place, and every entry I have written about it, newest first.
export function PlaceView({ place }: { place: Place }) {
  const { places } = useContent();
  const entries = [...place.entries].sort((a, b) => b.date.localeCompare(a.date));
  const index = places.findIndex((x) => x.slug === place.slug);
  const next = places[(index + 1) % places.length];
  const home = places.find((p) => p.kind === "Home" && p.slug !== place.slug) ?? places[0];
  const facts: [string, string | undefined][] = [
    ["Country", place.country],
    ["To me", place.kind],
    ["When", place.when],
    ["Entries", String(entries.length)],
    [`From ${home.name}`, place.slug === home.slug ? undefined : `${km(home, place).toLocaleString("en-GB")} km`],
    ["On the map", `${Math.abs(place.lat).toFixed(2)}° ${place.lat >= 0 ? "N" : "S"}, ${Math.abs(place.lon).toFixed(2)}° ${place.lon >= 0 ? "E" : "W"}`],
  ];
  return (
    <main className="page" data-kind="travel">
      <article className="wrap work">
        <p className="mono rise">
          <TLink href="/">Home</TLink> / <TLink href="/travel">Travel</TLink> / {place.name}
        </p>
        <h1 className="rise" style={d(80)}>
          <span className="name">{place.name}</span>
        </h1>
        <p className="lede rise" style={d(150)}>
          {place.tagline}
        </p>
        <div className="work-actions rise" style={d(210)}>
          <span className="rep-stage" data-stage={place.kind === "Visited" ? "Learning" : "Home"}>
            {place.kind}
          </span>
          <span className="post-tag">{place.country}</span>
          {place.when && <span className="post-tag">{place.when}</span>}
        </div>
        <div className="fp-hero glass rise" style={d(280)}>
          <Picture frame={place.cover} alt={place.name} />
        </div>
        <div className="work-cols rise" style={d(340)}>
          <div className="work-body">
            <p className="tr-lead">{place.blurb}</p>
            {place.about.map((para, n) => (
              <p key={n}>{para}</p>
            ))}
          </div>
          <dl className="work-facts glass">
            {facts.map(
              ([label, value]) =>
                value && (
                  <div key={label}>
                    <dt className="mono">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ),
            )}
          </dl>
        </div>

        <section className="mu-block">
          <div className="section-head">
            <h2>The log</h2>
            <span className="mono">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}, newest first
            </span>
          </div>
          <ol className="tr-entries">
            {entries.map((entry) => (
              <li key={entry.slug} id={entry.slug} className="tr-entry">
                <span className="tr-entry-date mono">{entryDate(entry.date)}</span>
                <div className="tr-entry-main glass">
                  <header>
                    <h3>{entry.title}</h3>
                    {entry.sample && <span className="post-tag sample">sample entry</span>}
                  </header>
                  <p className="tr-entry-sum">{entry.summary}</p>
                  {entry.body.map((block, n) => (block.startsWith("## ") ? <h4 key={n}>{block.slice(3)}</h4> : <p key={n}>{block}</p>))}
                  {entry.frames.length > 0 && <Gallery frames={entry.frames} />}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {next.slug !== place.slug && (
          <TLink href={`/travel/${next.slug}`} className="door glass end work-next">
            <span className="door-art" aria-hidden="true">
              <Picture frame={next.cover} />
            </span>
            <span className="door-arrow" aria-hidden="true">
              <Arrow />
            </span>
            <span className="door-text">
              <span className="mono">Next place</span>
              <b>{next.name}</b>
            </span>
          </TLink>
        )}
      </article>
      <Footer />
    </main>
  );
}

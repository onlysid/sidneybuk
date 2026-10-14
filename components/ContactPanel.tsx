"use client";

import { useSite } from "@/components/Content";
import { useEffect, useState } from "react";
import { site } from "@/lib/site";
import { CopyEmail } from "./CopyEmail";

const d = (ms: number) => ({ ["--delay" as string]: `${ms}ms` }) as React.CSSProperties;

// What I am probably doing, from the time where I am. Edit the lines to taste.
const MOODS: { from: number; state: "asleep" | "waking" | "awake" | "winding"; title: string; line: string }[] = [
  { from: 0, state: "asleep", title: "Fast asleep", line: "Write anyway. It will be the first thing I read." },
  { from: 7, state: "waking", title: "On the first coffee", line: "Awake, technically. Replies may be short." },
  { from: 9, state: "awake", title: "At the desk", line: "A good time to write. I will probably see it soon." },
  { from: 13, state: "awake", title: "Somewhere after lunch", line: "Working, or out for a run. Either way, around." },
  { from: 18, state: "winding", title: "Done for the day", line: "Probably at the piano or on a padel court. Still reading messages." },
  { from: 23, state: "asleep", title: "Fast asleep", line: "Write anyway. It will be the first thing I read." },
];

// What to say instead while I am away.
const AWAY_LINES = {
  asleep: "Asleep. It will be read, but probably not until I am back.",
  waking: "Up, but away. Write anyway and I will answer when I am back.",
  awake: "Out and about, and away from the desk. Replies wait until I am back.",
  winding: "Winding down somewhere that is not home. Replies wait until I am back.",
} as const;

// A small sky that shows the time where I am: the sun crosses by day, the moon by night, and a face underneath is awake, yawning or asleep to match.
function Awake() {
  const site = useSite();
  const place = site.location;
  const [now, setNow] = useState<{ time: string; hours: number } | null>(null);
  useEffect(() => {
    if (!place) return;
    const tick = () => {
      const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: place.timeZone }).format(new Date());
      setNow({ time, hours: Number(time.slice(0, 2)) + Number(time.slice(3)) / 60 });
    };
    tick();
    const t = window.setInterval(tick, 20000);
    return () => window.clearInterval(t);
  }, [place]);
  if (!place || !now) return null;
  // Away, the usual lines about being at the desk would be wrong: the time is still true, the promise is not.
  const away = !!place.away && (!place.until || new Date(place.until).getTime() > Date.now());
  const mood = [...MOODS].reverse().find((m) => now.hours >= m.from) ?? MOODS[0];
  const day = now.hours >= 6 && now.hours < 20;
  // How far the sun (06:00 to 20:00) or the moon (20:00 to 06:00) is across the sky, 0 to 1.
  const across = day ? (now.hours - 6) / 14 : ((now.hours + 4) % 24) / 10;
  const x = 14 + across * 172;
  const y = 50 - Math.sin(across * Math.PI) * 36;
  return (
    <div className="awake" data-state={mood.state} data-day={day}>
      <svg viewBox="0 0 200 64" className="awake-sky" role="img" aria-label={`It is ${now.time} in ${place.name}`}>
        {[
          [30, 14], [62, 26], [96, 10], [128, 22], [160, 12], [182, 30], [46, 36],
        ].map(([sx, sy], n) => (
          <circle key={n} className="awake-star" cx={sx} cy={sy} r={n % 3 ? 0.9 : 1.4} style={{ ["--i" as string]: n }} />
        ))}
        <path className="awake-arc" d="M14 50A86 36 0 0 1 186 50" />
        <path className="awake-ground" d="M0 51h200" />
        <g className="awake-body" style={{ transform: `translate(${x}px, ${y}px)` }}>
          {day ? (
            <>
              <circle className="awake-halo" r="11" />
              <circle className="awake-sun" r="6.500" />
            </>
          ) : (
            <path className="awake-moon" d="M3 -7a7.500 7.500 0 1 0 5 12.500A6.500 6.500 0 0 1 3 -7z" />
          )}
        </g>
      </svg>
      <div className="awake-row">
        <span className="awake-face" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.200" strokeLinecap="round" strokeLinejoin="round">
            {mood.state === "asleep" ? (
              <>
                <path d="M8 15.500c1.300 1.300 3.200 1.300 4.500 0M19.500 15.500c1.300 1.300 3.200 1.300 4.500 0" />
                <ellipse className="awake-snore" cx="16" cy="22.500" rx="1.800" ry="1.600" />
              </>
            ) : mood.state === "waking" ? (
              <>
                <path d="M8.500 14h4M19.500 14h4" />
                <ellipse className="awake-yawn" cx="16" cy="22" rx="2.600" ry="3" />
              </>
            ) : (
              <>
                <g className="awake-eyes">
                  <path d="M10.500 12.500v2.500M21.500 12.500v2.500" />
                </g>
                <path d="M10 20c1.800 2.200 3.800 3 6 3s4.200-.800 6-3" />
              </>
            )}
          </svg>
          {mood.state === "asleep" && (
            <span className="awake-zs">
              <i>z</i>
              <i>z</i>
              <i>z</i>
            </span>
          )}
          {mood.state === "waking" && <span className="awake-steam" />}
        </span>
        <span className="awake-text">
          <b key={mood.title}>{mood.title}</b>
          <small>
            It is {now.time} where I am. {away ? AWAY_LINES[mood.state] : mood.line}
          </small>
        </span>
      </div>
    </div>
  );
}

// When I have said I am away: a line saying so, with my own message, above everything else on the card.
function AwayNote() {
  const site = useSite();
  const place = site.location;
  const [now, setNow] = useState(0);
  useEffect(() => setNow(Date.now()), []);
  if (!place?.away || !now || (place.until && new Date(place.until).getTime() <= now)) return null;
  return (
    <div className="away-note" role="status">
      <span className="away-badge mono">
        <i aria-hidden="true" />
        Away
      </span>
      <p>
        <b>{place.message || "I am away at the moment."}</b>
        <small>
          {place.until ? `Back ${new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: place.timeZone }).format(new Date(place.until))}. ` : ""}
          Do write: I will read it, and reply properly then.
        </small>
      </p>
    </div>
  );
}

// The two cards on the contact page.
export function ContactPanel() {
  const site = useSite();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const href = `mailto:${site.email}?subject=${encodeURIComponent(name ? `Hello from ${name}` : "Hello")}&body=${encodeURIComponent(message)}`;

  return (
    <section className="wrap contact-grid">
      <div className="contact-card glass rise" style={d(260)}>
        <h2>Email</h2>
        <AwayNote />
        <CopyEmail email={site.email} />
        <Awake />
        <div className="links">
          <a className="btn btn-glass glass" href={`https://github.com/${site.integrations.github}`} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a className="btn btn-glass glass" href={site.resumeUrl} target="_blank" rel="noreferrer">
            Résumé
          </a>
        </div>
      </div>

      <div className="contact-card glass rise" style={d(330)}>
        <h2>Write a note</h2>
        {/* There is no server here, so the form writes the email and hands it to the visitor's own mail app. */}
        <form className="form" onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <label htmlFor="contact-name" className="mono">
              Your name
            </label>
            <input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Ada Lovelace" />
          </div>
          <div className="field">
            <label htmlFor="contact-message" className="mono">
              Message
            </label>
            <textarea id="contact-message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Say hello, ask a question, or tell me what you are building…" />
          </div>
          <a className="btn btn-primary" href={href} data-empty={!message.trim()}>
            Open in your email app
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
        </form>
      </div>
    </section>
  );
}

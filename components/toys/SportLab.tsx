"use client";

import { Pill } from "@/components/Pill";
import { useEffect, useRef, useState } from "react";

const ROUNDS = 5;
type Phase = "idle" | "wait" | "go" | "early" | "done";

// Tap when the panel changes. Five goes, then an average.
export function Reaction() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [times, setTimes] = useState<number[]>([]);
  const [best, setBest] = useState(0);
  const timer = useRef(0);
  const began = useRef(0);

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem("reaction-best")) || 0);
    } catch {
      // No storage: the best time just lasts for this visit.
    }
    return () => window.clearTimeout(timer.current);
  }, []);

  const arm = () => {
    setPhase("wait");
    timer.current = window.setTimeout(() => {
      began.current = performance.now();
      setPhase("go");
    }, 1200 + Math.random() * 2600);
  };
  const press = () => {
    if (phase === "idle" || phase === "done") {
      setTimes([]);
      arm();
    } else if (phase === "wait") {
      window.clearTimeout(timer.current);
      setPhase("early");
    } else if (phase === "early") arm();
    else if (phase === "go") {
      const ms = Math.round(performance.now() - began.current);
      const next = [...times, ms];
      setTimes(next);
      if (next.length < ROUNDS) return arm();
      const mean = Math.round(next.reduce((a, b) => a + b, 0) / next.length);
      if (!best || mean < best) {
        setBest(mean);
        try {
          localStorage.setItem("reaction-best", String(mean));
        } catch {
          // Fine without storage.
        }
      }
      setPhase("done");
    }
  };
  const mean = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  const text = { idle: "Tap to start", wait: "Wait for it…", go: "Now!", early: "Too soon. Tap to try again.", done: `${mean} ms on average` }[phase];

  return (
    <div className="lab-card">
      <h3>Reaction time</h3>
      <p>Tap the panel the moment it lights up. Five goes. Most people land between 200 and 300 ms.</p>
      <button type="button" className="react-pad" data-phase={phase} onPointerDown={press} onKeyDown={(e) => (e.key === " " || e.key === "Enter") && press()}>
        <b key={phase + times.length}>{text}</b>
        {phase === "done" && <span>Tap to go again{best ? ` · your best ${best} ms` : ""}</span>}
      </button>
      <div className="react-times mono" aria-live="polite">
        {Array.from({ length: ROUNDS }, (_, n) => (
          <span key={n} data-set={times[n] !== undefined}>
            {times[n] ?? "·"}
          </span>
        ))}
      </div>
    </div>
  );
}

const DISTANCES = [
  { name: "1 mile", km: 1.609344 },
  { name: "5K", km: 5 },
  { name: "10K", km: 10 },
  { name: "Half", km: 21.0975 },
  { name: "Marathon", km: 42.195 },
];
const clock = (seconds: number) => {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
};

// A finishing time in, pace and predicted times at other distances out.
export function Pace() {
  const [dist, setDist] = useState(1);
  const [mins, setMins] = useState(25);
  const [secs, setSecs] = useState(0);
  const total = Math.max(1, mins * 60 + secs);
  const km = DISTANCES[dist].km;
  // Choosing another distance keeps the pace: the time changes to what that pace gives over the new distance.
  const pick = (n: number) => {
    const t = Math.round((total * DISTANCES[n].km) / km);
    setMins(Math.min(600, Math.floor(t / 60)));
    setSecs(t % 60);
    setDist(n);
  };
  const perKm = total / km;
  const lap = Math.max(1.2, Math.min(12, perKm / 50)); // seconds for the dot to lap the track

  return (
    <div className="lab-card">
      <h3>Pace</h3>
      <p>Put in a time for one distance. It works out the pace and what that fitness predicts elsewhere. Choose another distance and the time follows, at the same pace.</p>
      <div className="seg" role="group" aria-label="Distance">
          <Pill />
        {DISTANCES.map((d, n) => (
          <button key={d.name} type="button" aria-pressed={dist === n} onClick={() => pick(n)}>
            {d.name}
          </button>
        ))}
      </div>
      <div className="pace-row">
        <label className="pace-field">
          <span className="mono">Minutes</span>
          <input type="number" inputMode="numeric" min={0} max={600} value={mins} onChange={(e) => setMins(Math.max(0, Math.min(600, Number(e.target.value) || 0)))} />
        </label>
        <label className="pace-field">
          <span className="mono">Seconds</span>
          <input type="number" inputMode="numeric" min={0} max={59} value={secs} onChange={(e) => setSecs(Math.max(0, Math.min(59, Number(e.target.value) || 0)))} />
        </label>
        <svg viewBox="0 0 120 70" className="track" aria-hidden="true">
          <rect x="6" y="6" width="108" height="58" rx="29" />
          <circle r="5">
            <animateMotion key={lap.toFixed(1)} dur={`${lap.toFixed(1)}s`} repeatCount="indefinite" path="M35 6H85A29 29 0 0 1 85 64H35A29 29 0 0 1 35 6Z" />
          </circle>
        </svg>
      </div>
      <div className="pace-out">
        <div>
          <b>{clock(perKm)}</b>
          <span className="mono">per km</span>
        </div>
        <div>
          <b>{clock(perKm * 1.609344)}</b>
          <span className="mono">per mile</span>
        </div>
        <div>
          <b>{(3600 / perKm).toFixed(1)}</b>
          <span className="mono">km/h</span>
        </div>
      </div>
      <div className="hbars">
        {DISTANCES.map((d, n) => {
          const t = total * (d.km / km) ** 1.06;
          return (
            <div key={d.name} className="hbar" data-on={n === dist}>
              <span>{d.name}</span>
              <div>
                <b key={`${dist}-${total}`} style={{ width: `${Math.max(4, (Math.log(d.km) / Math.log(42.195)) * 100)}%` }} />
              </div>
              <em>{clock(t)}</em>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SportLab() {
  return (
    <div className="lab-grid sims">
      <Reaction />
      <Pace />
    </div>
  );
}

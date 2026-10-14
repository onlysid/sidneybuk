"use client";

import { TLink as Link } from "@/components/Transition";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useOpenTerminal } from "@/components/TerminalSheet";
import { disciplines } from "@/lib/site";

// The pages shown when something is not there (404), not for the visitor (403) or broke (500).
// Each has its own small picture to play with, and the 404 guesses which page was meant.

const PAGES = [
  "/", "/blog", "/changelog", "/contact", "/privacy", "/music/fun", "/film/fun",
  "/sport/activities", "/sport/cycling", "/sport/gym", "/sport/log", "/sport/padel", "/sport/tools",
  ...disciplines.map((d) => `/${d.slug}`),
];

// How many single-letter edits turn one word into another.
function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// The pages whose addresses look most like the one asked for: a typo, a missing letter, an old name.
function nearest(path: string) {
  const want = path.toLowerCase().replace(/\/+$/, "") || "/";
  const parts = want.split("/").filter(Boolean);
  return PAGES.map((p) => {
    const bits = p.split("/").filter(Boolean);
    let score = distance(want, p) / Math.max(want.length, p.length);
    // Sharing a first section, or containing a whole section name, counts for a lot.
    if (bits[0] && parts[0] === bits[0]) score -= 0.35;
    if (bits.some((b) => parts.includes(b))) score -= 0.25;
    return { p, score };
  })
    .filter((x) => x.p !== "/" && x.score < 0.55)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((x) => x.p);
}

const SAID = {
  404: ["I looked under the sofa.", "The globe has no pin here.", "This bar of the score is empty.", "Even the terminal has not heard of it.", "Not in the notebook, not on the shelves.", "The map runs out before this point."],
  403: ["That door only opens from the inside.", "This part is mine alone.", "Some pages are just for me and my phone.", "Nothing personal. Well, strictly, it is."],
  500: ["Something fell over on the way to the page.", "The page tripped while being drawn.", "A wire came loose behind the wall."],
};

export function Lost({ code, error, reset }: { code: 403 | 404 | 500; error?: string; reset?: () => void }) {
  const path = usePathname() || "/";
  const openTerminal = useOpenTerminal();
  const [said, setSaid] = useState("");
  const maybe = useMemo(() => (code === 404 ? nearest(path) : []), [code, path]);
  const title = code === 404 ? "No such page." : code === 403 ? "Not this one." : "That broke.";
  const shown = path.length > 48 ? `${path.slice(0, 46)}…` : path;
  // The address types itself out, then the verdict lands and the rest of the page follows.
  const [typed, setTyped] = useState(0);
  useEffect(() => {
    const lines = SAID[code];
    setSaid(lines[Math.floor(Math.random() * lines.length)]);
    document.title = `${title.replace(/\.$/, "")} · Sidney Brown`;
    document.documentElement.dataset.lost = String(code);
    return () => {
      delete document.documentElement.dataset.lost;
    };
  }, [code, title]);
  useEffect(() => {
    setTyped(0);
    const all = `open ${shown}`.length;
    let n = 0;
    const t = window.setInterval(() => {
      n += 1;
      setTyped(n);
      if (n >= all + 1) window.clearInterval(t);
    }, 38);
    return () => window.clearInterval(t);
  }, [shown]);
  const line = `open ${shown}`;
  const done = typed > line.length;
  return (
    <main className="page">
      <section className="wrap section lost" data-code={code} data-done={done}>
        <div className="lost-art glass">{code === 404 ? <Wander /> : code === 403 ? <Lock /> : <Pulse />}</div>
        <div className="lost-text">
          <p className="lost-line mono" aria-label={`Error ${code}: ${line}`}>
            <span className="lost-prompt">&gt;</span> {line.slice(0, typed)}
            <span className="lost-caret" data-on={!done} />
            <br />
            <span className="lost-verdict" data-on={done}>
              <span className="lost-code">{code}</span> {code === 404 ? "no such page" : code === 403 ? "not allowed" : "could not be drawn"}
            </span>
          </p>
          <h1 className="lost-title" aria-label={title}>
            {title.split(" ").map((word, w, words) => (
              <span key={w} className="lost-word" aria-hidden="true">
                {word.split("").map((ch, i) => (
                  <span key={i} className="lost-letter" style={{ ["--i" as string]: words.slice(0, w).join(" ").length + i }}>
                    {ch}
                  </span>
                ))}
              </span>
            ))}
          </h1>
          <p className="lost-said">{said || " "}</p>
          {error && <pre className="oops-what">{error}</pre>}
          {maybe.length > 0 && (
            <div className="lost-maybe">
              <span className="mono">Did you mean</span>
              <div className="sp-chips">
                {maybe.map((p) => (
                  <Link key={p} href={p} className="sp-chip">
                    {p}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div className="lost-row">
            {code === 500 && reset && (
              <button type="button" className="btn btn-primary" onClick={reset}>
                Try again
              </button>
            )}
            {code === 403 ? (
              <Link href="/admin" className="btn btn-primary">
                Sign in
              </Link>
            ) : (
              <Link href="/" className={`btn ${code === 500 ? "btn-ghost" : "btn-primary"}`}>
                Go home
              </Link>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => (history.length > 1 ? history.back() : location.assign("/"))}>
              Go back
            </button>
            <button type="button" className="btn btn-ghost" onClick={openTerminal}>
              Ask the terminal
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

// 404: a walk that wanders off the map. The route is made up afresh each time, and a dot sets off along it.
function Wander() {
  const [n, setN] = useState(0);
  const d = useMemo(() => {
    void n;
    let x = 36, y = 150, out = `M${x},${y}`;
    for (let k = 0; k < 5; k++) {
      const nx = x + 44 + Math.random() * 30, ny = 50 + Math.random() * 120;
      out += ` Q${x + 22 + Math.random() * 20},${y + (Math.random() - 0.5) * 120} ${nx},${ny}`;
      x = nx;
      y = ny;
    }
    return { d: out, end: [x, y] as const };
  }, [n]);
  const line = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(600);
  const [steps, setSteps] = useState<[number, number, number][]>([]);
  useEffect(() => {
    const el = line.current;
    if (!el) return;
    const total = el.getTotalLength();
    setLen(total);
    // Footprints: a left and a right, every so often along the way, turned to face the way the path goes.
    const out: [number, number, number][] = [];
    for (let at = 14, k = 0; at < total - 10; at += 13, k++) {
      const a = el.getPointAtLength(at), b = el.getPointAtLength(at + 2);
      const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      const side = k % 2 ? 3 : -3;
      out.push([a.x + Math.cos(((ang + 90) * Math.PI) / 180) * side, a.y + Math.sin(((ang + 90) * Math.PI) / 180) * side, ang]);
    }
    setSteps(out);
  }, [d]);
  // The compass swings about, then settles pointing from the pin back towards home.
  const bearing = useMemo(() => (Math.atan2(150 - d.end[1], 36 - d.end[0]) * 180) / Math.PI + 90, [d]);
  return (
    <svg key={n} viewBox="0 0 360 220" className="lost-map" role="img" aria-label="A dotted route wandering off the edge of a map" onClick={() => setN((v) => v + 1)}>
      <defs>
        <pattern id="lost-grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M30 0H0V30" fill="none" stroke="currentColor" strokeOpacity="0.14" />
        </pattern>
      </defs>
      <rect width="360" height="220" fill="url(#lost-grid)" />
      <g className="lost-land" fill="currentColor" fillOpacity="0.07">
        <path d="M-10 170 C40 120 90 200 150 160 S230 210 300 170 S370 200 380 230 L-10 230Z" />
        <path d="M60 20 C110 0 160 40 200 24 S290 40 330 10 L370 -10 L-10 -10Z" />
      </g>
      <mask id="lost-reveal">
        <path ref={line} d={d.d} className="lost-reveal" style={{ strokeDasharray: `${len}`, strokeDashoffset: `${len}` }} />
      </mask>
      <path d={d.d} className="lost-route" mask="url(#lost-reveal)" />
      <g className="lost-steps">
        {steps.map(([x, y, a], k) => (
          <ellipse key={k} cx={x} cy={y} rx="2.6" ry="1.5" transform={`rotate(${a} ${x} ${y})`} style={{ ["--k" as string]: k, ["--n" as string]: steps.length }} />
        ))}
      </g>
      <g className="lost-fog" fill="currentColor" fillOpacity="0.035">
        <ellipse cx="90" cy="54" rx="70" ry="18" />
        <ellipse cx="250" cy="178" rx="80" ry="20" />
      </g>
      <g className="lost-compass" transform="translate(318 44)">
        <circle r="18" />
        <g className="lost-needle" style={{ ["--to" as string]: `${bearing}deg` }}>
          <path d="M0 -13 L4 0 L0 13 L-4 0Z" />
          <path d="M0 -13 L4 0 L-4 0Z" className="lost-needle-n" />
        </g>
        <text y="-22" textAnchor="middle" className="lost-tag">home</text>
      </g>
      <circle cx="36" cy="150" r="5" className="lost-home" />
      <text x="36" y="172" className="lost-tag" textAnchor="middle">home</text>
      <g className="lost-pin" style={{ transform: `translate(${d.end[0]}px, ${d.end[1]}px)` }}>
        <path d="M0 0 C-9 -12 -12 -18 -12 -24 A12 12 0 1 1 12 -24 C12 -18 9 -12 0 0Z" />
        <text y="-19" textAnchor="middle">?</text>
      </g>
      <circle r="4" className="lost-walker">
        <animateMotion dur="4s" repeatCount="indefinite" begin="0.9s" path={d.d} />
      </circle>
      <text x="350" y="208" className="lost-tag" textAnchor="end">tap to wander again</text>
    </svg>
  );
}

// 403: a padlock that keeps an eye on the pointer and will not be shaken open.
function Lock() {
  const [tries, setTries] = useState(0);
  const [eye, setEye] = useState([0, 0]);
  const box = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const r = box.current?.getBoundingClientRect();
      if (!r) return;
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * 0.62);
      const m = Math.min(1, Math.hypot(dx, dy) / 240);
      const a = Math.atan2(dy, dx);
      setEye([Math.cos(a) * 3 * m, Math.sin(a) * 3 * m]);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);
  const word = tries === 0 ? "tap to try the lock" : tries < 3 ? `still locked (${tries})` : tries < 6 ? "it is not going to budge" : tries < 9 ? "really, it is not" : "you are making it nervous";
  return (
    <svg ref={box} viewBox="0 0 360 220" className="lost-lock" role="img" aria-label="A closed padlock" data-shake={tries} data-sweat={tries >= 4} onClick={() => setTries((t) => t + 1)}>
      <g key={tries} className="lost-lock-body">
        <path className="lost-shackle" d="M138 108 V80 a42 42 0 0 1 84 0 v28" />
        <rect x="118" y="104" width="124" height="90" rx="22" className="lost-lock-case" />
        <g className="lost-face">
          <circle cx="180" cy="146" r="13" className="lost-keyhole" />
          <rect x="175" y="150" width="10" height="20" rx="4" className="lost-keyhole" />
          <circle cx={180 + eye[0]} cy={146 + eye[1]} r="5" className="lost-eye" />
          <rect x="165" y="131" width="30" height="30" className="lost-lid" />
        </g>
        <path className="lost-sweat" d="M232 118 c-5 7 -5 12 0 14 c5 -2 5 -7 0 -14z" />
      </g>
      <text x="350" y="208" className="lost-tag" textAnchor="end">{word}</text>
    </svg>
  );
}

// 500: a steady trace that stumbles.
function Pulse() {
  return (
    <svg viewBox="0 0 360 220" className="lost-pulse" role="img" aria-label="A trace that goes flat and then stumbles">
      <path className="lost-trace lost-trace-dim" d="M0 120 H360" />
      <path className="lost-trace" d="M0 120 H90 l8 -14 l8 28 l8 -24 l8 10 H150 l6 -40 l6 80 l6 -70 l6 30 H200 l10 -6 l10 12 l10 -4 H250 l4 -18 l4 36 l4 -18 H360" />
      <g className="lost-spark" transform="translate(162 120)">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <line key={a} x1="0" y1="0" x2="0" y2="-14" transform={`rotate(${a})`} />
        ))}
      </g>
    </svg>
  );
}

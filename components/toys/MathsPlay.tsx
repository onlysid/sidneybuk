"use client";

import { Pill } from "@/components/Pill";
import { useEffect, useRef, useState } from "react";
import { d2, Eq, fn, frac, hbar, i, n, o, root, row, sub, subsup, sup, useCanvas } from "./mathkit";

// A piece of maths inside a sentence, and one set out on its own line.
const m = (...parts: string[]) => `<math>${row(...parts)}</math>`;
const sq = (a: string) => sup(a, n(2));
const gapm = `<mspace width="1em"/>`;

// --------------------------------------------------------------------------------------------- Pure maths: three short proofs, one for each of the…
type Step = { say: string; show?: string | string[] }; // several strings are set on lines of their own
const root2 = root(n(2));
const dots = o("⋯");

// By contradiction: the diagonal of a unit square, swung down onto the number line. Nothing to press.
function DiagonalFigure() {
  const u = 62, x0 = 16, y0 = 96; // one unit, and where nought sits
  const r = u * Math.SQRT2;
  return (
    <svg viewBox="0 0 160 124" className="fig fig-line" role="img" aria-label="A square of side one. Its diagonal, of length root two, is swung down onto a number line and lands between one and two.">
      <line x1={x0 - 8} y1={y0} x2={x0 + 2 * u + 10} y2={y0} className="fig-axis" />
      {[0, 1, 2].map((v) => (
        <g key={v}>
          <line x1={x0 + v * u} y1={y0 - 3} x2={x0 + v * u} y2={y0 + 3} className="fig-axis" />
          <text x={x0 + v * u} y={y0 + 15} textAnchor="middle" className="fig-num">
            {v}
          </text>
        </g>
      ))}
      <rect x={x0} y={y0 - u} width={u} height={u} className="fig-shape" pathLength={1} />
      <text x={x0 + u / 2} y={y0 - u - 5} textAnchor="middle" className="fig-num">
        1
      </text>
      <text x={x0 - 7} y={y0 - u / 2 + 3} textAnchor="middle" className="fig-num">
        1
      </text>
      <line x1={x0} y1={y0} x2={x0 + u} y2={y0 - u} className="fig-key d1" pathLength={1} />
      <path d={`M ${x0 + u} ${y0 - u} A ${r} ${r} 0 0 1 ${x0 + r} ${y0}`} className="fig-arc d2" pathLength={1} />
      <circle cx={x0 + r} cy={y0} r="3.2" className="fig-dot d3" />
      <text x={x0 + r} y={y0 + 15} textAnchor="middle" className="fig-num key d3">
        √2
      </text>
      <text x={x0 + u * 0.36} y={y0 - u * 0.5} textAnchor="middle" className="fig-num key d1 late">
        √2
      </text>
    </svg>
  );
}

// By construction: pick any primes from the grid, and the proof's recipe hands back one you left out.
const isPrime = (v: number) => v > 1 && [2, 3, 5, 7].every((f) => v === f || v % f !== 0); // enough for 1 to 60
const split = (v: number) => {
  const out: number[] = [];
  for (let f = 2; f * f <= v; f++) while (v % f === 0) { out.push(f); v /= f; }
  if (v > 1) out.push(v);
  return out;
};
const tidy = (v: number) => v.toLocaleString("en-GB");
function PrimePicker() {
  const [mine, setMine] = useState([2, 3, 5]);
  const big = mine.reduce((acc, v) => acc * v, 1) + 1;
  const parts = split(big);
  const fresh = [...new Set(parts)];
  const flip = (v: number) => {
    const next = mine.includes(v) ? mine.filter((x) => x !== v) : [...mine, v].sort((x, y) => x - y);
    if (next.length && next.length <= 7) setMine(next); // seven keeps N small enough to factorise at once
  };
  return (
    <>
      <svg viewBox="0 0 200 124" className="fig fig-sieve" role="group" aria-label="The numbers one to sixty. Choose primes to put on your list.">
        {Array.from({ length: 60 }, (_, k) => {
          const v = k + 1, x = 10 + (k % 10) * 20, y = 11 + Math.floor(k / 10) * 20.4;
          if (!isPrime(v))
            return (
              <text key={v} x={x} y={y + 3.2} textAnchor="middle" className="sieve-out">
                {v}
              </text>
            );
          const on = mine.includes(v);
          return (
            <g
              key={v}
              className="sieve-prime"
              role="button"
              tabIndex={0}
              aria-pressed={on}
              aria-label={`${v}`}
              onClick={() => flip(v)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  flip(v);
                }
              }}
            >
              <circle cx={x} cy={y} r="8.6" />
              <text x={x} y={y + 3.2} textAnchor="middle">
                {v}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="fig-read" aria-live="polite">
        <p>
          <span className="mono">Your list</span>
          <span>{mine.join(" · ")}</span>
        </p>
        <p>
          <span className="mono">N</span>
          <span>
            {mine.join(" · ")} + 1 = <strong>{tidy(big)}</strong>
            {parts.length > 1 && <> = {parts.map(tidy).join(" · ")}</>}
          </span>
        </p>
        <p key={big} className="fig-found">
          <span className="mono">Not on it</span>
          <strong>{fresh.map(tidy).join(" and ")}</strong>
        </p>
      </div>
    </>
  );
}

// By induction: each odd number is an L-shaped border that turns one square into the next.
const MOST = 8;
function GnomonGrow() {
  const [size, setSize] = useState(4);
  const c = 15;
  const cells: React.ReactNode[] = [];
  for (let ring = 0; ring < size; ring++) {
    const along: [number, number][] = [];
    for (let x = 0; x <= ring; x++) along.push([x, ring]);
    for (let y = ring - 1; y >= 0; y--) along.push([ring, y]);
    along.forEach(([x, y], at) =>
      cells.push(<rect key={`${x}-${y}`} x={2 + x * c + 1} y={2 + (MOST - 1 - y) * c + 1} width={c - 2} height={c - 2} rx="3" className={`g-${ring % 2}`} style={{ animationDelay: `${at * 0.03}s` }} />),
    );
  }
  const odds = Array.from({ length: size }, (_, k) => 2 * k + 1);
  return (
    <>
      <svg viewBox="0 0 124 124" className="fig fig-gnomon" role="img" aria-label={`A ${size} by ${size} square made of L-shaped borders of ${odds.join(", ")} cells`}>
        <rect x="2" y="2" width={MOST * c} height={MOST * c} rx="5" className="g-floor" />
        {cells}
        {odds.map((v, ring) => (
          <text key={ring} x={2 + ring * c + c / 2} y={2 + (MOST - 1 - ring) * c + c / 2 + 2.6} textAnchor="middle" className={`g-num on-${ring % 2}`}>
            {v}
          </text>
        ))}
      </svg>
      <div className="fig-read" aria-live="polite">
        <p>
          <span className="mono">n = {size}</span>
          <span>
            {odds.length > 5 ? `1 + 3 + 5 + ⋯ + ${odds[odds.length - 1]}` : odds.join(" + ")} = <strong>{size * size}</strong> = {size}&sup2;
          </span>
        </p>
      </div>
      <div className="fig-row">
        <button type="button" className="btn btn-ghost small" disabled={size <= 1} onClick={() => setSize(size - 1)} aria-label="One fewer">
          −
        </button>
        <button type="button" className="btn btn-primary small" disabled={size >= MOST} onClick={() => setSize(size + 1)}>
          {size >= MOST ? "And so on, for ever" : `Add the next odd number, ${2 * size + 1}`}
        </button>
      </div>
    </>
  );
}

const PROOFS: { tab: string; name: string; claim: string; steps: Step[]; Fig: () => React.ReactNode; caption: string }[] = [
  {
    tab: "Contradiction",
    name: "Proof by contradiction",
    claim: `${m(root2)} cannot be written as a fraction.`,
    steps: [
      { say: `Assume the opposite: that it can, with whole numbers ${m(i("a"))} and ${m(i("b"))} cancelled down until they share no factor.`, show: row(root2, o("="), frac(i("a"), i("b"))) },
      { say: `Square both sides. Then ${m(sq(i("a")))} is even, so ${m(i("a"))} itself is even, say ${m(i("a"), o("="), n(2), i("k"))}.`, show: row(sq(i("a")), o("="), n(2), sq(i("b"))) },
      { say: `Substitute that back in. Now ${m(i("b"))} is even too.`, show: row(n(4), sq(i("k")), o("="), n(2), sq(i("b")), gapm, o("⟹"), gapm, sq(i("b")), o("="), n(2), sq(i("k"))) },
      { say: `So ${m(i("a"))} and ${m(i("b"))} share the factor 2, when we said they shared none. The assumption has contradicted itself, so it was false.` },
    ],
    Fig: DiagonalFigure,
    caption: "Where the number comes from: the diagonal of a square of side 1. Swing it down onto a ruler and it lands on a point no fraction names.",
  },
  {
    tab: "Construction",
    name: "Proof by construction",
    claim: "The primes never run out.",
    steps: [
      { say: `Take any finite list of primes you like, ${m(sub(i("p"), n(1)), o(","), sub(i("p"), n(2)), o(","), i("…"), o(","), sub(i("p"), i("k")))}.` },
      { say: "Build a new number from it: multiply them all together and add one.", show: row(i("N"), o("="), sub(i("p"), n(1)), sub(i("p"), n(2)), dots, sub(i("p"), i("k")), o("+"), n(1)) },
      { say: `Dividing ${m(i("N"))} by any prime on the list leaves remainder 1, so none of them divides it.` },
      { say: `But ${m(i("N"))} is bigger than 1, so some prime divides it. We have built a prime that is not on the list, and we can do that to any list. (Euclid, about 300 BC.)` },
    ],
    Fig: PrimePicker,
    caption: "Tap primes to put them on your list. The recipe always hands back at least one you left out.",
  },
  {
    tab: "Induction",
    name: "Proof by induction",
    claim: `The first ${m(i("n"))} odd numbers add up to ${m(sq(i("n")))}.`,
    steps: [
      { say: "State exactly what is to be proved, for every whole number at once.", show: row(n(1), o("+"), n(3), o("+"), n(5), o("+"), dots, o("+"), o("("), n(2), i("n"), o("−"), n(1), o(")"), o("="), sq(i("n"))) },
      { say: `<em>The first domino.</em> It is true for ${m(i("n"), o("="), n(1))}.`, show: row(n(1), o("="), sq(n(1))) },
      {
        say: `<em>Each domino knocks over the next.</em> Suppose it is true for some ${m(i("n"))}, and add the next odd number.`,
        show: [row(sq(i("n")), o("+"), o("("), n(2), i("n"), o("+"), n(1), o(")"), o("="), sq(row(o("("), i("n"), o("+"), n(1), o(")"))))],
      },
      { say: `So it is true for ${m(i("n"), o("+"), n(1))} as well. True for 1, hence for 2, hence for 3, and so on without end.` },
    ],
    Fig: GnomonGrow,
    caption: "The same step as a picture: wrapping the next odd number round a square makes the next square.",
  },
];

export function Proofs() {
  const [which, setWhich] = useState(0);
  const [shown, setShown] = useState(1);
  const proof = PROOFS[which];
  const done = shown >= proof.steps.length;
  const Fig = proof.Fig;
  return (
    <article className="thms">
      <header>
        <div className="proof-head">
          <span className="mono">Pure maths</span>
          <div className="seg" role="group" aria-label="Choose a way of proving">
          <Pill />
            {PROOFS.map((p, k) => (
              <button
                key={p.tab}
                type="button"
                aria-pressed={k === which}
                onClick={() => {
                  setWhich(k);
                  setShown(1);
                }}
              >
                {p.tab}
              </button>
            ))}
          </div>
        </div>
        <h3>Three ways to prove something</h3>
      </header>
      <section className="thm" key={which}>
        <div className="thm-text">
          <p className="thm-claim">
            <b className="mono">{proof.name}</b>
            <span dangerouslySetInnerHTML={{ __html: proof.claim }} />
          </p>
          <ol className="proof-steps" aria-live="polite">
            {proof.steps.slice(0, shown).map((step, k) => (
              <li key={k} className="proof-step">
                <b>{k + 1}</b>
                <div>
                  <span dangerouslySetInnerHTML={{ __html: step.say }} />
                  {k === proof.steps.length - 1 && <i className="proof-qed" role="img" aria-label="End of proof" />}
                  {step.show && <div className="thm-show" dangerouslySetInnerHTML={{ __html: [step.show].flat().map((line) => `<math display="block">${line}</math>`).join("") }} />}
                </div>
              </li>
            ))}
          </ol>
          <div className="proof-next">
            {done ? (
              <button type="button" className="btn btn-ghost small" onClick={() => setShown(1)}>
                Start again
              </button>
            ) : (
              <button type="button" className="btn btn-primary small" onClick={() => setShown(shown + 1)}>
                Next step
              </button>
            )}
            <span className="proof-pips" aria-label={`Step ${shown} of ${proof.steps.length}`}>
              {proof.steps.map((_, k) => (
                <i key={k} data-on={k < shown} />
              ))}
            </span>
          </div>
        </div>
        <figure className="thm-fig">
          <Fig />
          <figcaption>{proof.caption}</figcaption>
        </figure>
      </section>
    </article>
  );
}

// --------------------------------------------------------------------------------------------- Quantum mechanics: the double-slit experiment.
const DE_BROGLIE = row(i("λ"), o("="), frac(i("h"), i("p")));
const amp2 = (k: number) => sup(row(o("|"), sub(i("ψ"), n(k)), o("|")), n(2));
const BOTH = row(i("P"), o("="), sup(row(o("|"), sub(i("ψ"), n(1)), o("+"), sub(i("ψ"), n(2)), o("|")), n(2)), o("="), amp2(1), o("+"), amp2(2), o("+"), n(2), `<mspace width="0.17em"/>`, fn("Re", row(subsup(i("ψ"), n(1), o("*")), sub(i("ψ"), n(2)))));
const WATCHED = row(i("P"), o("="), amp2(1), o("+"), amp2(2));
const FRINGES = row(i("d"), `<mspace width="0.17em"/>`, fn("sin", i("θ")), o("="), i("n"), i("λ"), `<mspace width="1.4em"/>`, i("Δ"), i("y"), o("="), frac(i("λ") + i("L"), i("d")));

const rgb = (c: string) => {
  const hex = c.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [parseInt(hex[1].slice(0, 2), 16), parseInt(hex[1].slice(2, 4), 16), parseInt(hex[1].slice(4, 6), 16)];
  const nums = c.match(/[\d.]+/g);
  return nums && nums.length >= 3 ? nums.slice(0, 3).map(Number) : [168, 120, 170];
};

export function DoubleSlit() {
  const [watch, setWatch] = useState(false);
  const [gap, setGap] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [count, setCount] = useState(0);
  const sim = useRef({
    hits: [] as [number, number, number][], // across the film (0 to 1), up the film (-1 to 1), age
    bins: new Array(64).fill(0) as number[],
    flying: [] as { t: number; slit: number; y: number; x: number }[],
    due: 0,
    total: 0,
    told: 0,
    phase: 0,
    blink: [0, 0],
    field: null as HTMLCanvasElement | null,
  });
  const live = useRef({ watch, gap, speed });
  live.current = { watch, gap, speed };
  useEffect(() => {
    const s = sim.current;
    s.hits = [];
    s.bins.fill(0);
    s.flying = [];
    s.total = 0;
    s.told = 0;
    setCount(0);
  }, [watch, gap, speed]);

  const ref = useCanvas((g, w, h, dt, colour) => {
    const s = sim.current, c = live.current;
    s.phase += dt * 6;
    const top = 20, reach = (h - top - 8) / 2, cy = top + reach;
    const gun = 14, wall = w * 0.2, screen = w * 0.68, filmX = screen + 5, filmW = w * 0.13, chart = filmX + filmW + 6, room = w - chart - 6;
    const lam = 15 / c.speed, k = (Math.PI * 2) / lam, half = 10 + 14 * c.gap;
    const slits = [cy - half, cy + half];
    // The wave from one slit, at a point: how strong, and how far through its cycle.
    const from = (j: number, x: number, y: number) => {
      const dx = x - wall, r = Math.hypot(dx, y - slits[j]) + 0.001;
      return [(dx / r) / Math.sqrt(r + 14), k * r];
    };
    // The chance of landing at a height on the screen: add the waves and square, or, if watched, square then add.
    const odds = (y: number) => {
      const [a1, p1] = from(0, screen, y), [a2, p2] = from(1, screen, y);
      return a1 * a1 + a2 * a2 + (c.watch ? 0 : 2 * a1 * a2 * Math.cos(p1 - p2));
    };
    let peak = 0;
    for (let q = 0; q <= 240; q++) peak = Math.max(peak, odds(cy - reach + (q / 240) * 2 * reach));

    g.clearRect(0, 0, w, h);
    const rose = rgb(colour("--rose")), plum = rgb(colour("--plum-soft")), text = colour("--text"), muted = colour("--muted");

    // The wave between the slits and the screen, drawn small and scaled up.
    const cell = 3, cols = Math.ceil((screen - wall) / cell), rows = Math.ceil((2 * reach) / cell);
    if (!s.field) s.field = document.createElement("canvas");
    if (s.field.width !== cols || s.field.height !== rows) { s.field.width = cols; s.field.height = rows; }
    const fg = s.field.getContext("2d");
    if (fg) {
      const img = fg.createImageData(cols, rows);
      for (let ry = 0; ry < rows; ry++) {
        for (let rx = 0; rx < cols; rx++) {
          const x = wall + (rx + 0.5) * cell, y = cy - reach + (ry + 0.5) * cell, at = (ry * cols + rx) * 4;
          const [a1, p1] = from(0, x, y), [a2, p2] = from(1, x, y);
          let v: number, tint = rose;
          if (c.watch) v = (a1 * a1 + a2 * a2) * 34; // no pattern left, only a glow
          else {
            const re = a1 * Math.cos(p1 - s.phase) + a2 * Math.cos(p2 - s.phase);
            v = Math.abs(re) * 5.2;
            if (re < 0) tint = plum;
          }
          img.data[at] = tint[0]; img.data[at + 1] = tint[1]; img.data[at + 2] = tint[2];
          img.data[at + 3] = Math.min(1, v) * 215;
        }
      }
      fg.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(s.field, wall, cy - reach, screen - wall, 2 * reach);
    }
    // Flat wave fronts coming from the gun.
    g.strokeStyle = `rgb(${rose.join(",")})`;
    g.lineWidth = 1.5;
    for (let x = wall - ((s.phase / k) % lam + lam) % lam; x > gun + 8; x -= lam) {
      g.globalAlpha = 0.16 + 0.34 * ((x - gun) / (wall - gun));
      const tall = 10 + (reach - 10) * Math.min(1, (x - gun) / (wall - gun) + 0.15);
      g.beginPath(); g.moveTo(x, cy - tall); g.lineTo(x, cy + tall); g.stroke();
    }
    g.globalAlpha = 1;
    // The gun and the wall.
    g.fillStyle = muted;
    g.beginPath(); g.roundRect(gun - 9, cy - 7, 15, 14, 4); g.fill();
    const hole = 5;
    g.fillRect(wall - 3, top, 6, slits[0] - hole - top);
    g.fillRect(wall - 3, slits[0] + hole, 6, slits[1] - slits[0] - 2 * hole);
    g.fillRect(wall - 3, slits[1] + hole, 6, cy + reach - slits[1] - hole);
    // The film the electrons land on.
    g.fillStyle = muted;
    g.globalAlpha = 0.14;
    g.beginPath(); g.roundRect(filmX, cy - reach, filmW, 2 * reach, 4); g.fill();
    g.globalAlpha = 1;

    // Fire. Unwatched, an electron is only ever seen where it lands. Watched, it is seen at a slit first.
    s.due -= dt;
    while (s.due <= 0) {
      s.due += 0.032;
      let y = 0;
      for (let tries = 0; tries < 60; tries++) {
        y = Math.random() * 2 - 1;
        if (Math.random() * peak < odds(cy + y * reach)) break;
      }
      if (!c.watch) land(y);
      else {
        const [a1] = from(0, screen, cy + y * reach), [a2] = from(1, screen, cy + y * reach);
        s.flying.push({ t: 0, slit: Math.random() * (a1 * a1 + a2 * a2) < a1 * a1 ? 0 : 1, y, x: Math.random() });
      }
    }
    function land(y: number, x = Math.random()) {
      s.hits.push([x, y, 0]);
      if (s.hits.length > 3000) s.hits.shift();
      s.bins[Math.min(63, Math.floor(((y + 1) / 2) * 64))] += 1;
      s.total += 1;
    }
    if (c.watch) {
      s.flying = s.flying.filter((p) => {
        const before = p.t;
        p.t += dt / 0.55;
        if (before < 0.3 && p.t >= 0.3) s.blink[p.slit] = 1;
        if (p.t >= 1) { land(p.y, p.x); return false; }
        const sy = slits[p.slit], ex = filmX + p.x * filmW, ey = cy + p.y * reach;
        const q = p.t < 0.3 ? p.t / 0.3 : (p.t - 0.3) / 0.7;
        const x = p.t < 0.3 ? gun + (wall - gun) * q : wall + (ex - wall) * q, y = p.t < 0.3 ? cy + (sy - cy) * q : sy + (ey - sy) * q;
        g.fillStyle = text;
        g.beginPath(); g.arc(x, y, 1.7, 0, 7); g.fill();
        return true;
      });
      // A detector at each slit, which blinks as something passes.
      slits.forEach((y, j) => {
        s.blink[j] = Math.max(0, s.blink[j] - dt * 5);
        g.strokeStyle = text;
        g.lineWidth = 1.5;
        g.beginPath(); g.arc(wall + 12, y, 5.5, 0, 7); g.stroke();
        g.fillStyle = text;
        g.globalAlpha = 0.25 + 0.75 * s.blink[j];
        g.beginPath(); g.arc(wall + 12, y, 3, 0, 7); g.fill();
        g.globalAlpha = 1;
      });
    }
    // Every landing so far, with a flash for the newest.
    for (const hit of s.hits) {
      const x = filmX + 2 + hit[0] * (filmW - 4), y = cy + hit[1] * reach;
      g.fillStyle = text;
      g.globalAlpha = 0.85;
      g.fillRect(x - 0.9, y - 0.9, 1.8, 1.8);
      if (hit[2] < 0.35) {
        hit[2] += dt;
        g.globalAlpha = 0.35 * (1 - hit[2] / 0.35);
        g.beginPath(); g.arc(x, y, 1.5 + hit[2] * 14, 0, 7); g.fill();
      }
    }
    g.globalAlpha = 1;
    // The tally, and the curve the equation predicts.
    const most = Math.max(10, ...s.bins), rowH = (2 * reach) / 64;
    g.fillStyle = colour("--mauve");
    s.bins.forEach((v, q) => { if (v) { g.beginPath(); g.roundRect(chart, cy - reach + q * rowH + 0.5, (v / most) * room, Math.max(1, rowH - 1), 1.5); g.fill(); } });
    g.strokeStyle = text;
    g.lineWidth = 1.5;
    g.beginPath();
    for (let q = 0; q <= 200; q++) {
      const y = cy - reach + (q / 200) * 2 * reach, x = chart + (odds(y) / peak) * room * 0.94;
      if (q) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
    // Labels.
    g.fillStyle = muted;
    g.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
    g.textAlign = "center";
    g.fillText("GUN", gun + 2, 12);
    g.fillText("SLITS", wall, 12);
    g.fillText("SCREEN", filmX + filmW / 2, 12);
    g.fillText("TALLY", chart + room / 2, 12);
    if (s.total - s.told >= 20) {
      s.told = s.total;
      setCount(s.total);
    }
  });

  return (
    <article className="wave-card flip">
      <div className="wave-pic">
        <canvas ref={ref} className="sim wave" role="img" aria-label={watch ? "Electrons fired through two slits while a detector watches which slit each takes. They land in two plain bands." : "Electrons fired one at a time through two slits. They land one by one but build up into stripes."} />
        <p className="wave-key">
          <b className="key-fill" /> the wave <b className="key-bar" /> where they landed <b className="key-line" /> the prediction
          <span className="mono slit-count">{count.toLocaleString("en-GB")} fired</span>
        </p>
        <div className="lab-row">
          <button type="button" className="btn btn-ghost small" aria-pressed={watch} onClick={() => setWatch(!watch)}>
            {watch ? "Stop watching" : "Watch which slit"}
          </button>
          <label className="slider mono">
            Slits apart (d)
            <input type="range" min={0.5} max={2} step={0.05} value={gap} onChange={(e) => setGap(Number(e.target.value))} aria-label="Distance between the slits" />
          </label>
          <label className="slider mono">
            Speed (p)
            <input type="range" min={0.5} max={2} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="How fast the electrons are fired" />
          </label>
        </div>
      </div>
      <div className="wave-text">
        <span className="mono">Quantum mechanics</span>
        <h3>One electron, two slits</h3>
        <p>
          Electrons are fired one at a time. Each lands as a single dot, like a particle. But the dots pile up in stripes, which only waves make. Each electron seems to go through both slits and interfere with itself. Check which slit it takes, and the stripes go.
        </p>
        <ol className="formulas">
          <Eq math={DE_BROGLIE} label="Lambda equals h over p">Every particle has a wavelength, set by its momentum. Faster means shorter.</Eq>
          {watch ? (
            <Eq key="w" math={WATCHED} label="P equals the size of psi one squared plus the size of psi two squared">
              <strong>While you watch:</strong> it went through one slit or the other, so the chances simply add. Two plain bands.
            </Eq>
          ) : (
            <Eq key="b" math={BOTH} label="P equals the size of psi one plus psi two, squared, which equals the size of psi one squared, plus the size of psi two squared, plus twice the real part of psi one conjugate times psi two">
              <strong>Unwatched:</strong> add the two waves first, then square. The extra term on the end is the stripes.
            </Eq>
          )}
          <Eq math={FRINGES} label="d sine theta equals n lambda. Delta y equals lambda L over d">Bright stripes sit where the two paths differ by a whole number of wavelengths. Move the slits apart, or speed the electrons up, and the stripes crowd together.</Eq>
        </ol>
      </div>
    </article>
  );
}

export function MathsPlay() {
  return (
    <div className="waves">
      <Proofs />
      <DoubleSlit />
    </div>
  );
}

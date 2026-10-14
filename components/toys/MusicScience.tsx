"use client";

import { useEffect, useRef, useState } from "react";
import { partials } from "@/lib/audio";
import { d2, Eq, fn, frac, i, n, o, root, row, sub, sup, useCanvas } from "./mathkit";

const WAVE = row(d2(i("y"), "t"), o("="), sup(i("c"), n(2)), d2(i("y"), "x"));
const MODES_SUM = row(
  i("y"), o("("), i("x"), o(","), i("t"), o(")"), o("="),
  `<munderover><mo>∑</mo>${row(i("n"), o("="), n(1))}<mi>∞</mi></munderover>`,
  sub(i("a"), i("n")), fn("sin", frac(i("n") + i("π") + i("x"), i("L"))), fn("cos", row(n(2), i("π"), sub(i("f"), i("n")), i("t"))),
);
const OVERTONES = row(sub(i("f"), i("n")), o("="), i("n"), sub(i("f"), n(1)), o("="), frac(i("n"), n(2) + i("L")), root(frac(i("T"), i("μ"))));


// --------------------------------------------------------------------------------------------- A string you can play with.
const COUNT = 10;
const BASE = 110; // the A string of a guitar
// How much of harmonic k a string holds when pulled into a triangle at `at` (0 to 1 along it).
const share = (k: number, at: number) => (2 / (k * k * Math.PI * Math.PI * at * (1 - at))) * Math.sin(k * Math.PI * at);
const SPOTS = [
  { at: 0.08, name: "By the bridge" },
  { at: 0.22, name: "Where a guitarist plucks" },
  { at: 0.5, name: "Dead centre" },
];
const TOUCH = [
  { m: 2, name: "½", says: "Touched at the half, only the even harmonics are left, and the note jumps up an octave. This is the chime at the twelfth fret." },
  { m: 3, name: "⅓", says: "Touched at a third, only every third harmonic is left: an octave and a fifth above the open string." },
  { m: 4, name: "¼", says: "Touched at a quarter, only every fourth harmonic is left: two octaves up." },
];

export function PluckedString() {
  const [on, setOn] = useState<boolean[]>(() => Array(COUNT).fill(true));
  const [at, setAt] = useState(0.22);
  const [touch, setTouch] = useState(0);
  const live = useRef({ t: 0, at: 0.22, touch: 0, on: Array(COUNT).fill(true) as boolean[], hold: null as number | null, lift: 0 });
  const bars = useRef<(HTMLElement | null)[]>([]);

  // The strength of each harmonic right now, as the string is set up.
  const recipe = (s = live.current) => Array.from({ length: COUNT }, (_, n) => (s.on[n] && (!s.touch || (n + 1) % s.touch === 0) ? share(n + 1, s.at) : 0));
  const pluck = (change: Partial<{ at: number; touch: number; on: boolean[] }> = {}) => {
    Object.assign(live.current, change, { t: 0 });
    const levels = recipe();
    const top = Math.max(0.0001, ...levels.map(Math.abs));
    partials(BASE, levels.map((v) => (v / top) * 0.9), { gain: 0.26 });
  };

  const draw = useCanvas((g, w, h, dt, colour) => {
    const s = live.current;
    s.t += dt;
    if (s.t > 10 && s.hold === null) s.t = 0; // it has died away: set it going again, silently
    s.lift += ((s.hold === null ? 0 : 1) - s.lift) * Math.min(1, dt * 14);
    g.clearRect(0, 0, w, h);
    const left = 20, span = w - 40, mid = h * 0.5, tall = h * 0.36;
    const levels = recipe();
    const top = Math.max(1e-6, ...levels.map(Math.abs)) * 1.15; // the strongest harmonic present fills the picture, so a quiet recipe still shows
    const fade = (k: number) => Math.exp(-0.085 * k * s.t), turn = (k: number) => Math.cos(k * 2.6 * s.t);
    const line = (y: (x: number) => number, stroke: string, width: number, alpha = 1) => {
      g.strokeStyle = stroke;
      g.lineWidth = width;
      g.globalAlpha = alpha;
      g.lineJoin = "round";
      g.beginPath();
      for (let n = 0; n <= 160; n++) {
        const x = n / 160;
        if (n) g.lineTo(left + x * span, mid - y(x) * tall);
        else g.moveTo(left, mid - y(x) * tall);
      }
      g.stroke();
      g.globalAlpha = 1;
    };
    // Where it may be touched.
    g.font = "11px ui-monospace, monospace";
    g.textAlign = "center";
    for (const node of TOUCH) {
      const x = left + span / node.m;
      g.strokeStyle = colour("--edge");
      g.setLineDash([3, 4]);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, mid - tall * 0.9);
      g.lineTo(x, mid + tall * 0.9);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = colour(s.touch === node.m ? "--accent" : "--muted");
      g.fillText(node.name, x, mid + tall * 0.9 + 14);
    }
    const ringing = (x: number) => {
      let y = 0;
      for (let k = 1; k <= COUNT; k++) y += (levels[k - 1] / top) * fade(k) * turn(k) * Math.sin(k * Math.PI * x);
      return y;
    };
    // The first three ingredients on their own, faintly; then the string, which is all of them added up.
    if (s.lift < 0.5) [1, 2, 3].forEach((k, n) => levels[k - 1] && line((x) => (levels[k - 1] / top) * fade(k) * turn(k) * Math.sin(k * Math.PI * x), colour(["--rose", "--mauve", "--plum-soft"][n]), 1.5, 0.5 * (1 - s.lift * 2)));
    const pulled = (x: number) => (s.hold === null ? 0 : (x < s.hold ? x / s.hold : (1 - x) / (1 - s.hold)) * 0.82);
    line((x) => ringing(x) * (1 - s.lift) + pulled(x) * s.lift, colour("--text"), 2.6);
    g.fillStyle = colour("--muted");
    [left, left + span].forEach((x) => (g.beginPath(), g.arc(x, mid, 4.5, 0, 7), g.fill()));
    if (s.hold !== null) {
      g.fillStyle = colour("--accent");
      g.beginPath();
      g.arc(left + s.hold * span, mid - 0.82 * tall * s.lift, 7, 0, 7);
      g.fill();
    } else if (s.touch) {
      g.fillStyle = colour("--accent");
      g.globalAlpha = Math.max(0, 1 - s.t * 1.5);
      g.beginPath();
      g.arc(left + span / s.touch, mid, 7, 0, 7);
      g.fill();
      g.globalAlpha = 1;
    }
    // The bars underneath are real buttons; their heights are set from here so they move with the string.
    bars.current.forEach((el, n) => el && (el.style.height = `${levels[n] ? Math.max(3, (Math.abs(levels[n]) / top) * fade(n + 1) * 100) : 0}%`));
  });
  useEffect(() => void (live.current.on = on), [on]);

  const spot = (e: React.PointerEvent) => {
    const box = e.currentTarget.getBoundingClientRect();
    return Math.max(0.05, Math.min(0.95, (e.clientX - box.left - 20) / (box.width - 40)));
  };
  const says = touch ? TOUCH.find((n) => n.m === touch)!.says : Math.abs(at - 0.5) < 0.04 ? "Plucked dead centre, every even harmonic is missing, because each of them stands still there. Hollow and round, like a clarinet." : at < 0.14 || at > 0.86 ? "Plucked right by the end, the high harmonics are nearly as strong as the low ones: thin, bright and twangy." : "Plucked a little way along, the low harmonics lead and the high ones trail off: the warm sound a guitar is known for.";

  return (
    <article className="wave-card">
      <div className="wave-pic st-lab">
        <canvas
          ref={draw}
          className="sim wave st-string"
          role="img"
          aria-label="A string pinned at both ends. Press anywhere along it to pull it up there, and let go to pluck it."
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            live.current.hold = spot(e);
          }}
          onPointerMove={(e) => live.current.hold !== null && (live.current.hold = spot(e))}
          onPointerUp={() => {
            const where = live.current.hold;
            if (where === null) return;
            live.current.hold = null;
            setAt(where);
            setTouch(0);
            pluck({ at: where, touch: 0 });
          }}
          onPointerCancel={() => (live.current.hold = null)}
        />
        <div className="st-bars" role="group" aria-label="The harmonics in the note. Press one to switch it off or on.">
          {on.map((is, n) => (
            <button
              key={n}
              type="button"
              className="st-bar"
              aria-pressed={is}
              aria-label={`Harmonic ${n + 1}, ${BASE * (n + 1)} hertz`}
              onClick={() => {
                const next = on.map((v, k) => (k === n ? !v : v));
                setOn(next);
                pluck({ on: next });
              }}
            >
              <span>
                <i ref={(el) => void (bars.current[n] = el)} data-k={Math.min(n, 2)} />
              </span>
              <small>{n + 1}f</small>
            </button>
          ))}
        </div>
        <p className="st-says" key={says} aria-live="polite">
          {says}
        </p>
        <div className="st-row">
          <span className="mono">Pluck it</span>
          {SPOTS.map((sp) => (
            <button key={sp.name} type="button" className="btn btn-ghost small" aria-pressed={!touch && Math.abs(at - sp.at) < 0.02} onClick={() => (setAt(sp.at), setTouch(0), pluck({ at: sp.at, touch: 0 }))}>
              {sp.name}
            </button>
          ))}
        </div>
        <div className="st-row">
          <span className="mono">Touch it lightly at</span>
          {TOUCH.map((node) => (
            <button key={node.m} type="button" className="btn btn-ghost small st-touch" aria-pressed={touch === node.m} onClick={() => (setTouch(node.m), pluck({ touch: node.m }))}>
              {node.name}
            </button>
          ))}
          {on.some((v) => !v) && (
            <button
              type="button"
              className="btn btn-ghost small"
              onClick={() => {
                const all = Array(COUNT).fill(true);
                setOn(all);
                pluck({ on: all });
              }}
            >
              All harmonics back
            </button>
          )}
        </div>
      </div>
      <div className="wave-text">
        <span className="mono">Music</span>
        <h3>One note is a stack of waves</h3>
        <p>
          Press the string anywhere and let go. It does not move as one wave: because both ends are pinned, the only waves that fit are whole numbers of half-waves, and the shape you pulled it into is a sum of those. The bars are the recipe, and you can hear it change: pluck somewhere else, touch the string at a half or a third, or switch a harmonic off and find out what it was adding. That recipe is why a guitar and a flute playing the same note sound different.
        </p>
        <ol className="formulas">
          <Eq math={WAVE} label="The second time derivative of y equals c squared times its second space derivative">The wave equation: how any stretched string moves.</Eq>
          <Eq math={MODES_SUM} label="y of x and t is the sum over n of a n, sine of n pi x over L, cosine of two pi f n t">Pinned at both ends, every motion is a sum of standing waves.</Eq>
          <Eq math={OVERTONES} label="f n equals n times f one, equals n over two L times the square root of T over mu">
            Each rings at a whole multiple of the lowest. Two to one is an octave, three to two a fifth: harmony is small whole numbers.
          </Eq>
        </ol>
      </div>
    </article>
  );
}

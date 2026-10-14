"use client";

import { Pill } from "@/components/Pill";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { INSTRUMENTS, loadSounds, note, type Instrument } from "@/lib/audio";
import { Fretboard, Kalimba, Keyboard, Marimba, useOctaves } from "../Instruments";
import { claimKeys, hasKeys } from "@/lib/keys";
import { deviations, fifths, INTERVALS, middleC, NOTE_NAMES, TEMPERAMENTS, type Interval, type Temperament } from "@/lib/tuning";

const KEYS = ["a", "w", "s", "e", "d", "f", "t", "g", "y", "h", "u", "j", "k"];
const PITCHES = [415, 432, 440, 442];

// A row of choices with a glass pill that slides to the chosen one.
function Segmented<T extends string | number>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg-field">
      <span className="mono">{label}</span>
      <div className="seg" role="group" aria-label={label}>
        <Pill />
        {options.map((o) => (
          <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Two notes drawn against each other. A pure interval holds still; a tempered one slowly tumbles.
function Lissajous({ ratio, pure, base }: { ratio: number; pure: readonly [number, number] | readonly number[]; base: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const g = el.getContext("2d");
    if (!g) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = 220;
    el.width = el.height = size * dpr;
    const style = getComputedStyle(el);
    const [p, q] = pure;
    // The figure drifts at the beat rate between the two notes (slowed so the eye can follow it).
    const beat = Math.abs(q * base * ratio - p * base);
    let frame = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const t = reduce ? 0 : (now - start) / 1000;
      const phase = Math.PI / 2 + t * beat * 0.35;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, size, size);
      const grad = g.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, style.getPropertyValue("--rose").trim() || "#ddb3cb");
      grad.addColorStop(1, style.getPropertyValue("--plum-soft").trim() || "#8a66a3");
      g.strokeStyle = grad;
      g.lineWidth = 2;
      g.lineJoin = "round";
      g.beginPath();
      const steps = 700;
      for (let i = 0; i <= steps; i++) {
        const s = (i / steps) * Math.PI * 2 * q;
        const x = size / 2 + Math.sin((p / q) * s + phase) * (size / 2 - 14);
        const y = size / 2 + Math.sin(s) * (size / 2 - 14);
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
      if (!reduce) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [ratio, pure, base]);
  return <canvas ref={canvas} className="liss" role="img" aria-label="The two notes of the interval drawn against each other" />;
}

export function TuningLab() {
  const [temperament, setTemperament] = useState<Temperament>("equal");
  const [instrument, setInstrument] = useState<Instrument>("piano");
  const [a4, setA4] = useState(440);
  const [interval, setIntervalKind] = useState<Interval>("third");
  const [down, setDown] = useState<Record<number, boolean>>({});
  const [hits, setHits] = useState<Record<number, number>>({}); // how many times each note has been struck, so a struck thing can ring again
  const [strum, setStrum] = useState(0);
  const [moved, setMoved] = useState(0);
  // Moving the keys up or down an octave scrolls them sideways by exactly one octave and stops.
  const slide = useRef({ dir: 0, by: 0, key: 0 });
  const GLIDE = { duration: 520, easing: "cubic-bezier(0.3, 0.9, 0.3, 1)" };
  const setShift = (to: number) => {
    const box = room.current, now = box?.querySelector<HTMLElement>(".ins-in:not(.ins-ghost)");
    const dir = Math.sign(to - moved);
    slide.current = { dir, by: 0, key: 0 };
    // (The marimba does not slide: its bars are all different lengths, so a moving copy never lines up.
    if (box && now && dir && instrument !== "marimba" && typeof now.animate === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // How wide an octave is drawn: from one C to the next (the keyboard ends on an extra C, so it is not simply the width divided by the octaves).
      const naturals = now.querySelectorAll<HTMLElement>(".ins-white, .ins-bar:not(.ins-sharp)");
      const by = naturals.length > 7 ? naturals[7].getBoundingClientRect().left - naturals[0].getBoundingClientRect().left : now.offsetWidth / octaves;
      // Going up, the new keys are shown from the last C onwards (one key's width more), so the join falls between B and C, where there is no black key to…
      slide.current = { dir, by, key: naturals.length > 7 ? naturals[0].getBoundingClientRect().width : 0 };
      box.querySelectorAll(".ins-ghost").forEach((g) => g.remove());
      const ghost = now.cloneNode(true) as HTMLElement;
      ghost.className = "ins-in ins-ghost";
      ghost.setAttribute("aria-hidden", "true");
      ghost.style.height = `${now.offsetHeight}px`;
      box.appendChild(ghost);
      // Going down, the sharp that ends the slide cut in half by the edge (the new keyboard stops at C, without it) fades away as it nears the edge,…
      if (dir < 0) {
        const edge = now.getBoundingClientRect().left + now.offsetWidth - by;
        const sharps = Array.from(now.querySelectorAll<HTMLElement>(".ins-black, .ins-sharp"));
        const cut = sharps.findIndex((el) => Math.abs(el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2 - edge) < 12);
        const twin = cut < 0 ? null : ghost.querySelectorAll<HTMLElement>(".ins-black, .ins-sharp")[cut];
        twin?.animate([{ opacity: 1 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }], { duration: GLIDE.duration, easing: "ease-in", fill: "forwards" });
      }
      ghost.animate([{ transform: "translateX(0)" }, { transform: `translateX(${-dir * by}px)` }], GLIDE).onfinish = () => ghost.remove();
    }
    setMoved(to);
  };
  useLayoutEffect(() => {
    const now = room.current?.querySelector<HTMLElement>(".ins-in:not(.ins-ghost)");
    const { dir, by, key } = slide.current;
    // The marimba: the bars stay where they are and a ripple runs along them, upwards or downwards, as each takes its new note, the way a mallet would…
    if (now && dir && instrument === "marimba" && typeof now.animate === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const bars = Array.from(now.querySelectorAll<HTMLElement>(".ins-bar")).sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
      if (dir < 0) bars.reverse();
      bars.forEach((bar, n) =>
        bar.animate([{ transform: "translateY(0)", filter: "brightness(1)" }, { transform: "translateY(-7px)", filter: "brightness(1.35)", offset: 0.4 }, { transform: "translateY(0)", filter: "brightness(1)" }], { duration: 300, delay: n * 11, easing: "ease-out", composite: "add" }),
      );
      return;
    }
    if (!now || !dir || !by || typeof now.animate !== "function") return;
    const hide = `${Math.max(0, now.offsetWidth - by - (dir > 0 ? key + 2 : 0))}px`;
    const clip = dir > 0 ? `inset(0 0 0 ${hide})` : `inset(0 ${hide} 0 0)`;
    now.animate([{ transform: `translateX(${dir * by}px)`, clipPath: clip }, { transform: "translateX(0)", clipPath: clip }], GLIDE);
  }, [moved]);

  const lab = useRef<HTMLDivElement>(null);
  const movable = instrument !== "guitar" && instrument !== "kalimba";
  const shift = movable ? moved : 0;
  const [room, fits] = useOctaves(34, 5);
  const octaves = instrument === "marimba" ? Math.min(3, fits) : fits;
  // Keep middle C on the keyboard: with one octave it starts there, with more it sits in the middle.
  const low = (shift - Math.floor((octaves - 1) / 2)) * 12;

  const t = TEMPERAMENTS[temperament];
  const c4 = middleC(a4, temperament);
  // Any note, counted in semitones from middle C (so notes below it are negative).
  const freq = useCallback((n: number) => c4 * t.ratios[((n % 12) + 12) % 12] * 2 ** Math.floor(n / 12), [c4, t]);

  // Struck once and left to ring (a string, a bar, a tine, or a button asking for a note).
  const play = useCallback(
    (n: number) => {
      note(freq(n), { force: true, instrument, gain: instrument === "voice" ? 0.3 : 0.24 });
      if (instrument === "guitar") return; // the neck shows its own ringing strings
      setHits((h) => ({ ...h, [n]: (h[n] ?? 0) + 1 }));
      setDown((d) => ({ ...d, [n]: true }));
      window.setTimeout(() => setDown((d) => ({ ...d, [n]: false })), 200);
    },
    [freq, instrument],
  );
  // On the keyboard a key held down holds its note, and letting go lets it go.
  const keyed = instrument === "piano" || instrument === "voice" || instrument === "pure";
  const held = useRef(new Map<number, () => void>());
  const typed = useRef(new Map<string, number>());
  const press = useCallback(
    (n: number) => {
      if (held.current.has(n)) return;
      held.current.set(n, note(freq(n), { force: true, instrument, gain: instrument === "voice" ? 0.3 : 0.24, hold: true }));
      setDown((d) => ({ ...d, [n]: true }));
    },
    [freq, instrument],
  );
  const release = useCallback((n: number) => {
    const stop = held.current.get(n);
    if (!stop) return;
    stop();
    held.current.delete(n);
    setDown((d) => ({ ...d, [n]: false }));
  }, []);
  const releaseAll = useCallback(() => [...held.current.keys()].forEach(release), [release]);

  useEffect(() => {
    const skip = (e: KeyboardEvent) => e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName ?? "");
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || skip(e) || !hasKeys("lab")) return;
      const n = KEYS.indexOf(e.key.toLowerCase());
      // The letters follow the keyboard when it is moved up or down an octave.
      if (n < 0) return;
      if (!keyed) return play(n + shift * 12);
      typed.current.set(e.key.toLowerCase(), n + shift * 12); // remembered, so it is this note that is let go
      press(n + shift * 12);
    };
    const onUp = (e: KeyboardEvent) => {
      const n = typed.current.get(e.key.toLowerCase());
      if (n === undefined) return;
      typed.current.delete(e.key.toLowerCase());
      release(n);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", releaseAll);
    };
  }, [play, press, release, releaseAll, keyed, shift]);
  useEffect(() => claimKeys("lab", lab.current!), []);
  useEffect(() => {
    setHits({});
    if (instrument === "piano" || instrument === "guitar") void loadSounds(instrument);
    return releaseAll; // changing instrument lets everything go
  }, [instrument, releaseAll]);

  const dev = useMemo(() => deviations(temperament), [temperament]);
  const fif = useMemo(() => fifths(temperament), [temperament]);
  const iv = INTERVALS[interval];
  const ratio = iv.upper === 12 ? 2 : t.ratios[iv.upper];
  const beats = Math.abs(iv.pure[1] * c4 * ratio - iv.pure[0] * c4);
  const wolf = fif.reduce((worst, e, n) => (Math.abs(e) > Math.abs(fif[worst]) ? n : worst), 0);
  const partials = INSTRUMENTS[instrument].partials;

  const playInterval = () => {
    note(c4, { force: true, instrument: "pure", gain: 0.2, length: 3.2 });
    note(c4 * ratio, { force: true, instrument: "pure", gain: 0.2, length: 3.2 });
  };
  // On the guitar the chord is fingered and strummed on the neck; elsewhere it is C, E and G where the keys are.
  const playChord = () => {
    if (instrument === "guitar") return setStrum((k) => k + 1);
    [0, 4, 7].forEach((n, i) =>
      window.setTimeout(() => {
        if (!keyed) return play(n + shift * 12);
        press(n + shift * 12);
        window.setTimeout(() => release(n + shift * 12), 1100);
      }, i * 70),
    );
  };

  return (
    <div className="lab" ref={lab}>
      <div className="lab-controls">
        <Segmented label="Temperament" value={temperament} onChange={setTemperament} options={(Object.keys(TEMPERAMENTS) as Temperament[]).map((k) => ({ value: k, label: TEMPERAMENTS[k].label }))} />
        <Segmented label="Instrument" value={instrument} onChange={(v) => ((slide.current = { dir: 0, by: 0, key: 0 }), setInstrument(v))} options={(Object.keys(INSTRUMENTS) as Instrument[]).map((k) => ({ value: k, label: INSTRUMENTS[k].label }))} />
        <Segmented label="Concert pitch, A =" value={a4} onChange={setA4} options={PITCHES.map((p) => ({ value: p, label: `${p} Hz` }))} />
      </div>

      <p className="lab-about" key={temperament}>
        {t.about}
      </p>

      <div className="ins" ref={room} data-instrument={instrument}>
        {/* A new instrument rises into place; moving the keys up or down slides them across. */}
        <div className="ins-fit">
        <div className="ins-in" key={`${instrument}|${moved}`}>
        {instrument === "guitar" ? <Fretboard onPlay={play} down={down} strum={strum} /> : instrument === "marimba" ? <Marimba low={low} octaves={octaves} onPlay={play} down={down} /> : instrument === "kalimba" ? <Kalimba onPlay={play} down={down} hits={hits} /> : <Keyboard low={low} octaves={octaves} onPlay={keyed ? press : play} onRelease={release} down={down} />}
        </div>
        </div>
      </div>
      <div className="lab-actions">
        <button type="button" className="btn btn-ghost small" onClick={playChord}>
          Play a C major chord
        </button>
        {movable && (
          <span className="ins-shift">
            <button type="button" className="btn btn-ghost small" disabled={moved <= -2} onClick={() => setShift(moved - 1)} aria-label="Move the keys down an octave">
              ← Lower
            </button>
            <button type="button" className="btn btn-ghost small" disabled={moved >= 2} onClick={() => setShift(moved + 1)} aria-label="Move the keys up an octave">
              Higher →
            </button>
          </span>
        )}
        <span className="mono">
          {instrument === "guitar" ? "Press a string, or drag across to strum · " : movable ? `Keys A to K play from C${4 + shift}${keyed ? ", and hold while you hold them" : ""} · ` : ""}Middle C = {c4.toFixed(2)} Hz
        </span>
      </div>

      <div className="lab-grid">
        <section className="lab-card">
          <h3>Against equal temperament</h3>
          <p>How many cents each note is pushed sharp or flat.</p>
          <svg key={temperament} viewBox="0 0 264 150" className="chart" role="img" aria-label="Deviation of each note from equal temperament in cents">
            <line x1="0" x2="264" y1="68" y2="68" stroke="var(--edge)" />
            {dev.map((c, n) => {
              const h = Math.min(56, Math.abs(c) * 2.2);
              return (
                <g key={n} transform={`translate(${n * 22 + 4} 0)`}>
                  <rect className="bar" x="2" width="12" rx="4" y={c >= 0 ? 68 - h : 68} height={Math.max(h, 1.5)} fill={c >= 0 ? "var(--rose)" : "var(--plum-soft)"} />
                  <text x="8" y="142" textAnchor="middle" className="tick">
                    {NOTE_NAMES[n]}
                  </text>
                  {Math.abs(c) >= 0.5 && (
                    <text x="8" y={c >= 0 ? 68 - h - 4 : 68 + h + 10} textAnchor="middle" className="val">
                      {c > 0 ? "+" : "−"}
                      {Math.abs(c).toFixed(0)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </section>

        <section className="lab-card">
          <h3>The circle of fifths</h3>
          <p>
            Tap a fifth to hear it. {Math.abs(fif[wolf]) > 12 ? `The wolf sits on ${NOTE_NAMES[wolf]}.` : Math.abs(fif[wolf]) < 0.1 ? "Every fifth is pure." : "No fifth is far out."}
          </p>
          <svg viewBox="-110 -110 220 220" className="circle" role="group" aria-label="Circle of fifths">
            {Array.from({ length: 12 }, (_, k) => {
              const n = (k * 7) % 12; // walk round the circle in fifths
              const a0 = ((k * 30 - 90 - 13) * Math.PI) / 180;
              const a1 = ((k * 30 - 90 + 13) * Math.PI) / 180;
              const mid = ((k * 30 - 90) * Math.PI) / 180;
              const err = Math.abs(fif[n]);
              const r = 78;
              const bad = err > 12;
              return (
                <g key={n} className="fifth" data-bad={bad} onClick={() => [n, n + 7].forEach((m, i) => window.setTimeout(() => note(freq(m % 12) * (m >= 12 ? 2 : 1), { force: true, instrument }), i * 60))}>
                  <path d={`M${r * Math.cos(a0)} ${r * Math.sin(a0)}A${r} ${r} 0 0 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)}`} fill="none" strokeLinecap="round" strokeWidth={bad ? 5 : 14 - Math.min(9, err * 1.4)} stroke={bad ? "var(--warn)" : "var(--mauve)"} opacity={bad ? 1 : 1 - Math.min(0.6, err / 14)} />
                  <path d={`M${r * Math.cos(a0)} ${r * Math.sin(a0)}A${r} ${r} 0 0 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)}`} fill="none" stroke="transparent" strokeWidth="30" />
                  <text x={(r - 26) * Math.cos(mid)} y={(r - 26) * Math.sin(mid) + 4} textAnchor="middle" className="tick big">
                    {NOTE_NAMES[n]}
                  </text>
                </g>
              );
            })}
            <text y="-2" textAnchor="middle" className="val big">
              {fif[wolf] > 0 ? "+" : "−"}
              {Math.abs(fif[wolf]).toFixed(1)}
            </text>
            <text y="14" textAnchor="middle" className="tick">
              cents, worst fifth
            </text>
          </svg>
        </section>

        <section className="lab-card">
          <h3>Two notes, drawn</h3>
          <p>{beats < 0.05 ? "Pure: the figure holds still." : `Beating about ${beats.toFixed(1)} times a second.`}</p>
          <Lissajous ratio={ratio} pure={iv.pure} base={c4} />
          <div className="lab-row">
            <Segmented label="Interval above C" value={interval} onChange={setIntervalKind} options={(Object.keys(INTERVALS) as Interval[]).map((k) => ({ value: k, label: INTERVALS[k].label }))} />
            <button type="button" className="btn btn-ghost small" onClick={playInterval}>
              Hear it
            </button>
          </div>
        </section>

        <section className="lab-card">
          <h3>What makes a {INSTRUMENTS[instrument].label.toLowerCase()}</h3>
          <p>The strength of each harmonic above the note you play.</p>
          <div className="spectrum" role="img" aria-label="Relative strength of each harmonic">
            {Array.from({ length: 10 }, (_, n) => (
              <div key={n} className="partial">
                <i style={{ height: `${(partials[n] ?? 0) * 100}%` }} />
                <span>{n + 1}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

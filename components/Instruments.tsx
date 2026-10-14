"use client";

import { useEffect, useRef, useState } from "react";
import { drum, wantSound, type Drum } from "@/lib/audio";
import { claimKeys, hasKeys } from "@/lib/keys";

// The instruments you can actually touch.
type Playable = { onPlay: (semitone: number) => void; down: Record<number, boolean> };
// A keyboard can also say when a key is let go, so a held key can hold its note.
type Holdable = Playable & { onRelease?: (semitone: number) => void };

const NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "G♯", "A", "B♭", "B"];
const NATURALS = [0, 2, 4, 5, 7, 9, 11];
const SHARP_AFTER = [0, 1, 3, 4, 5]; // which naturals in an octave have a black key to their right

// How many octaves fit, given the room and the narrowest a key should be.
export function useOctaves(narrowest: number, most: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [octaves, setOctaves] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setOctaves(Math.max(1, Math.min(most, Math.floor((el.clientWidth - narrowest) / (7 * narrowest)))));
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(el);
    return () => watch.disconnect();
  }, [narrowest, most]);
  return [ref, octaves] as const;
}

// Sliding a finger or a held mouse along the keys plays each one it crosses.
const slide = (play: () => void, release?: () => void) => ({
  onPointerDown: (e: React.PointerEvent) => {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    play();
  },
  onPointerEnter: (e: React.PointerEvent) => {
    if (e.buttons === 1 || e.pointerType === "touch") play();
  },
  onPointerUp: release,
  onPointerLeave: release,
  onPointerCancel: release,
});

export function Keyboard({ low, octaves, onPlay, onRelease, down }: Holdable & { low: number; octaves: number }) {
  const whites = octaves * 7 + 1;
  return (
    <div className="ins-keys" data-nowrap role="group" aria-label={`Piano keyboard, ${octaves} octave${octaves > 1 ? "s" : ""}`} style={{ ["--whites" as string]: whites }}>
      {Array.from({ length: whites }, (_, w) => {
        const n = low + Math.floor(w / 7) * 12 + NATURALS[w % 7];
        const octave = 4 + Math.floor(n / 12);
        return (
          <button key={n} type="button" className="ins-white" data-down={!!down[n]} aria-label={`${NAMES[((n % 12) + 12) % 12]}${octave}`} {...slide(() => onPlay(n), () => onRelease?.(n))}>
            {(w % 7 === 0 || octaves === 1) && (
              <span>
                {NAMES[((n % 12) + 12) % 12]}
                {octaves > 1 ? octave : ""}
              </span>
            )}
          </button>
        );
      })}
      {Array.from({ length: octaves * 7 }, (_, w) => {
        if (!SHARP_AFTER.includes(w % 7)) return null;
        const n = low + Math.floor(w / 7) * 12 + NATURALS[w % 7] + 1;
        return <button key={n} type="button" className="ins-black" data-down={!!down[n]} style={{ left: `${((w + 1) / whites) * 100}%` }} aria-label={`${NAMES[((n % 12) + 12) % 12]}${4 + Math.floor(n / 12)}`} {...slide(() => onPlay(n), () => onRelease?.(n))} />;
      })}
    </div>
  );
}

// Wooden bars over resonator tubes: naturals in the front row, sharps and flats behind, getting shorter as they rise.
export function Marimba({ low, octaves, onPlay, down }: Playable & { low: number; octaves: number }) {
  const whites = octaves * 7 + 1;
  const size = (w: number) => 100 - (w / (whites - 1)) * 34;
  return (
    <div className="ins-marimba" data-nowrap role="group" aria-label={`Marimba, ${octaves} octave${octaves > 1 ? "s" : ""}`}>
      <div className="ins-bars ins-rear">
        {Array.from({ length: octaves * 7 }, (_, w) => {
          if (!SHARP_AFTER.includes(w % 7)) return null;
          const n = low + Math.floor(w / 7) * 12 + NATURALS[w % 7] + 1;
          return <button key={n} type="button" className="ins-bar ins-sharp" data-down={!!down[n]} style={{ left: `${((w + 1) / whites) * 100}%`, width: `${(0.78 / whites) * 100}%`, height: `${size(w + 0.5)}%` }} aria-label={NAMES[((n % 12) + 12) % 12]} {...slide(() => onPlay(n))} />;
        })}
      </div>
      <div className="ins-bars ins-fore">
        {Array.from({ length: whites }, (_, w) => {
          const n = low + Math.floor(w / 7) * 12 + NATURALS[w % 7];
          return (
            <button key={n} type="button" className="ins-bar" data-down={!!down[n]} style={{ height: `${size(w)}%` }} aria-label={NAMES[((n % 12) + 12) % 12]} {...slide(() => onPlay(n))}>
              <span>{NAMES[((n % 12) + 12) % 12]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// A thumb piano: seventeen steel tines on a wooden box, the lowest in the middle and rising alternately to each side.
export function Kalimba({ onPlay, hits }: Playable & { hits: Record<number, number> }) {
  return (
    <div className="ins-kalimba" data-nowrap role="group" aria-label="Kalimba, seventeen tines">
      <i className="ins-kalimba-hole" aria-hidden="true" />
      <i className="ins-kalimba-bridge" aria-hidden="true" />
      {Array.from({ length: 17 }, (_, k) => {
        const away = Math.abs(k - 8);
        const degree = away === 0 ? 0 : k < 8 ? 2 * away - 1 : 2 * away;
        const n = Math.floor(degree / 7) * 12 + NATURALS[degree % 7];
        return (
          <button key={k} type="button" className="ins-tine" style={{ height: `${90 - away * 5.2}%` }} aria-label={NAMES[n % 12]} {...slide(() => onPlay(n))}>
            {/* Remade on every strike, so the ringing starts again from the top however fast it is played. */}
            <i key={hits[n] ?? 0} data-ring={!!hits[n]}>
              <span>{NAMES[n % 12]}</span>
            </i>
          </button>
        );
      })}
    </div>
  );
}

// A guitar neck seen from the front, like a chord diagram turned on its side: top string at the top.
const OPEN = [4, -1, -5, -10, -15, -20]; // E4 B3 G3 D3 A2 E2, in semitones from middle C
const GAUGE = [1.1, 1.4, 1.8, 2.4, 3, 3.6];
// C major as a guitarist plays it: third fret on the A string, second on the D, first on the B, the rest open.
const C_SHAPE: (number | null)[] = [0, 1, 0, 2, 3, null];
export function Fretboard({ onPlay, down, strum }: Playable & { strum: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [frets, setFrets] = useState(7);
  const [hover, setHover] = useState<{ s: number; f: number } | null>(null);
  const [rung, setRung] = useState<{ s: number; f: number; id: number }[]>([]);
  const last = useRef({ s: -1, held: false });
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setFrets(Math.max(5, Math.min(12, Math.floor((el.clientWidth - 44) / 54))));
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  const NUT = 44, FRET = 60, TOP = 18, GAP = 24;
  const width = NUT + frets * FRET + 6, height = TOP * 2 + GAP * 5;
  const where = (e: React.PointerEvent) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * width, y = ((e.clientY - box.top) / box.height) * height;
    return { s: Math.max(0, Math.min(5, Math.round((y - TOP) / GAP))), f: Math.max(0, Math.min(frets, Math.ceil((x - NUT) / FRET))) };
  };
  const strike = (s: number, f: number) => {
    onPlay(OPEN[s] + f);
    const id = performance.now() + s;
    setRung((list) => [...list.filter((r) => r.s !== s), { s, f, id }]);
    window.setTimeout(() => setRung((list) => list.filter((r) => r.id !== id)), 900);
  };
  const struck = useRef(strike);
  struck.current = strike;
  // When asked to (the chord button), finger the chord and strum down from the lowest string.
  const strummed = useRef(strum);
  useEffect(() => {
    // Only a new press of the button: coming back to the guitar later must not play the last chord again.
    if (strum === strummed.current) return;
    strummed.current = strum;
    const waits = [5, 4, 3, 2, 1, 0].flatMap((s, k) => (C_SHAPE[s] === null ? [] : [window.setTimeout(() => struck.current(s, C_SHAPE[s] as number), k * 55)]));
    return () => waits.forEach((w) => window.clearTimeout(w));
  }, [strum]);
  const stopX = (f: number) => (f === 0 ? NUT - 16 : NUT + (f - 0.5) * FRET);
  return (
    <div className="ins-neck-wrap" ref={wrap} data-nowrap>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="ins-neck"
        role="group"
        aria-label={`Guitar neck, six strings and ${frets} frets. Press a string to play it, or drag across to strum.`}
        onPointerDown={(e) => {
          (e.target as Element).releasePointerCapture?.(e.pointerId);
          const at = where(e);
          last.current = { s: at.s, held: true };
          strike(at.s, at.f);
        }}
        onPointerMove={(e) => {
          const at = where(e);
          if (e.pointerType === "mouse") setHover(at);
          if (last.current.held && (e.buttons === 1 || e.pointerType !== "mouse") && at.s !== last.current.s) {
            last.current.s = at.s;
            strike(at.s, at.f);
          }
        }}
        onPointerUp={() => (last.current.held = false)}
        onPointerLeave={() => {
          last.current.held = false;
          setHover(null);
        }}
      >
        <rect x={NUT} y={TOP - 12} width={frets * FRET + 6} height={GAP * 5 + 24} rx="6" className="neck-wood" />
        {[3, 5, 7, 9].filter((f) => f <= frets).map((f) => (
          <circle key={f} cx={NUT + (f - 0.5) * FRET} cy={height / 2} r="5.5" className="neck-dot" />
        ))}
        {frets >= 12 && [TOP + GAP, TOP + GAP * 4].map((y) => <circle key={y} cx={NUT + 11.5 * FRET} cy={y} r="5.5" className="neck-dot" />)}
        <rect x={NUT - 5} y={TOP - 12} width="6" height={GAP * 5 + 24} rx="2" className="neck-nut" />
        {Array.from({ length: frets }, (_, f) => (
          <line key={f} x1={NUT + (f + 1) * FRET} x2={NUT + (f + 1) * FRET} y1={TOP - 12} y2={TOP + GAP * 5 + 12} className="neck-fret" />
        ))}
        {OPEN.map((open, s) => {
          const ring = rung.find((r) => r.s === s);
          const lit = !!ring || !!down[open];
          return (
            <g key={s}>
              <line key={ring?.id ?? "still"} x1={0} x2={width} y1={TOP + s * GAP} y2={TOP + s * GAP} strokeWidth={GAUGE[s]} className="neck-string" data-ring={lit} data-hover={hover?.s === s} />
              <text x="6" y={TOP + s * GAP + 3.5} className="neck-name">
                {NAMES[((open % 12) + 12) % 12]}
              </text>
            </g>
          );
        })}
        {hover && !rung.some((r) => r.s === hover.s && r.f === hover.f) && <circle cx={stopX(hover.f)} cy={TOP + hover.s * GAP} r="8" className="neck-ghost" />}
        {rung.map((r) => (
          <circle key={r.id} cx={stopX(r.f)} cy={TOP + r.s * GAP} r="8.5" className="neck-finger" />
        ))}
      </svg>
    </div>
  );
}

// A drum kit seen from above.
const KIT: { kind: Drum; name: string; x: number; y: number; r: number; cymbal?: boolean; key: string }[] = [
  { kind: "crash", name: "Crash", x: 62, y: 52, r: 40, cymbal: true, key: "q" },
  { kind: "ride", name: "Ride", x: 272, y: 60, r: 44, cymbal: true, key: "p" },
  { kind: "tom", name: "Tom", x: 138, y: 62, r: 27, key: "t" },
  { kind: "tom2", name: "Tom", x: 198, y: 62, r: 29, key: "y" },
  { kind: "hat", name: "Hi-hat", x: 40, y: 134, r: 29, cymbal: true, key: "h" },
  { kind: "snare", name: "Snare", x: 108, y: 146, r: 33, key: "s" },
  { kind: "floor", name: "Floor tom", x: 266, y: 150, r: 36, key: "f" },
  { kind: "kick", name: "Kick", x: 186, y: 162, r: 42, key: "k" },
];
export function DrumKit() {
  const [hits, setHits] = useState<Record<string, number>>({});
  const hit = (kind: Drum) => {
    wantSound(); // hitting a drum is asking for sound
    drum(kind);
    setHits((h) => ({ ...h, [kind]: (h[kind] ?? 0) + 1 }));
  };
  const live = useRef(hit);
  live.current = hit;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName ?? "") || !hasKeys("drums")) return;
      const pad = KIT.find((p) => p.key === e.key.toLowerCase());
      if (pad) live.current(pad.kind);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const kit = useRef<HTMLDivElement>(null);
  useEffect(() => claimKeys("drums", kit.current!), []);
  return (
    <div className="ins-kit-wrap" ref={kit} data-nowrap>
      <svg viewBox="0 0 330 214" className="ins-kit" role="group" aria-label="Drum kit, seen from above">
        {KIT.map((p) => (
          <g
            key={p.kind}
            className={p.cymbal ? "kit-pad cymbal" : "kit-pad"}
            role="button"
            tabIndex={0}
            aria-label={p.name}
            style={{ transformOrigin: `${p.x}px ${p.y}px` }}
            onPointerDown={() => hit(p.kind)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                hit(p.kind);
              }
            }}
          >
            <g key={hits[p.kind] ?? 0} className={hits[p.kind] ? "kit-hit" : undefined} style={{ transformOrigin: `${p.x}px ${p.y}px` }}>
              <circle cx={p.x} cy={p.y} r={p.r} className="kit-rim" />
              <circle cx={p.x} cy={p.y} r={p.r - (p.cymbal ? 0 : 5)} className="kit-head" />
              {p.cymbal && [0.72, 0.46].map((k) => <circle key={k} cx={p.x} cy={p.y} r={p.r * k} className="kit-groove" />)}
              {p.cymbal && <circle cx={p.x} cy={p.y} r={p.r * 0.16} className="kit-bell" />}
              {p.kind === "kick" && <circle cx={p.x} cy={p.y} r={p.r * 0.34} className="kit-groove" />}
              <text x={p.x} y={p.y + (p.cymbal ? p.r * 0.62 : 3)} textAnchor="middle" className="kit-name">
                {p.name}
              </text>
              <text x={p.x} y={p.y + (p.cymbal ? p.r * 0.62 : 3) + 9} textAnchor="middle" className="kit-key">
                {p.key.toUpperCase()}
              </text>
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
}

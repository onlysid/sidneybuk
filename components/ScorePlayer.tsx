"use client";

import { useEffect, useRef, useState } from "react";
import { playback } from "@/lib/playing";
import { audioNow, loadSounds, note, onSound, wantSound, type Instrument } from "@/lib/audio";
import { currentTheme, onTheme } from "@/lib/theme";

// One moment in the piece: when it happens (in whole notes from the start), which bar it is in, what sounds, and where the cursor sits on the page…
type Moment = { t: number; bar: number; notes: { midi: number; len: number; staff: number }[]; x: number; y: number; h: number; w: number };

const HANDS = ["Right hand", "Left hand"];
const pitch = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const NOTE = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const noteName = (midi: number) => `${NOTE[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
// The names of what sounds at a moment; with `hands`, only the notes of the hands that are switched on.
const namesOf = (m?: Moment, hands?: boolean[]) => namesFrom(m ? (hands ? m.notes.filter((n) => hands[Math.min(1, n.staff)]) : m.notes) : []);
const namesFrom = (notes: { midi: number }[]) => (notes.length ? [...new Set(notes.map((n) => n.midi))].sort((a, b) => a - b).map(noteName).join(" ") : "rest");

// The full score, drawn from a MusicXML file, with a digital performance of it: this site's own synthesised instrument plays every note in the file…
async function readScore(src: string) {
  if (src.startsWith("data:")) {
    const comma = src.indexOf(",");
    const body = src.slice(comma + 1);
    if (!/;base64/i.test(src.slice(0, comma))) return decodeURIComponent(body);
    return new TextDecoder().decode(Uint8Array.from(atob(body), (c) => c.charCodeAt(0)));
  }
  const r = await fetch(src);
  if (!r.ok) throw new Error("no score");
  return r.text();
}

export function ScorePlayer({ src, tempo, instrument = "piano", title, composer }: { src: string; tempo: number; instrument?: Instrument; title: string; composer?: string }) {
  const paper = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const osmd = useRef<any>(null);
  const moments = useRef<Moment[]>([]);
  const run = useRef({ index: 0, next: 0, from: 0, clock: 0, timer: 0, speed: 1, playing: false, hands: [true, true] });
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [at, setAt] = useState(0);
  const [total, setTotal] = useState(0);
  const [staves, setStaves] = useState(1);
  const [hands, setHands] = useState([true, true]);
  const [zoom, setZoom] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [ghost, setGhost] = useState<number | null>(null); // the moment under the pointer, or the one just touched
  const [keyTip, setKeyTip] = useState<number | null>(null);
  const ghostTimer = useRef(0), keyTimer = useRef(0);

  // Walk the whole piece once, repeats included, and write down what sounds when and where it is drawn.
  const survey = () => {
    const display = osmd.current;
    if (!display) return;
    const cursor = display.cursor;
    cursor.show();
    cursor.reset();
    const list: Moment[] = [];
    let most = 0;
    // Mark each drawn note with the staff it is on, so a hand that is switched off can be greyed out.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tag = (n: any, staff: number) => {
      try {
        display.EngravingRules.GNote(n)?.getSVGGElement?.()?.setAttribute("data-hand", String(Math.min(1, staff)));
      } catch {
        // Not drawn (a note hidden by the engraver): nothing to mark.
      }
    };
    for (let guard = 0; guard < 30000 && !cursor.iterator.EndReached; guard++) {
      const it = cursor.iterator;
      const notes: Moment["notes"] = [];
      for (const entry of it.CurrentVoiceEntries ?? []) {
        for (const n of entry.Notes ?? []) {
          if (n.isRest()) {
            tag(n, (n.ParentStaffEntry?.ParentStaff?.idInMusicSheet ?? 0) as number);
            continue;
          }
          const tie = n.NoteTie;
          if (tie && tie.StartNote !== n) continue; // the tail of a tied note has already been started
          const staff = (n.ParentStaffEntry?.ParentStaff?.idInMusicSheet ?? 0) as number;
          most = Math.max(most, staff);
          notes.push({ midi: n.halfTone + 12, len: entry.IsGrace ? 1 / 32 : ((tie ? tie.Duration : n.Length).RealValue as number), staff });
          tag(n, staff);
        }
      }
      const el = cursor.cursorElement as HTMLElement;
      // Read from what the engraver wrote on its cursor, never from the page itself: asking the page for a measurement here would make it lay itself out…
      const size = (name: string) => parseFloat(el.style.getPropertyValue(name)) || parseFloat(el.getAttribute(name) ?? "") || 0;
      list.push({ t: (it.CurrentEnrolledTimestamp ?? it.currentTimeStamp).RealValue as number, bar: (it.CurrentMeasureIndex as number) + 1, notes, x: size("left"), y: size("top"), h: size("height"), w: size("width") });
      cursor.next();
    }
    moments.current = list;
    setTotal(list.length);
    setStaves(most + 1);
    // The engraver's own cursor was only needed to find where everything is.
    cursor.reset();
    cursor.hide();
    run.current.index = Math.max(0, Math.min(run.current.index, list.length - 1));
    place(run.current.index);
  };
  const marker = useRef<HTMLElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const line = useRef(-1);
  const place = (index: number) => {
    const m = moments.current[index], el = marker.current;
    if (!m || !el) return;
    el.style.transform = `translate3d(${m.x}px, ${m.y}px, 0)`;
    el.style.height = `${m.h}px`;
    if (m.w) el.style.width = `${m.w}px`;
    el.style.opacity = "1";
  };

  const draw = (level: number, look: "light" | "dark") => {
    const display = osmd.current;
    if (!display || !paper.current) return;
    display.setOptions({ defaultColorMusic: "currentColor", cursorsOptions: [{ type: 0, color: "#c06ab8", alpha: 0.45, follow: false }] });
    // On a narrow screen the music runs right to the edge of its paper.
    const narrow = paper.current.clientWidth < 560;
    const rules = display.EngravingRules;
    rules.PageLeftMargin = narrow ? 1.6 : 4;
    rules.PageRightMargin = narrow ? 1.6 : 4;
    rules.PageTopMargin = narrow ? 2 : 4;
    display.zoom = (narrow ? 0.64 : 0.82) * 1.18 ** level;
    display.render();
    survey();
  };

  useEffect(() => {
    let dead = false;
    if (instrument === "piano" || instrument === "guitar") void loadSounds(instrument); // fetch the recorded instrument while the page is being engraved
    const look = currentTheme();
    setTheme(look);
    (async () => {
      try {
        const [{ OpenSheetMusicDisplay }, xml] = await Promise.all([import("opensheetmusicdisplay"), readScore(src)]);
        if (dead || !paper.current) return;
        const display = new OpenSheetMusicDisplay(paper.current, {
          autoResize: false,
          backend: "svg",
          drawTitle: false,
          drawSubtitle: false,
          drawComposer: false,
          drawLyricist: false,
          drawPartNames: false,
          drawCredits: false,
          drawMetronomeMarks: false, // the tempo is on the slider above, and can be changed there
          followCursor: false,
          cursorsOptions: [{ type: 0, color: "#c06ab8", alpha: 0.45, follow: false }],
        });
        await display.load(xml);
        if (dead) return;
        osmd.current = display;
        draw(0, look);
        setState("ready");
      } catch {
        if (!dead) setState("error");
      }
    })();
    // The music is drawn in "the colour of the text around it", so the stylesheet alone decides paper and ink and they can never disagree with the theme.
    const stopTheme = onTheme(setTheme);
    // Sound switched off in the menu stops the performance where it is.
    const stopSound = onSound((on) => !on && run.current.playing && pauseNow.current());
    // Re-engrave when the width changes (a phone turned on its side, a window resized).
    let width = paper.current?.clientWidth ?? 0, wait = 0;
    const watch = new ResizeObserver(() => {
      const now = paper.current?.clientWidth ?? 0;
      if (!osmd.current || Math.abs(now - width) < 8) return;
      width = now;
      window.clearTimeout(wait);
      wait = window.setTimeout(() => draw(zoomNow.current, currentTheme()), 250);
    });
    if (paper.current) watch.observe(paper.current);
    return () => {
      dead = true;
      stopTheme();
      stopSound();
      watch.disconnect();
      window.clearTimeout(wait);
      window.clearInterval(run.current.timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
  const zoomNow = useRef(0);

  const whole = () => 240 / (tempo * run.current.speed); // seconds in a whole note
  const elapsed = () => run.current.from + (audioNow() - run.current.clock) / whole();
  const sound = (m: Moment, delay: number) => {
    const w = whole();
    for (const n of m.notes) if (run.current.hands[Math.min(1, n.staff)]) ringing.current.push(note(pitch(n.midi), { instrument, gain: n.midi < 52 ? 0.16 : 0.12, length: Math.min(6, n.len * w + 0.06), delay })); // held for as long as written, then damped
    if (ringing.current.length > 160) ringing.current.splice(0, 80);
  };
  // Everything sounding, and everything already handed to the audio clock but not yet begun, stopped now.
  const ringing = useRef<(() => void)[]>([]);
  const hush = () => {
    for (const stop of ringing.current) stop();
    ringing.current = [];
  };

  // Keep the cursor in sight inside the scrolling page.
  const follow = (force = false) => {
    const m = moments.current[run.current.index], view = scroller.current;
    if (!m || !view || !sheet.current) return;
    if (!force && m.y === line.current) return;
    line.current = m.y;
    const top = sheet.current.offsetTop + m.y - view.scrollTop;
    if (top < 20 || top > view.clientHeight * 0.55) view.scrollTo({ top: view.scrollTop + top - 40, behavior: "smooth" });
  };

  const pause = () => {
    const r = run.current;
    window.clearInterval(r.timer);
    r.playing = false;
    r.from = moments.current[r.index]?.t ?? 0;
    hush();
    setPlaying(false);
    playback.patch(dockId, { playing: false });
  };

  const pauseNow = useRef(pause);
  pauseNow.current = pause;

  // The name of what is sounding is written straight onto the page, without waiting for the whole player to redraw: in quick passages a redraw can…
  const noteEl = useRef<HTMLElement>(null);
  // The bar at the bottom of the screen is told where the music is, so it can show and move it.
  const dockId = useRef(`score:${src.slice(0, 80)}`).current;
  const report = (index: number) => {
    const list = moments.current, m = list[index];
    if (!m) return;
    playback.progress(dockId, list.length > 1 ? index / (list.length - 1) : 0, `Bar ${m.bar} of ${list[list.length - 1].bar}`);
  };
  const say = (index: number) => {
    if (noteEl.current) noteEl.current.textContent = namesOf(moments.current[index], run.current.hands);
    report(index);
  };

  const tick = () => {
    const r = run.current, list = moments.current, now = elapsed(), w = whole();
    // Hand the next fifth of a second of notes to the audio clock, so timing does not depend on this timer.
    while (r.next < list.length && list[r.next].t <= now + 0.18 / w) {
      sound(list[r.next], Math.max(0, (list[r.next].t - now) * w));
      r.next += 1;
    }
    let moved = false;
    // A hair early, so the name is on the screen as the note sounds and not a frame after it.
    while (r.index + 1 < list.length && list[r.index + 1].t <= now + 0.02 / w) {
      r.index += 1;
      moved = true;
    }
    if (moved) {
      say(r.index);
      place(r.index);
      setAt(r.index);
      follow();
    }
    const last = list[list.length - 1];
    if (r.index >= list.length - 1 && now > last.t + Math.max(0.25, ...last.notes.map((n) => n.len))) {
      pause();
      seek(0);
      playback.clear(dockId);
    }
  };

  const play = () => {
    const r = run.current, list = moments.current;
    if (!list.length) return;
    wantSound(); // pressing play is asking for sound
    r.from = list[r.index].t;
    r.clock = audioNow() + 0.08;
    r.next = r.index;
    r.playing = true;
    r.timer = window.setInterval(tick, 16);
    setPlaying(true);
    playback.set({
      id: dockId,
      title,
      sub: composer,
      playing: true,
      toggle: () => (run.current.playing ? pauseNow.current() : playNow.current()),
      seek: (f) => seekNow.current(Math.round(f * (moments.current.length - 1))),
      stop: () => {
        if (run.current.playing) pauseNow.current();
        playback.clear(dockId);
      },
      show: () => scroller.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
    });
    report(r.index);
  };
  const playNow = useRef(play);
  playNow.current = play;

  // `scroll` is off when the place was chosen by touching the music: it is already in view, and should stay put.
  const seek = (index: number, hear = false, scroll = true) => {
    const r = run.current;
    if (!osmd.current || !moments.current[index]) return;
    const was = r.playing;
    if (was) pause();
    hush(); // whatever was still ringing from where the music was
    r.index = index;
    place(index);
    setAt(index);
    if (scroll) follow(true);
    if (was) play();
    else if (hear && moments.current[index]) (wantSound(), sound(moments.current[index], 0));
    report(index);
  };
  const seekNow = useRef(seek);
  seekNow.current = seek;
  // Leaving the page takes the music with it, so the bar lets go too.
  useEffect(() => () => playback.clear(dockId), [dockId]);

  // Tapping the music moves to the nearest moment on the line that was tapped.
  const nearest = (e: { clientX: number; clientY: number }) => {
    if (state !== "ready" || !paper.current) return -1;
    const box = paper.current.getBoundingClientRect();
    const x = e.clientX - box.left, y = e.clientY - box.top;
    let best = -1, far = Infinity;
    moments.current.forEach((m, k) => {
      const off = y < m.y ? m.y - y : y > m.y + m.h ? y - (m.y + m.h) : 0;
      const d = off * 4 + Math.abs(m.x + 8 - x);
      if (d < far) {
        far = d;
        best = k;
      }
    });
    return best;
  };
  const tap = (e: React.MouseEvent) => {
    const best = nearest(e);
    if (best < 0) return;
    seek(best, true, false);
    // Say what was touched, for a moment.
    setGhost(best);
    window.clearTimeout(ghostTimer.current);
    ghostTimer.current = window.setTimeout(() => setGhost(null), 1800);
  };
  const hover = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    window.clearTimeout(ghostTimer.current);
    const best = nearest(e);
    setGhost(best < 0 ? null : best);
  };
  // Left and right step a bar at a time, space plays and pauses, Home goes back to the top.
  const keys = (e: React.KeyboardEvent) => {
    if (state !== "ready" || (e.target as HTMLElement).tagName === "INPUT" || e.metaKey || e.ctrlKey || e.altKey) return;
    const list = moments.current, bar = list[at]?.bar ?? 1;
    if (e.key === " " && (e.target as HTMLElement).tagName !== "BUTTON") (e.preventDefault(), playing ? pause() : play());
    else if (e.key === "ArrowRight") {
      const next = list.findIndex((m) => m.bar > bar);
      if (next >= 0) (e.preventDefault(), seek(next, !playing));
    } else if (e.key === "ArrowLeft") {
      const start = list.findIndex((m) => m.bar === bar);
      const to = at > start ? start : Math.max(0, list.findIndex((m) => m.bar === bar - 1));
      e.preventDefault();
      seek(to, !playing);
    } else if (e.key === "Home") (e.preventDefault(), seek(0));
  };
  // A key on the little keyboard, pressed: hear it and name it.
  const strike = (midi: number) => {
    wantSound();
    note(pitch(midi), { force: true, instrument, gain: 0.16, length: 0.9 });
    setKeyTip(midi);
    window.clearTimeout(keyTimer.current);
    keyTimer.current = window.setTimeout(() => setKeyTip(null), 1100);
  };

  const changeSpeed = (value: number) => {
    const r = run.current;
    if (r.playing) {
      r.from = elapsed();
      r.clock = audioNow();
    }
    r.speed = value;
    setSpeed(value);
  };
  const zoomWait = useRef(0);
  const changeZoom = (by: number) => {
    const next = Math.max(-2, Math.min(3, zoomNow.current + by));
    zoomNow.current = next;
    setZoom(next);
    window.clearTimeout(zoomWait.current);
    zoomWait.current = window.setTimeout(() => draw(next, theme), 220);
  };
  const toggleHand = (k: number) => {
    const next = hands.map((on, j) => (j === k ? !on : on));
    if (!next.some(Boolean)) return;
    run.current.hands = next;
    setHands(next);
    say(run.current.index);
  };

  const now = moments.current[at];
  const showsNote = !!now && (playing || at > 0);
  useEffect(() => say(run.current.playing ? run.current.index : at), [at, showsNote]);
  const bars = moments.current.length ? Math.max(...moments.current.map((m) => m.bar)) : 0;
  const lit = new Map<number, number>();
  if (now && (playing || at > 0)) for (const n of now.notes) if (hands[Math.min(1, n.staff)]) lit.set(n.midi, Math.min(1, n.staff));

  return (
    <div className="mu-score" data-state={state} data-look={theme} data-off={hands.map((on, k) => (on ? "" : String(k))).join(" ").trim() || undefined} tabIndex={0} onKeyDown={keys} aria-label={`The score of ${title}. Space plays and pauses, the left and right arrows step a bar.`}>
      <div className="mu-deck">
        <button type="button" className="mu-play" disabled={state !== "ready"} onClick={() => (playing ? pause() : play())} aria-label={playing ? "Pause" : at > 0 ? "Carry on playing" : `Play ${title}`}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            {playing ? <path d="M7 5h3.500v14H7zM13.500 5H17v14h-3.500z" /> : <path d="M8.500 5.200v13.600L19 12z" />}
          </svg>
        </button>
        <div className="mu-deck-main">
          <div className="mu-deck-top">
            <span className="mono">
              {now ? `Bar ${now.bar} of ${bars}` : state === "loading" ? "Engraving…" : ""}
              {now && (playing || at > 0) && <b ref={noteEl} />}
            </span>
            <button type="button" className="mu-again" data-tip="From the top" aria-label="Play from the top" disabled={state !== "ready" || at === 0} onClick={() => seek(0)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 12a8 8 0 1 0 2.600-5.900M4 4v4.500h4.500" />
              </svg>
            </button>
          </div>
          <input className="mu-range" style={{ ["--p" as string]: `${(at / Math.max(1, total - 1)) * 100}%` }} type="range" min={0} max={Math.max(1, total - 1)} value={at} disabled={state !== "ready"} onChange={(e) => seek(Number(e.target.value))} aria-label={`Position in ${title}`} />
        </div>
      </div>
      <div className="mu-tools">
        {staves > 1 &&
          HANDS.map((name, k) => (
            <button key={name} type="button" className="mu-hand" data-hand={k} aria-pressed={hands[k]} disabled={state !== "ready"} onClick={() => toggleHand(k)} data-tip={hands[k] ? `Silence the ${name.toLowerCase()}` : `Hear the ${name.toLowerCase()}`}>
              <i aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 9.500v5h3.500l4.500 4v-13l-4.500 4z" fill="currentColor" stroke="none" />
                  {hands[k] ? <path d="M15.500 9a4.200 4.200 0 0 1 0 6M18 6.500a7.800 7.800 0 0 1 0 11" /> : <path d="M15.500 9.500l5 5M20.500 9.500l-5 5" />}
                </svg>
              </i>
              {name}
            </button>
          ))}
        <div className="mu-stepper" role="group" aria-label="Size of the music">
          <button type="button" disabled={state !== "ready" || zoom <= -2} onClick={() => changeZoom(-1)} aria-label="Smaller music" data-tip="Smaller">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 12h12" />
            </svg>
          </button>
          <span className="mono" key={zoom}>{Math.round(1.18 ** zoom * 100)}%</span>
          <button type="button" disabled={state !== "ready" || zoom >= 3} onClick={() => changeZoom(1)} aria-label="Bigger music" data-tip="Bigger">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 12h12M12 6v12" />
            </svg>
          </button>
        </div>
        <label className="mu-tempo" data-tip="Slow it down to practise">
          <span className="mono">Tempo</span>
          <input className="mu-range" style={{ ["--p" as string]: `${((speed - 0.4) / 1.1) * 100}%` }} type="range" min={0.4} max={1.5} step={0.05} value={speed} onChange={(e) => changeSpeed(Number(e.target.value))} aria-label="Tempo" />
          <b className="mono">{Math.round(tempo * speed)} bpm</b>
        </label>
      </div>
      <div className="mu-paper" ref={scroller}>
        {state === "loading" && <p className="mu-paper-note">Engraving the score…</p>}
        {state === "error" && <p className="mu-paper-note">The score could not be loaded.</p>}
        {state === "ready" && (
          <header className="mu-sheet-head">
            <b>{title}</b>
            {composer && <span>{composer}</span>}
          </header>
        )}
        <div className="mu-sheet" ref={sheet} onPointerMove={hover} onPointerLeave={(e) => e.pointerType === "mouse" && setGhost(null)}>
          <div ref={paper} onClick={tap} />
          <i className="mu-cursor" ref={marker} aria-hidden="true" />
          {ghost !== null && moments.current[ghost] && ghost !== at && (
            <i className="mu-ghost" style={{ left: moments.current[ghost].x, top: moments.current[ghost].y, height: moments.current[ghost].h }} aria-hidden="true" />
          )}
          {ghost !== null && moments.current[ghost] && (
            <span className="mu-tip" style={{ left: moments.current[ghost].x + 8, top: moments.current[ghost].y }} role="status">
              <b>Bar {moments.current[ghost].bar}</b>
              {namesOf(moments.current[ghost])}
            </span>
          )}
        </div>
      </div>
      <div className="mu-live-wrap">
        {keyTip !== null && (
          <span className="mu-tip mu-key-tip" key={keyTip} style={{ left: `${(([0, 0.5, 1, 1.5, 2, 3, 3.5, 4, 4.5, 5, 5.5, 6][keyTip % 12] + (Math.floor(keyTip / 12) - 1) * 7 - 5 + 0.5) / 52) * 100}%` }}>
            <b>{noteName(keyTip)}</b>
          </span>
        )}
        <svg viewBox="0 0 520 34" className="mu-live" preserveAspectRatio="none" role="group" aria-label="A piano keyboard showing the notes being played. Press a key to hear it.">
          {Array.from({ length: 52 }, (_, w) => {
            // 52 white keys, A0 to C8.
            const midi = 21 + Math.floor((w + 5) / 7) * 12 + [0, 2, 4, 5, 7, 9, 11][(w + 5) % 7] - 9;
            return <rect key={midi} x={w * 10 + 0.2} y="0.5" width="9.6" height="33" rx="1.5" className="live-white" data-hand={lit.get(midi)} data-on={keyTip === midi} onPointerDown={() => strike(midi)} />;
          })}
          {Array.from({ length: 51 }, (_, w) => {
            if (![0, 1, 3, 4, 5].includes((w + 5) % 7)) return null;
            const midi = 21 + Math.floor((w + 5) / 7) * 12 + [0, 2, 4, 5, 7, 9, 11][(w + 5) % 7] - 9 + 1;
            return <rect key={midi} x={w * 10 + 7} y="0.5" width="6" height="20" rx="1" className="live-black" data-hand={lit.get(midi)} data-on={keyTip === midi} onPointerDown={() => strike(midi)} />;
          })}
        </svg>
      </div>
      <p className="mu-score-tip">Tap anywhere in the music to move there and hear it. Switch a hand off to hear the other on its own. The keys underneath play too. With a keyboard: space plays and pauses, and the arrows step a bar.{instrument === "piano" ? " The piano is the Salamander Grand Piano, recorded by Alexander Holm (CC BY 3.0)." : instrument === "guitar" ? " The guitar was recorded at the University of Iowa Electronic Music Studios and edited by Nicholaus Brosowsky (CC BY 3.0)." : ""}</p>
    </div>
  );
}

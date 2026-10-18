"use client";

import { Pill } from "@/components/Pill";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/admin/api";
import type { Entry } from "@/lib/admin/kinds";
import { note } from "@/lib/audio";
import { Pick } from "@/components/Sport";
import { Sheet } from "./Ask";
import { Grow, Tabs } from "./Motion";
import { KEYS, LENGTHS, TIMES, barLength, barsOf, blankDraft, freqOf, isDraft, nameOf, soundsOf, toMusicXML, type Draft, type Ev } from "@/lib/score-draft";

// Writing a piece's score in the admin area.
//
// The idea is the one a pencil has: pick how long the note lasts, then say which note. Notes go in one after
// another at the cursor, in whichever hand is chosen; bar lines, ties, beams and accidentals look after
// themselves. The engraved page is the real thing, drawn from the same MusicXML the site will use.
//
// Nothing is lost by stopping. Every change is kept at once in this browser and, a moment later, with the
// piece on the server (as a draft, `scoreDraft`), so a score can be written over many sittings and on more
// than one device. The piece's page only changes when "Put it on the site" is pressed.
//
//   On screen       tap a length, then tap the piano. "Chord" adds the next taps to the same note.
//   On a keyboard   A to G for notes (the nearest one to the last), 1 2 4 8 6 for semibreve to semiquaver,
//                   . for a dot, R for a rest, arrows to move, up and down to shift a note, Backspace to
//                   delete, Tab for the other hand, Space to play.
const SEMITONE: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const KEY_LENGTH: Record<string, number> = { "1": 16, "2": 8, "4": 4, "8": 2, "6": 1 };
const BLACK = new Set([1, 3, 6, 8, 10]);
const HAND = ["Right hand", "Left hand"];
const WHITE = [0, 2, 4, 5, 7, 9, 11];
// A short fingerprint of a draft, to tell whether what is on the site is what is being looked at.
const markOf = (d: Draft) => {
  // Written out in a fixed order: the database hands a draft back with its parts in a different order from the one it was given, and that must not…
  const text = JSON.stringify([d.fifths, d.beats, d.beatType, d.tempo, d.hands, d.staves.map((hand) => hand.map((e) => [e.d, e.p]))]);
  let h = 5381;
  for (const ch of text) h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
  return String(h);
};
const localKey = (id: string) => `score-draft:${id}`;

// A note of a given length, drawn the way it is written: open or filled head, stem, flags, dot.
function Glyph({ d }: { d: number }) {
  const kind = LENGTHS.find((l) => l.d === d);
  const base = kind?.dot ? (d * 2) / 3 : d;
  const open = base >= 8, stem = base < 16, flags = base === 2 ? 1 : base === 1 ? 2 : 0;
  return (
    <svg viewBox="0 0 24 30" width="20" height="25" aria-hidden="true" className="sc-glyph">
      <ellipse cx="9" cy="23" rx="5.6" ry="4" transform="rotate(-20 9 23)" fill={open ? "none" : "currentColor"} stroke="currentColor" strokeWidth={open ? 1.8 : 0} />
      {stem && <path d="M14.2 22V4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
      {flags >= 1 && <path d="M14.2 4c1 4 5.5 4.5 5 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
      {flags >= 2 && <path d="M14.2 9c1 4 5.5 4.5 5 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
      {kind?.dot && <circle cx="19.5" cy="23.5" r="1.7" fill="currentColor" />}
    </svg>
  );
}

export function ScoreEditor({ id, onSaved, say }: { id: string; onSaved: (href: string) => void; say: (text: string, bad?: boolean) => void }) {
  const [piece, setPiece] = useState<Entry | null>(null);
  const [missing, setMissing] = useState(false);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [hand, setHand] = useState(0);
  const [at, setAt] = useState([0, 0]); // in each hand, how many events come before the cursor
  const [pen, setPen] = useState(4); // the length the next note gets
  const [chord, setChord] = useState(false);
  const [picked, setPicked] = useState(false); // I chose a note by tapping it: lengths now change that note
  const [octave, setOctave] = useState([4, 2]); // the lowest C on the piano, for each hand
  const [stored, setStored] = useState<"saved" | "waiting" | "saving" | "failed">("saved");
  const [busy, setBusy] = useState(false);
  const [keysWide, setKeysWide] = useState(8); // how many white keys fit
  const pianoBox = useRef<HTMLDivElement>(null);
  const pieceNow = useRef<Entry | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [playing, setPlaying] = useState(false);
  const [setup, setSetup] = useState(false);
  const past = useRef<Draft[]>([]);
  const paper = useRef<HTMLDivElement>(null);
  const stops = useRef<(() => void)[]>([]);
  const timer = useRef(0);

  useEffect(() => {
    let live = true;
    api.get(id).then(
      (e) => {
        if (!live) return;
        setPiece(e);
        pieceNow.current = e;
        let d: Draft = isDraft(e.data.scoreDraft) ? e.data.scoreDraft : { ...blankDraft(), tempo: Number(e.data.tempo) || 90 };
        // Work kept in this browser that never reached the server (the connection dropped, the tab was shut).
        try {
          const kept = JSON.parse(window.localStorage.getItem(localKey(id)) ?? "null") as { draft: Draft; at: string } | null;
          if (kept && isDraft(kept.draft) && kept.at > e.updatedAt && markOf(kept.draft) !== markOf(d)) {
            d = kept.draft;
            setStored("waiting");
          }
        } catch {}
        setDraft(d);
        setAt([d.staves[0].length, d.staves[1].length]);
      },
      () => live && setMissing(true),
    );
    return () => void (live = false);
  }, [id]);

  // ---- Changing the draft ---------------------------------------------------------------------------------
  const change = useCallback((next: Draft) => {
    setDraft((was) => {
      past.current = [...past.current.slice(-80), was];
      return next;
    });
    setStored("waiting");
  }, []);
  const events = draft.staves[hand] ?? [];
  const cursor = Math.min(at[hand], events.length);
  const current = cursor > 0 ? events[cursor - 1] : null;
  const withHand = (list: Ev[]): Draft => ({ ...draft, staves: hand === 0 ? [list, draft.staves[1]] : [draft.staves[0], list] });
  // Where the cursor is, in each hand.
  const moveTo = (n: number, h = hand) => setAt((was) => was.map((v, k) => (k === h ? Math.max(0, n) : v)));
  const hear = (midis: number[], d = 4) => midis.forEach((m) => note(freqOf(m), { instrument: "piano", force: true, gain: 0.16, length: Math.min(1.6, (d / 4) * (60 / draft.tempo)) }));

  const enter = (midi: number) => {
    if (chord && current && current.p.length) {
      // Add to (or take out of) the note the cursor is after.
      const p = current.p.includes(midi) ? current.p.filter((m) => m !== midi) : [...current.p, midi];
      if (!p.length) return;
      change(withHand(events.map((e, n) => (n === cursor - 1 ? { ...e, p } : e))));
      hear(p, current.d);
      return;
    }
    change(withHand([...events.slice(0, cursor), { d: pen, p: [midi] }, ...events.slice(cursor)]));
    moveTo(cursor + 1);
    setPicked(false);
    hear([midi], pen);
  };
  const rest = () => {
    change(withHand([...events.slice(0, cursor), { d: pen, p: [] }, ...events.slice(cursor)]));
    moveTo(cursor + 1);
    setPicked(false);
  };
  const remove = () => {
    if (!current) return;
    change(withHand(events.filter((_, n) => n !== cursor - 1)));
    moveTo(cursor - 1);
  };
  const lengthen = (d: number) => {
    setPen(d);
    if (picked && current) change(withHand(events.map((e, n) => (n === cursor - 1 ? { ...e, d } : e))));
  };
  const dot = () => {
    const dotted = LENGTHS.find((l) => l.d === pen * 1.5 && l.dot), plain = LENGTHS.find((l) => l.dot && l.d === pen);
    if (plain) lengthen((pen * 2) / 3);
    else if (dotted) lengthen(dotted.d);
  };
  const shift = (by: number) => {
    if (!current?.p.length) return;
    const p = current.p.map((m) => Math.max(21, Math.min(108, m + by)));
    change(withHand(events.map((e, n) => (n === cursor - 1 ? { ...e, p } : e))));
    hear(p, current.d);
  };
  const undo = () => {
    const was = past.current.pop();
    if (!was) return;
    setDraft(was);
    setAt((a) => a.map((v, k) => Math.min(v, was.staves[k].length)));
    setStored("waiting");
  };
  // A letter means the note of that name nearest to the last one written in this hand.
  const letter = (name: string) => {
    const last = [...events.slice(0, cursor)].reverse().find((e) => e.p.length)?.p[0] ?? (hand ? 48 : 60);
    const pc = SEMITONE[name];
    let midi = last - (((last % 12) - pc + 12) % 12);
    if (last - midi > 6) midi += 12;
    enter(midi);
  };

  // ---- Playing it back, and showing where it has got to ------------------------------------------------------
  const [now, setNow] = useState(-1); // while playing: how far in, in semiquavers. -1 when not playing
  const frame = useRef(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shown = useRef<any>(null); // the engraving, once drawn (for its cursor)
  const stop = useCallback(() => {
    window.cancelAnimationFrame(frame.current);
    stops.current.forEach((s) => s());
    stops.current = [];
    setPlaying(false);
    setNow(-1);
  }, []);
  const play = () => {
    if (playing) return stop();
    const sounds = soundsOf(draft);
    if (!sounds.length) return;
    const unit = 60 / draft.tempo / 4; // seconds in a semiquaver
    const lead = 0.12;
    stops.current = sounds.map((s) => note(freqOf(s.midi), { instrument: "piano", force: true, gain: s.midi < 52 ? 0.16 : 0.12, delay: s.at * unit + lead, length: Math.min(6, s.d * unit + 0.05) }));
    setPlaying(true);
    const end = Math.max(...sounds.map((s) => s.at + s.d));
    const began = performance.now();
    const tick = () => {
      const at = ((performance.now() - began) / 1000 - lead) / unit;
      if (at >= end) return stop();
      setNow(Math.max(0, at));
      frame.current = window.requestAnimationFrame(tick);
    };
    frame.current = window.requestAnimationFrame(tick);
  };
  useEffect(() => stop, [stop]);

  // ---- The engraved page ----------------------------------------------------------------------------------
  const xml = useMemo(() => toMusicXML(draft, { title: String(piece?.data.title ?? ""), composer: String(piece?.data.composer ?? "") }), [draft, piece]);
  const empty = !draft.staves[0].length && !draft.staves[1].length;
  useEffect(() => {
    if (!paper.current || !piece) return;
    let live = true;
    const wait = window.setTimeout(async () => {
      try {
        const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay");
        if (!live || !paper.current) return;
        const holder = document.createElement("div");
        const display = new OpenSheetMusicDisplay(holder, { autoResize: false, backend: "svg", drawTitle: false, drawSubtitle: false, drawComposer: false, drawLyricist: false, drawPartNames: false, drawMetronomeMarks: true, followCursor: false });
        display.setOptions({ defaultColorMusic: "currentColor", cursorsOptions: [{ type: 0, color: "#c06ab8", alpha: 0.4, follow: false }] });
        // Drawn off to one side at the paper's width, then swapped in, so the page never flashes empty.
        holder.style.width = `${paper.current.clientWidth}px`;
        holder.style.position = "absolute";
        holder.style.visibility = "hidden";
        document.body.appendChild(holder);
        await display.load(xml);
        display.zoom = paper.current.clientWidth < 560 ? 0.7 : 0.9;
        display.render();
        holder.style.cssText = "";
        if (live && paper.current) {
          holder.style.position = "relative";
          paper.current.replaceChildren(holder);
          shown.current = display;
          setDrawn((n) => n + 1);
        }
        else holder.remove();
      } catch (err) {
        console.error(err);
      }
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(wait);
    };
  }, [xml, piece]);

  // The bar on the page: at the place being played, or else where the next note will go.
  const [drawn, setDrawn] = useState(0);
  const stamps = useMemo(() => {
    // Every moment something is written at (a note or a rest, in either hand), in order: the steps the bar takes.
    const length = barLength(draft), all = new Set<number>();
    (draft.hands === 2 ? [0, 1] : [0]).forEach((h) => {
      barsOf(draft.staves[h] ?? [], length).forEach((bar, m) => {
        let at = m * length;
        for (const seg of bar) (all.add(at), (at += seg.d));
      });
    });
    const count = Math.max(1, ...[0, 1].map((h) => Math.ceil((draft.staves[h] ?? []).reduce((a, e) => a + e.d, 0) / length)));
    for (let m = 0; m < count; m++) all.add(m * length); // an empty bar still has its rest
    return [...all].sort((a, b) => a - b);
  }, [draft]);
  const cursorTime = events.slice(0, cursor).reduce((a, e) => a + e.d, 0);
  const lookAt = now >= 0 ? now : cursorTime;
  const step = Math.max(0, stamps.filter((t) => t <= lookAt + 1e-6).length - 1);
  const atEnd = now < 0 && lookAt > (stamps[stamps.length - 1] ?? 0);
  useEffect(() => {
    const display = shown.current;
    if (!display?.cursor || empty) return;
    try {
      const c = display.cursor;
      c.show();
      c.reset();
      for (let n = 0; n < step && !c.iterator.EndReached; n++) c.next();
      const el = c.cursorElement as HTMLElement | undefined;
      if (el) {
        // Past the last note there is nothing to stand on: the bar waits just after it instead.
        el.style.transform = atEnd ? "translateX(22px)" : "";
        el.style.borderRadius = "4px";
        const box = paper.current?.parentElement;
        if (box) {
          const top = el.offsetTop, bottom = top + el.offsetHeight;
          if (top < box.scrollTop + 8 || bottom > box.scrollTop + box.clientHeight - 8) box.scrollTo({ top: Math.max(0, top - 24), behavior: now >= 0 ? "smooth" : "auto" });
        }
      }
    } catch {}
  }, [step, drawn, atEnd, empty, now >= 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // The row of written notes follows along: to the cursor as notes go in, to the sounding note while playing.
  const strip = useRef<HTMLDivElement>(null);
  const sounding = now >= 0 ? Math.floor(now * 2) : -1;
  useEffect(() => {
    const box = strip.current;
    const el = box?.querySelector<HTMLElement>(now >= 0 ? '[data-sounding="true"]' : '[data-at="true"]');
    if (!box || !el) return;
    const left = el.offsetLeft, want = left - box.clientWidth / 2 + el.offsetWidth / 2;
    if (left < box.scrollLeft + 24 || left + el.offsetWidth > box.scrollLeft + box.clientWidth - 24) box.scrollTo({ left: Math.max(0, want), behavior: "smooth" });
  }, [cursor, hand, events.length, sounding]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Keys ---------------------------------------------------------------------------------------------------
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  keys.current = (e) => {
    const el = e.target as HTMLElement;
    if (el.closest("input, select, textarea, .ask") || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (e.ctrlKey) {
      if (k === "z") (e.preventDefault(), undo());
      return;
    }
    if (k in SEMITONE) letter(k);
    else if (k in KEY_LENGTH) lengthen(KEY_LENGTH[k]);
    else if (k === ".") dot();
    else if (k === "r" || k === "0") rest();
    else if (k === "backspace" || k === "delete") remove();
    else if (k === "arrowleft") (moveTo(cursor - 1), setPicked(true));
    else if (k === "arrowright") (moveTo(Math.min(events.length, cursor + 1)), setPicked(true));
    else if (k === "arrowup") shift(e.shiftKey ? 12 : 1);
    else if (k === "arrowdown") shift(e.shiftKey ? -12 : -1);
    else if (k === "tab" && draft.hands === 2) setHand(hand ? 0 : 1);
    else if (k === " ") play();
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  // ---- Keeping it ---------------------------------------------------------------------------------------------- At once, in this browser.
  useEffect(() => {
    if (stored !== "waiting") return;
    try {
      window.localStorage.setItem(localKey(id), JSON.stringify({ draft, at: new Date().toISOString() }));
    } catch {}
  }, [draft, stored, id]);
  // A moment after the last change, with the piece on the server. One save at a time, in order.
  const keep = useCallback((d: Draft, extra: Record<string, unknown> = {}) => {
    const run = async () => {
      const p = pieceNow.current;
      if (!p) return;
      const saved = await api.save("piece", { id: p.id, slug: p.slug, data: { ...p.data, scoreDraft: d, ...extra }, published: p.published, position: p.position });
      pieceNow.current = saved;
      setPiece(saved);
      return saved;
    };
    const next = queue.current.then(run, run);
    queue.current = next.catch(() => {});
    return next;
  }, []);
  useEffect(() => {
    if (stored !== "waiting" || !piece) return;
    // Back to exactly what is already kept: nothing to do.
    if (isDraft(piece.data.scoreDraft) && markOf(piece.data.scoreDraft) === markOf(draft)) return setStored("saved");
    const wait = window.setTimeout(() => {
      const mine = draft;
      setStored("saving");
      keep(mine).then(
        () => setStored((now) => (now === "saving" ? "saved" : now)),
        () => setStored("failed"),
      );
    }, 1500);
    return () => window.clearTimeout(wait);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, stored]);

  // Makes the MusicXML file and puts it on the piece's page.
  const publish = async () => {
    const p = pieceNow.current;
    if (!p || busy) return;
    setBusy(true);
    try {
      const made = await api.upload(new File([xml], `${p.slug}.musicxml`, { type: "application/vnd.recordare.musicxml+xml" }));
      const before = String(p.data.score ?? ""), mine = !!p.data.scoreLive;
      await keep(draft, { score: made.url, scoreLive: markOf(draft), tempo: draft.tempo });
      setStored("saved");
      // The file this one replaces, if the editor made that too, is no longer needed.
      if (before && before !== made.url && mine) {
        const old = (await api.media().catch(() => [])).find((m) => m.url === before);
        if (old) await api.removeMedia(old.id).catch(() => {});
      }
      say("The score is on the piece's page now.");
    } catch (err) {
      say((err as Error).message, true);
    }
    setBusy(false);
  };

  // How many white keys fit across the screen, so each is wide enough for a finger.
  useEffect(() => {
    const el = pianoBox.current;
    if (!el) return;
    const measure = () => setKeysWide(Math.max(8, Math.min(15, Math.floor(el.clientWidth / 40))));
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, [piece]);

  // Moving the piano up or down slides the keys across, so it is plain which way it went.
  const track = useRef<HTMLDivElement>(null);
  const lowWas = useRef(octave[hand]);
  useEffect(() => {
    const by = Math.max(-1, Math.min(1, octave[hand] - lowWas.current));
    lowWas.current = octave[hand];
    const el = track.current;
    if (!by || !el || typeof el.animate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const home = -700 / (keysWide + 14);
    el.animate([{ transform: `translateX(${home + (by * 700) / (keysWide + 14)}%)` }, { transform: `translateX(${home}%)` }], { duration: 560, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
  }, [octave, hand, keysWide]);
  if (missing) return <p className="desk-help">That piece is not there.</p>;
  if (!piece) return <p className="desk-help">Loading…</p>;
  const length = barLength(draft);
  const low = octave[hand] * 12 + 12; // the MIDI number of the piano's lowest C
  // From that C up, until enough white keys have been laid out.
  const piano: number[] = [];
  // One more octave is laid out off each side, so the keys can slide when the piano moves up or down.
  for (let midi = Math.max(0, low - 12), whites = 0; whites < keysWide + 14; midi++) {
    piano.push(midi);
    if (WHITE.includes(midi % 12)) whites++;
  }
  const replacing = !!piece.data.score && !piece.data.scoreLive;
  const onSite = !!piece.data.scoreLive && piece.data.scoreLive === markOf(draft);
  const label = (ev: Ev) => (ev.p.length ? [...ev.p].sort((a, b) => a - b).map((m) => nameOf(m, draft.fifths)).join(" ") : "rest");
  const before = events.slice(0, cursor).reduce((a, e) => a + e.d, 0);
  const inBar = before % length, barNo = Math.floor(before / length) + 1;
  const total = (h: number) => Math.ceil((draft.staves[h] ?? []).reduce((a, e) => a + e.d, 0) / length);
  const keyName = KEYS.find(([f]) => f === draft.fifths)?.[1].split(" / ")[0] ?? "";

  return (
    <div className="sc">
      <p className="sc-status mono" data-state={stored}>
        <i aria-hidden="true" />
        {stored === "saved" ? "Your work is saved" : stored === "failed" ? "Could not reach the server. Your work is kept on this device and will be sent when it can." : "Saving…"}
        {stored === "failed" && (
          <button type="button" onClick={() => setStored("waiting")}>
            Try again
          </button>
        )}
      </p>

      <button type="button" className="sc-set glass" aria-haspopup="dialog" onClick={() => setSetup(true)}>
        <span>
          {keyName} · {draft.beats}/{draft.beatType} · {draft.tempo} a minute · {draft.hands === 2 ? "two hands" : "one line"}
        </span>
        <em className="mono">Change</em>
      </button>
      <Sheet open={setup} onClose={() => setSetup(false)} title="Key, time and speed">
        <div className="sc-set-grid">
          <Pick label="Key" value={String(draft.fifths)} options={KEYS.map(([f, name]) => [String(f), name] as const)} onChange={(v) => change({ ...draft, fifths: Number(v) })} />
          <Pick label="Time" value={`${draft.beats}/${draft.beatType}`} options={TIMES.map(([b, t]) => [`${b}/${t}`, `${b}/${t}`] as const)} onChange={(v) => (([b, t]) => change({ ...draft, beats: b, beatType: t }))(v.split("/").map(Number))} />
          <Pick label="For" value={String(draft.hands)} options={[["2", "Two hands (piano)"], ["1", "One line (melody, voice)"]]} onChange={(v) => (change({ ...draft, hands: v === "1" ? 1 : 2 }), setHand(0))} />
          <div className="sc-tempo">
            <span className="mono">Speed</span>
            <button type="button" onClick={() => change({ ...draft, tempo: Math.max(30, draft.tempo - 2) })} aria-label="Slower">
              −
            </button>
            <b>{draft.tempo}</b>
            <button type="button" onClick={() => change({ ...draft, tempo: Math.min(240, draft.tempo + 2) })} aria-label="Faster">
              +
            </button>
            <small>a minute</small>
          </div>
        </div>
        <div className="sheet-foot">
          <span />
          <button type="button" className="desk-btn desk-main" onClick={() => setSetup(false)}>
            Done
          </button>
        </div>
      </Sheet>

      <div className="sc-paper glass" aria-label="The score as it will look">
        {empty && (
          <ol className="sc-how">
            <li>
              <b>1</b>Pick how long the note lasts.
            </li>
            <li>
              <b>2</b>Tap it on the piano.
            </li>
            <li>
              <b>3</b>Keep going. Bars fill and draw themselves here, and your work is saved as you go.
            </li>
          </ol>
        )}
        <div ref={paper} hidden={empty} />
      </div>

      <div className="sc-desk glass">
        <div className="sc-desk-top">
          {draft.hands === 2 ? (
            <Tabs className="sc-hands" label="Which hand">
              {HAND.map((name, h) => (
                <button key={name} type="button" aria-pressed={hand === h} onClick={() => setHand(h)}>
                  {name}
                  <em>{total(h) || ""}</em>
                </button>
              ))}
            </Tabs>
          ) : (
            <span />
          )}
          {/* How full the bar being written is. */}
          <div className="sc-meter" aria-label={`Bar ${barNo}`}>
            <span className="mono">Bar {barNo}</span>
            <i>
              <u style={{ width: `${(inBar / length) * 100}%` }} />
            </i>
          </div>
        </div>

        {/* What has been written in this hand, bar by bar. Tap a note to choose it. */}
        <div className="sc-strip" ref={strip} aria-label={`${HAND[hand]}: what is written`}>
          <button type="button" className="sc-start" data-at={cursor === 0} onClick={() => (moveTo(0), setPicked(false))} aria-label="Put the cursor at the start">
            Start
          </button>
          {(() => {
            let used = 0;
            return events.map((ev, n) => {
              const from = used;
              used += ev.d;
              return (
                <span key={n} className="sc-ev-wrap sc-pop" data-bar-end={used % length === 0}>
                  <button type="button" className="sc-ev" data-sounding={now >= from && now < used} data-at={cursor === n + 1} data-picked={picked && cursor === n + 1} data-rest={!ev.p.length} onClick={() => (moveTo(n + 1), setPicked(true), hear(ev.p, ev.d))}>
                    <Glyph d={LENGTHS.some((l) => l.d === ev.d) ? ev.d : 4} />
                    <b>{label(ev)}</b>
                  </button>
                </span>
              );
            });
          })()}
          {!events.length && <span className="sc-strip-none">Nothing in this hand yet</span>}
        </div>

        <Grow>
        {picked && current ? (
          <div className="sc-picked sc-in">
            <span>
              <b>{label(current)}</b> chosen. Tap a length to change it.
            </span>
            <span className="sc-acts">
              <button type="button" onClick={() => shift(-1)} disabled={!current.p.length} aria-label="Down a semitone">
                ↓
              </button>
              <button type="button" onClick={() => shift(1)} disabled={!current.p.length} aria-label="Up a semitone">
                ↑
              </button>
              <button type="button" onClick={() => shift(-12)} disabled={!current.p.length}>
                8va ↓
              </button>
              <button type="button" onClick={() => shift(12)} disabled={!current.p.length}>
                8va ↑
              </button>
              <button type="button" className="sc-danger" onClick={remove}>
                Delete
              </button>
              <button type="button" onClick={() => setPicked(false)}>
                Done
              </button>
            </span>
          </div>
        ) : (
          <p className="sc-hint sc-in">The next note goes {cursor === events.length ? "at the end" : "after the marked one"}.</p>
        )}
        </Grow>

        <p className="sc-step mono">
          <b>1</b> How long
        </p>
        <div className="sc-lengths" role="group" aria-label="How long">
          <Pill />
          {LENGTHS.filter((l) => !l.dot).map((l) => (
            <button key={l.d} type="button" aria-pressed={pen === l.d || pen === l.d * 1.5} onClick={() => lengthen(l.d)} title={l.name} aria-label={l.name}>
              <Glyph d={l.d} />
            </button>
          ))}
          <button type="button" aria-pressed={!!LENGTHS.find((l) => l.d === pen)?.dot} onClick={dot} title="Dotted: half as long again" aria-label="Dotted">
            <b className="sc-dot">·</b>
          </button>
        </div>
        <div className="sc-acts sc-main-acts">
          <button type="button" onClick={rest}>
            Rest
          </button>
          <button type="button" aria-pressed={chord} onClick={() => setChord(!chord)} title="Add the next keys to the same note">
            Chord
          </button>
          <button type="button" onClick={remove} disabled={!current} aria-label="Delete the note before the cursor">
            ⌫
          </button>
          <button type="button" onClick={undo} disabled={!past.current.length}>
            Undo
          </button>
        </div>
        {chord && <p className="sc-hint">Chord is on: keys you tap now join the marked note. Tap Chord again to carry on.</p>}

        <p className="sc-step mono">
          <b>2</b> Which note <em>{HAND[hand].toLowerCase()}</em>
        </p>
        <div className="sc-piano-row">
          <button type="button" className="sc-oct" onClick={() => setOctave((o) => o.map((v, k) => (k === hand ? Math.max(0, v - 1) : v)))} aria-label="Lower keys">
            ‹
          </button>
          <div className="sc-piano" role="group" aria-label="Piano" ref={pianoBox} data-nowrap>
            <div className="sc-piano-track" ref={track} style={{ width: `${((keysWide + 14) / keysWide) * 100}%`, transform: `translateX(${-700 / (keysWide + 14)}%)` }}>
            {piano.map((midi) => (
              <button key={midi} type="button" data-black={BLACK.has(midi % 12)} data-on={chord && !!current?.p.includes(midi)} onPointerDown={(e) => (e.preventDefault(), enter(midi))} aria-label={nameOf(midi, draft.fifths)}>
                {midi % 12 === 0 && <span data-middle={midi === 60}>{nameOf(midi)}</span>}
              </button>
            ))}
            </div>
          </div>
          <button type="button" className="sc-oct" onClick={() => setOctave((o) => o.map((v, k) => (k === hand ? Math.min(6, v + 1) : v)))} aria-label="Higher keys">
            ›
          </button>
        </div>
        <details className="sc-keys">
          <summary>Using a keyboard</summary>
          <p>
            <kbd>A</kbd>–<kbd>G</kbd> write that note (the nearest one to the last). <kbd>1</kbd> <kbd>2</kbd> <kbd>4</kbd> <kbd>8</kbd> <kbd>6</kbd> choose semibreve, minim, crotchet, quaver, semiquaver; <kbd>.</kbd> dots it. <kbd>R</kbd> is a rest. <kbd>←</kbd> <kbd>→</kbd> move the cursor; <kbd>↑</kbd> <kbd>↓</kbd> move the chosen note a semitone (with Shift, an octave). <kbd>⌫</kbd> deletes, <kbd>Tab</kbd> swaps hands, <kbd>Space</kbd> plays, <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes.
          </p>
        </details>
      </div>

      {replacing && <p className="desk-help">This piece already has a score file that was uploaded. Putting this one on the site takes its place (the old file stays in the media library).</p>}
      <div className="desk-bar glass sc-foot">
        <span className="desk-bar-state mono" data-dirty={!empty && !onSite}>
          {empty ? "Empty" : onSite ? "Live" : piece.data.scoreLive ? "Changed" : "Not live"}
        </span>
        <button type="button" className="desk-btn" onClick={play} disabled={empty}>
          {playing ? "Stop" : "Play"}
        </button>
        {onSite ? (
          <button type="button" className="desk-btn desk-quiet" onClick={() => onSaved(`/music/pieces/${piece.slug}`)}>
            View it
          </button>
        ) : (
          <button type="button" className="desk-btn desk-main" onClick={publish} disabled={busy || empty}>
            {busy ? "Putting it up…" : "Put on the site"}
          </button>
        )}
      </div>
    </div>
  );
}

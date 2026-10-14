"use client";

import { Pill } from "@/components/Pill";
import { useEffect, useRef, useState } from "react";
import { drum, onSound, wantSound } from "@/lib/audio";
import { ListenLinks } from "../ListenLinks";

// Each signature: how the pulses in a bar are grouped, how long one pulse is, what the kit plays, and well-known music written in it.
type Signature = { name: string; label?: string; groups: number[]; unit: 4 | 8; kick: number[]; snare: number[]; count: string; feel: string; songs: [string, string][] };
const SIGNATURES: Signature[] = [
  {
    name: "4/4",
    groups: [1, 1, 1, 1],
    unit: 4,
    kick: [0, 2],
    snare: [1, 3],
    count: "ONE two THREE four",
    feel: "Common time. Four even beats, with the snare on two and four. If you can clap along without thinking, it is probably this.",
    songs: [["Billie Jean", "Michael Jackson"], ["Smells Like Teen Spirit", "Nirvana"], ["Hey Jude", "The Beatles"], ["Stayin' Alive", "Bee Gees"], ["Rolling in the Deep", "Adele"], ["Blinding Lights", "The Weeknd"], ["Shape of You", "Ed Sheeran"], ["Superstition", "Stevie Wonder"]],
  },
  {
    name: "3/4",
    groups: [3],
    unit: 4,
    kick: [0],
    snare: [1, 2],
    count: "ONE two three",
    feel: "Waltz time. Three beats with a lean on the first: oom-pah-pah.",
    songs: [["The Blue Danube", "Johann Strauss II"], ["Piano Man", "Billy Joel"], ["My Favorite Things", "from The Sound of Music"], ["Moon River", "Henry Mancini"], ["Take It to the Limit", "Eagles"], ["Amazing Grace", "Traditional"], ["Happy Birthday to You", "Traditional"], ["Edelweiss", "from The Sound of Music"]],
  },
  {
    name: "2/4",
    groups: [1, 1],
    unit: 4,
    kick: [0],
    snare: [1],
    count: "ONE two",
    feel: "March and polka time. Left, right, left, right.",
    songs: [["Can-Can (Galop infernal)", "Offenbach"], ["Beer Barrel Polka", "Jaromír Vejvoda"], ["Hungarian Dance No. 5", "Brahms"], ["Tritsch-Tratsch-Polka", "Johann Strauss II"], ["Pizzicato Polka", "Johann and Josef Strauss"]],
  },
  {
    name: "6/8",
    groups: [3, 3],
    unit: 8,
    kick: [0],
    snare: [3],
    count: "ONE-and-a TWO-and-a",
    feel: "Six quick pulses felt as two big beats. A bar of 6/8 lasts as long as a bar of 3/4, but it swings in two, not three.",
    songs: [["The House of the Rising Sun", "The Animals"], ["We Are the Champions", "Queen"], ["Nothing Else Matters", "Metallica"], ["Everybody Hurts", "R.E.M."], ["Kiss from a Rose", "Seal"], ["Greensleeves", "Traditional"], ["Barcarolle", "Offenbach"]],
  },
  {
    name: "12/8",
    groups: [3, 3, 3, 3],
    unit: 8,
    kick: [0, 6],
    snare: [3, 9],
    count: "ONE-and-a two-and-a THREE-and-a four-and-a",
    feel: "Four slow beats, each split in three. The rolling sway of slow blues, doo-wop and a great many ballads.",
    songs: [["Hallelujah", "Leonard Cohen"], ["Perfect", "Ed Sheeran"], ["Everybody Wants to Rule the World", "Tears for Fears"], ["At Last", "Etta James"], ["Unchained Melody", "The Righteous Brothers"], ["Oh! Darling", "The Beatles"], ["Hold the Line", "Toto"], ["Red House", "Jimi Hendrix"]],
  },
  {
    name: "5/4",
    groups: [3, 2],
    unit: 4,
    kick: [0],
    snare: [3],
    count: "ONE two three FOUR five",
    feel: "A bar with a limp: three, then two. It never quite sits down.",
    songs: [["Take Five", "The Dave Brubeck Quartet"], ["Mission: Impossible theme", "Lalo Schifrin"], ["Mars, from The Planets", "Holst"], ["15 Step", "Radiohead"], ["Living in the Past", "Jethro Tull"], ["Halloween theme", "John Carpenter"], ["Everything's Alright", "from Jesus Christ Superstar"]],
  },
  {
    name: "7/8",
    label: "7/8",
    groups: [2, 2, 3],
    unit: 8,
    kick: [0],
    snare: [2, 4],
    count: "ONE-two ONE-two ONE-two-three",
    feel: "Two, two, three. It always feels as though a beat has been stolen. The same count at half speed is 7/4.",
    songs: [["Money", "Pink Floyd (7/4)"], ["Solsbury Hill", "Peter Gabriel (7/4)"], ["Unsquare Dance", "Dave Brubeck (7/4)"], ["All You Need Is Love (verses)", "The Beatles (7/4)"], ["Tom Sawyer (instrumental section)", "Rush"], ["The Ocean (riff: a bar of 4/4, then 7/8)", "Led Zeppelin"]],
  },
  {
    name: "9/8",
    groups: [3, 3, 3],
    unit: 8,
    kick: [0],
    snare: [3, 6],
    count: "ONE-and-a TWO-and-a THREE-and-a",
    feel: "Three big beats, each split in three. A waltz that rolls.",
    songs: [["Jesu, Joy of Man's Desiring", "J. S. Bach"], ["Clair de lune", "Debussy"], ["Ride of the Valkyries", "Wagner"], ["The Butterfly (a slip jig)", "Irish traditional"]],
  },
  {
    name: "9/8",
    label: "9/8 (2+2+2+3)",
    groups: [2, 2, 2, 3],
    unit: 8,
    kick: [0],
    snare: [2, 4, 6],
    count: "ONE-two ONE-two ONE-two ONE-two-three",
    feel: "The same nine pulses, grouped the Turkish way. Same signature on paper, completely different dance.",
    songs: [["Blue Rondo à la Turk", "The Dave Brubeck Quartet"], ["Karşılama dances", "Turkish and Balkan folk music"]],
  },
];

export function TimeSignatures() {
  const [which, setWhich] = useState(0);
  const [bpm, setBpm] = useState(100);
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(-1);
  const live = useRef({ which, bpm });
  live.current = { which, bpm };
  const sig = SIGNATURES[which];
  const count = sig.groups.reduce((a, v) => a + v, 0);
  useEffect(() => onSound((on) => !on && setPlaying(false)), []); // sound switched off in the menu stops the beat
  const starts: number[] = [];
  sig.groups.reduce((edge, g) => (starts.push(edge), edge + g), 0);

  useEffect(() => {
    if (!playing) {
      setBeat(-1);
      return;
    }
    let step = 0, timer = 0;
    const tick = () => {
      const s = SIGNATURES[live.current.which];
      const total = s.groups.reduce((a, v) => a + v, 0);
      const at = step % total;
      if (s.kick.includes(at)) drum("kick", { gain: 0.6 });
      if (s.snare.includes(at)) drum("snare", { gain: s.unit === 4 && s.groups.length === 1 ? 0.3 : 0.5 });
      drum("hat", { gain: at === 0 ? 0.5 : 0.3 });
      setBeat(at);
      step += 1;
      // The tempo is the speed of a crotchet, so quavers go by twice as fast.
      timer = window.setTimeout(tick, (60000 / live.current.bpm) * (4 / s.unit));
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [playing, which]);

  return (
    <div className="mu-time">
      <div className="seg" role="group" aria-label="Time signature">
          <Pill />
        {SIGNATURES.map((s, k) => (
          <button key={s.label ?? s.name} type="button" aria-pressed={k === which} onClick={() => setWhich(k)}>
            {s.label ?? s.name}
          </button>
        ))}
      </div>
      <div className="mu-time-main">
        <div className="mu-time-sig" aria-hidden="true">
          <b>{sig.name.split("/")[0]}</b>
          <b>{sig.name.split("/")[1]}</b>
        </div>
        <div className="mu-time-count">
          <div className="mu-beats" role="img" aria-label={`${count} pulses in a bar, grouped ${sig.groups.join(" plus ")}`}>
            {Array.from({ length: count }, (_, k) => (
              <i key={`${which}-${k}`} data-strong={starts.includes(k)} data-first={k === 0} data-on={beat === k} style={{ marginLeft: k > 0 && starts.includes(k) && sig.groups.some((g) => g > 1) ? 12 : 0 }} />
            ))}
          </div>
          <span className="mono">{sig.count}</span>
        </div>
      </div>
      <p>{sig.feel}</p>
      <div className="lab-row">
        <button type="button" className="btn btn-primary small" onClick={() => (playing || wantSound(), setPlaying(!playing))}>
          {playing ? "Stop" : "Hear the beat"}
        </button>
        <label className="slider mono">
          {bpm} bpm
          <input type="range" min={60} max={180} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} aria-label="Tempo" />
        </label>
      </div>
      <div className="mu-songs">
        <span className="mono">You know it from</span>
        <ul key={which}>
          {sig.songs.map(([song, by], k) => (
            <li key={song} style={{ ["--k" as string]: k }}>
              <span className="mu-song">
                <b>{song}</b>
                <span>{by}</span>
              </span>
              <ListenLinks what={`${song} ${by}`} compact />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

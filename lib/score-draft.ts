// A score written in the admin area's own editor, and how it becomes MusicXML.

// Lengths are counted in semiquavers (sixteenth notes): a crotchet is 4, a minim 8, a semibreve 16.
export type Ev = { d: number; p: number[] };
export type Draft = { v: 1; fifths: number; beats: number; beatType: number; tempo: number; hands: 1 | 2; staves: [Ev[], Ev[]] };

export const blankDraft = (): Draft => ({ v: 1, fifths: 0, beats: 4, beatType: 4, tempo: 90, hands: 2, staves: [[], []] });
export const isDraft = (x: unknown): x is Draft => !!x && typeof x === "object" && (x as Draft).v === 1 && Array.isArray((x as Draft).staves);

// The lengths that can be written as one note, longest first, with what each is called.
export const LENGTHS: { d: number; type: string; dot: boolean; name: string; short: string }[] = [
  { d: 16, type: "whole", dot: false, name: "Semibreve (whole note)", short: "1" },
  { d: 12, type: "half", dot: true, name: "Dotted minim", short: "½." },
  { d: 8, type: "half", dot: false, name: "Minim (half note)", short: "½" },
  { d: 6, type: "quarter", dot: true, name: "Dotted crotchet", short: "¼." },
  { d: 4, type: "quarter", dot: false, name: "Crotchet (quarter note)", short: "¼" },
  { d: 3, type: "eighth", dot: true, name: "Dotted quaver", short: "⅛." },
  { d: 2, type: "eighth", dot: false, name: "Quaver (eighth note)", short: "⅛" },
  { d: 1, type: "16th", dot: false, name: "Semiquaver (sixteenth note)", short: "1⁄16" },
];
export const KEYS: [fifths: number, name: string][] = [[-6, "G♭ major / E♭ minor"], [-5, "D♭ major / B♭ minor"], [-4, "A♭ major / F minor"], [-3, "E♭ major / C minor"], [-2, "B♭ major / G minor"], [-1, "F major / D minor"], [0, "C major / A minor"], [1, "G major / E minor"], [2, "D major / B minor"], [3, "A major / F♯ minor"], [4, "E major / C♯ minor"], [5, "B major / G♯ minor"], [6, "F♯ major / D♯ minor"]];
export const TIMES: [number, number][] = [[2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [2, 2], [3, 8], [6, 8], [9, 8], [12, 8]];

export const barLength = (d: Pick<Draft, "beats" | "beatType">) => (d.beats * 16) / d.beatType;
export const freqOf = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

// How a note is spelt: with sharps in sharp keys and in C, with flats in flat keys.
const SHARP = [["C", 0], ["C", 1], ["D", 0], ["D", 1], ["E", 0], ["F", 0], ["F", 1], ["G", 0], ["G", 1], ["A", 0], ["A", 1], ["B", 0]] as const;
const FLAT = [["C", 0], ["D", -1], ["D", 0], ["E", -1], ["E", 0], ["F", 0], ["G", -1], ["G", 0], ["A", -1], ["A", 0], ["B", -1], ["B", 0]] as const;
export function spell(midi: number, fifths: number) {
  const [step, alter] = (fifths < 0 ? FLAT : SHARP)[((midi % 12) + 12) % 12];
  return { step, alter, octave: Math.floor(midi / 12) - 1 };
}
export function nameOf(midi: number, fifths = 0) {
  const s = spell(midi, fifths);
  return `${s.step}${s.alter > 0 ? "♯" : s.alter < 0 ? "♭" : ""}${s.octave}`;
}

// One written note or rest: a piece of an event, after it has been cut at bar lines.
type Seg = { d: number; p: number[]; from: boolean; to: boolean; beam?: string[] };

// A length as the fewest writable notes, longest first (5 semiquavers = a crotchet tied to a semiquaver).
function pieces(d: number) {
  const out: number[] = [];
  let left = d;
  for (const { d: size } of LENGTHS) while (left >= size) (out.push(size), (left -= size));
  return out;
}
// A hand's events laid into bars.
export function barsOf(events: Ev[], length: number): Seg[][] {
  const bars: Seg[][] = [[]];
  let used = 0;
  const put = (d: number, p: number[], from: boolean, to: boolean) => {
    if (used === length) (bars.push([]), (used = 0));
    bars[bars.length - 1].push({ d, p, from, to });
    used += d;
  };
  for (const ev of events) {
    let left = ev.d, first = true;
    while (left > 0) {
      if (used === length) (bars.push([]), (used = 0));
      const take = Math.min(left, length - used);
      const parts = pieces(take);
      parts.forEach((d, n) => {
        const last = n === parts.length - 1 && left - take === 0;
        put(d, ev.p, !first && ev.p.length > 0, !last && ev.p.length > 0);
        first = false;
      });
      left -= take;
    }
  }
  // Fill what is left of the last bar with rests.
  if (used > 0 && used < length) for (const d of pieces(length - used)) put(d, [], false, false);
  if (bars.length === 1 && !bars[0].length) return [];
  return bars;
}
// Quavers and semiquavers inside one beat are joined with a beam.
function beam(bar: Seg[], beat: number) {
  let at = 0;
  const groups: Seg[][] = [];
  let run: Seg[] = [], runBeat = -1;
  for (const seg of bar) {
    const b = Math.floor(at / beat);
    const short = seg.d <= 3 && seg.p.length > 0;
    if (!short || b !== runBeat) {
      if (run.length > 1) groups.push(run);
      run = [];
    }
    if (short) (run.push(seg), (runBeat = b));
    at += seg.d;
  }
  if (run.length > 1) groups.push(run);
  for (const g of groups)
    g.forEach((seg, n) => {
      const one = n === 0 ? "begin" : n === g.length - 1 ? "end" : "continue";
      const semi = (k: number) => k >= 0 && k < g.length && g[k].d === 1;
      // The second beam only joins semiquavers that stand next to each other; a lone one gets a stub.
      const two = seg.d !== 1 ? "" : semi(n - 1) && semi(n + 1) ? "continue" : semi(n + 1) ? "begin" : semi(n - 1) ? "end" : n === 0 ? "forward hook" : "backward hook";
      seg.beam = two ? [one, two] : [one];
    });
}

const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function toMusicXML(draft: Draft, about: { title?: string; composer?: string } = {}) {
  const length = barLength(draft);
  // In 6/8, 9/8 and 12/8 the beat is a dotted crotchet; otherwise it is the bottom number of the time signature.
  const beat = draft.beatType === 8 && draft.beats % 3 === 0 && draft.beats > 3 ? 6 : 16 / draft.beatType;
  const hands = draft.hands === 2 ? [0, 1] : [0];
  const laid = hands.map((h) => barsOf(draft.staves[h] ?? [], length));
  const count = Math.max(1, ...laid.map((b) => b.length));
  for (const bars of laid) for (const bar of bars) beam(bar, beat);

  const noteXml = (seg: Seg, staff: number, voice: number) => {
    const kind = LENGTHS.find((l) => l.d === seg.d)!;
    const tail = `<duration>${seg.d}</duration>${seg.from ? '<tie type="stop"/>' : ""}${seg.to ? '<tie type="start"/>' : ""}<voice>${voice}</voice><type>${kind.type}</type>${kind.dot ? "<dot/>" : ""}<staff>${staff}</staff>`;
    if (!seg.p.length) return `<note><rest/>${tail}</note>`;
    return [...seg.p]
      .sort((a, b) => a - b)
      .map((midi, n) => {
        const s = spell(midi, draft.fifths);
        const beams = n === 0 && seg.beam ? seg.beam.map((b, k) => `<beam number="${k + 1}">${b}</beam>`).join("") : "";
        const ties = seg.from || seg.to ? `<notations>${seg.from ? '<tied type="stop"/>' : ""}${seg.to ? '<tied type="start"/>' : ""}</notations>` : "";
        return `<note>${n ? "<chord/>" : ""}<pitch><step>${s.step}</step>${s.alter ? `<alter>${s.alter}</alter>` : ""}<octave>${s.octave}</octave></pitch>${tail}${beams}${ties}</note>`;
      })
      .join("");
  };

  const measures: string[] = [];
  for (let m = 0; m < count; m++) {
    let xml = `<measure number="${m + 1}">`;
    if (m === 0) {
      xml += `<attributes><divisions>4</divisions><key><fifths>${draft.fifths}</fifths></key><time><beats>${draft.beats}</beats><beat-type>${draft.beatType}</beat-type></time>`;
      xml += hands.length === 2 ? `<staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef>` : `<clef><sign>G</sign><line>2</line></clef>`;
      xml += `</attributes><direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${draft.tempo}</per-minute></metronome></direction-type><staff>1</staff><sound tempo="${draft.tempo}"/></direction>`;
    }
    hands.forEach((h, n) => {
      if (n) xml += `<backup><duration>${length}</duration></backup>`;
      const bar = laid[n][m];
      const staff = h + 1, voice = h ? 5 : 1;
      // A hand with nothing in this bar rests for the whole of it.
      xml += bar?.length ? bar.map((seg) => noteXml(seg, staff, voice)).join("") : `<note><rest measure="yes"/><duration>${length}</duration><voice>${voice}</voice><staff>${staff}</staff></note>`;
    });
    if (m === count - 1) xml += `<barline location="right"><bar-style>light-heavy</bar-style></barline>`;
    measures.push(`${xml}</measure>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
<work><work-title>${esc(about.title ?? "")}</work-title></work>
<identification><creator type="composer">${esc(about.composer ?? "")}</creator><encoding><software>sidneyb.uk score editor</software></encoding></identification>
<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
<part id="P1">
${measures.join("\n")}
</part>
</score-partwise>
`;
}

// Every note with when it starts and how long it lasts (in semiquavers), for playing the draft back.
export function soundsOf(draft: Draft) {
  const out: { at: number; d: number; midi: number; hand: number }[] = [];
  (draft.hands === 2 ? [0, 1] : [0]).forEach((h) => {
    let at = 0;
    for (const ev of draft.staves[h] ?? []) {
      for (const midi of ev.p) out.push({ at, d: ev.d, midi, hand: h });
      at += ev.d;
    }
  });
  return out.sort((a, b) => a.at - b.at);
}

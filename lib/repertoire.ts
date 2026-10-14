// The pieces I play.
export type Stage = "Learning" | "Comfortable" | "Performance ready";
export type Piece = {
  slug: string;
  title: string;
  // The fuller name for the top of its page, if the short one is a nickname.
  fullTitle?: string;
  composer: string;
  composerDates?: string;
  catalogue?: string; // BWV, Op., K. and so on
  written?: string;
  key?: string;
  // How hard it is, on whichever scale I use: "ABRSM Grade 6", "Henle 4".
  grade?: string;
  instruments: ("piano" | "guitar" | "voice")[];
  stage: Stage;
  // How well I know it, 0 to 100. My own honest number.
  proficiency: number;
  started?: string; // when I began learning it
  // One line for the card on the music page.
  note: string;
  // About the piece, and about playing it. Paragraphs.
  about: string[];
  mine?: string[];
  // The full score as MusicXML, in /public/scores.
  score?: string;
  // Crotchets a minute for the digital performance.
  tempo: number;
  // Where to hear a real recording.
  listen?: { spotify?: string; appleMusic?: string };
  // A printable copy, if there is one (a PDF in /public/scores).
  pdf?: string;
  // Where my copy of the sheet music came from: the edition, the book or the website.
  sources?: { name: string; href?: string; note?: string }[];
  // My recordings, newest first. Put the files in /public/music and list them in lib/assets-real.ts.
  recordings: { date: string; label: string; src: string; note?: string }[];
  // Set on the placeholder entries below so the page marks them as samples.
  sample?: boolean;
};

// SAMPLE ENTRIES.
export const seedRepertoire: Piece[] = [
  {
    slug: "bach-prelude-in-c",
    title: "Prelude in C major",
    fullTitle: "Prelude No. 1 in C major, from The Well-Tempered Clavier, Book I",
    composer: "Johann Sebastian Bach",
    composerDates: "1685–1750",
    catalogue: "BWV 846",
    written: "1722",
    key: "C major",
    instruments: ["piano"],
    stage: "Performance ready",
    proficiency: 90,
    started: "2019",
    grade: "Around Grade 5",
    sources: [{ name: "Breitkopf & Härtel, 1866", note: "The Bach-Gesellschaft edition, plate B.W. XIV, which this engraving follows." }],
    note: "Thirty-five bars of broken chords, and not a melody in sight.",
    about: [
      "The opening piece of The Well-Tempered Clavier, the collection Bach wrote to show that a keyboard tuned the new way could play in all twenty-four keys. It has no tune in the usual sense: each bar is one chord, spread out as eight notes and played twice.",
      "Everything interesting is in the harmony. The chords drift away from C major, lean on a long pedal note in the bass, and find their way home in the last four bars. Gounod later wrote his Ave Maria straight on top of it.",
    ],
    mine: ["Sample note. This is where you say what the piece is like to play: what took longest, what you listen for, which recording you learned it from."],
    score: "/scores/bach-prelude-in-c.musicxml",
    tempo: 72,
    recordings: [],
    sample: true,
  },
  {
    slug: "clementi-sonatina-op36-no1",
    title: "Sonatina in C",
    fullTitle: "Sonatina in C major, Op. 36 No. 1: I. Allegro",
    composer: "Muzio Clementi",
    composerDates: "1752–1832",
    catalogue: "Op. 36 No. 1",
    written: "1797",
    key: "C major",
    instruments: ["piano"],
    stage: "Comfortable",
    proficiency: 70,
    started: "2021",
    grade: "Around Grade 3",
    sources: [{ name: "Sample source", note: "Say which edition, book or site your copy came from." }],
    note: "A whole sonata form in under two minutes.",
    about: [
      "The first of six sonatinas Clementi published as teaching pieces, and probably the most played piano sonatina there is. The first movement is a complete sonata form in miniature: two themes, a short development, and both themes back again in the home key.",
      "It sounds easy and is not quite. The scales have to be even, the left hand has to stay out of the way, and the whole thing wants to be light.",
    ],
    mine: ["Sample note. Replace with your own."],
    score: "/scores/clementi-sonatina-op36-no1.musicxml",
    tempo: 126,
    recordings: [],
    sample: true,
  },
  {
    slug: "joplin-the-entertainer",
    title: "The Entertainer",
    fullTitle: "The Entertainer: A Ragtime Two Step",
    composer: "Scott Joplin",
    composerDates: "c. 1868–1917",
    written: "1902",
    key: "C major",
    instruments: ["piano"],
    stage: "Learning",
    proficiency: 35,
    started: "2026",
    grade: "Around Grade 6",
    sources: [{ name: "Sample source", note: "Say which edition, book or site your copy came from." }],
    note: "The left hand keeps time while the right hand argues with it.",
    about: [
      "Joplin's best-known rag, written in 1902 and made famous all over again seventy years later by the film The Sting. Like most rags it is built in sections, each repeated, over a steady left hand that jumps between bass notes and chords.",
      "The right hand is syncopated against that, landing just before or just after the beat. Joplin's own instruction on his rags was not to play them fast.",
    ],
    mine: ["Sample note. Replace with your own."],
    score: "/scores/joplin-the-entertainer.musicxml",
    tempo: 84,
    recordings: [],
    sample: true,
  },
];


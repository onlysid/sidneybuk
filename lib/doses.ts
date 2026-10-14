// Daily doses: small snippets of things I am working on. Each one gets its own page at /music/doses/<slug>.
export type Dose = {
  slug: string;
  title: string;
  date: string; // YYYY-MM-DD
  kind: "Original" | "Cover" | "Idea" | "Practice";
  instruments: string[];
  // One line for the list.
  note: string;
  // What it is and where it is going. Paragraphs.
  body: string[];
  // A key into `media` in lib/assets-real.ts (the file lives in /public/music).
  audio?: string;
  // Verses, each a list of lines.
  lyrics?: string[][];
  // Things to download: `file` is a key into `media` too.
  downloads?: { label: string; file: string; name: string }[];
  // Set on the placeholder entries below so the page marks them as samples.
  sample?: boolean;
};

// SAMPLE ENTRIES.
export const seedDoses: Dose[] = [
  {
    slug: "four-chords-at-midnight",
    title: "Four chords at midnight",
    date: "2026-10-05",
    kind: "Idea",
    instruments: ["guitar"],
    note: "A picking pattern I keep falling into. Might be a verse.",
    body: [
      "Sample dose. A seven-second loop: A minor, F, C, G, picked low to high and back. Nothing clever, but the pattern sits nicely under the hand and I think there is a verse in it.",
      "Next: find a second part that does not just go to the relative major.",
    ],
    audio: "sampleDose1",
    lyrics: [
      ["The kettle clicks, the street is still,", "four chords are all I have to spend,", "I play them round and round until", "the middle sounds just like the end."],
      ["(second verse to come)"],
    ],
    downloads: [
      { label: "Audio (WAV)", file: "sampleDose1", name: "four-chords-at-midnight.wav" },
      { label: "Lyrics (text)", file: "sampleLyrics1", name: "four-chords-at-midnight.txt" },
    ],
    sample: true,
  },
  {
    slug: "the-borrowed-chord",
    title: "The borrowed chord",
    date: "2026-09-28",
    kind: "Practice",
    instruments: ["piano"],
    note: "D, B minor, then a G minor that should not be there.",
    body: ["Sample dose. Practising a change I like: a major key that borrows the minor four chord for one bar. It is the oldest trick there is and it works every time."],
    audio: "sampleDose2",
    downloads: [{ label: "Audio (WAV)", file: "sampleDose2", name: "the-borrowed-chord.wav" }],
    sample: true,
  },
];


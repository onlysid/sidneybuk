// Film and photo projects: trips, sets of photographs, and videos.
export type Frame = {
  // A real photograph: a file in /public/film (for example "/film/nevada-01.jpg").
  src?: string;
  // Or, until there is one, a number that generates a stand-in landscape.
  seed?: number;
  caption?: string;
  // "wide" spans two columns in the grid; "tall" is a portrait.
  shape?: "wide" | "tall";
};
export type Project = {
  slug: string;
  title: string;
  kind: "Trip" | "Photos" | "Video";
  date: string; // YYYY-MM-DD
  place?: string;
  // One line for the card.
  note: string;
  // The write-up. Paragraphs.
  body: string[];
  cover: Frame;
  frames: Frame[];
  // For a video: the YouTube video ID (the part after "v=" in its address).
  youtube?: string;
  // Camera, lenses, anything else worth listing.
  facts?: [string, string][];
  // Set on the placeholder entries below so the page marks them as samples.
  sample?: boolean;
};

// SAMPLE ENTRIES.
export const seedProjects: Project[] = [
  {
    slug: "desert-autumn",
    title: "Desert, autumn",
    kind: "Trip",
    date: "2026-10-01",
    place: "Nevada",
    note: "A week of long roads and very large skies.",
    body: [
      "Sample project. This is where a trip goes: where you went, what you were trying to photograph, and what you came back with.",
      "The pictures here are generated stand-ins. Real photographs go in /public/film and are listed in lib/film.ts.",
    ],
    cover: { seed: 12 },
    frames: [{ seed: 12, caption: "First light", shape: "wide" }, { seed: 31, caption: "The road out" }, { seed: 44, caption: "Noon" }, { seed: 58, caption: "Dusk over the lake", shape: "wide" }, { seed: 73 }, { seed: 90, caption: "Stars, thirty seconds" }],
    facts: [["Camera", "Yours here"], ["Lenses", "24 mm, 50 mm"], ["Days", "7"]],
    sample: true,
  },
  {
    slug: "blue-hour",
    title: "Blue hour",
    kind: "Photos",
    date: "2026-08-14",
    note: "A set made in the twenty minutes after the sun has gone.",
    body: ["Sample project. A set of photographs with one idea behind it, and a few lines about that idea."],
    cover: { seed: 207 },
    frames: [{ seed: 207, shape: "wide" }, { seed: 211 }, { seed: 219 }, { seed: 226 }, { seed: 240, shape: "wide" }],
    facts: [["Camera", "Yours here"], ["Lens", "35 mm"]],
    sample: true,
  },
  {
    slug: "short-film",
    title: "A short film",
    kind: "Video",
    date: "2026-06-02",
    note: "Three minutes, shot and cut over a weekend.",
    body: ["Sample project. A video lives on YouTube; put its ID in this entry and it plays here. Underneath go stills, and notes on how it was shot and edited."],
    cover: { seed: 322 },
    frames: [{ seed: 322, caption: "Still", shape: "wide" }, { seed: 335, caption: "Still" }, { seed: 348, caption: "Still" }],
    youtube: "",
    facts: [["Shot on", "Yours here"], ["Edited in", "Yours here"], ["Length", "3 min"]],
    sample: true,
  },
];

